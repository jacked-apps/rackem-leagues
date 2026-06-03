/**
 * @fileoverview DB integration tests for the onboarding cascade — Unit 4.
 *
 * Exercises the approve_join_request(request_id, action, claimed_member_id?)
 * RPC and the 'captain_approve' actor_role widening, against the local DB:
 *   supabase/migrations/20260529000004_approve_join_request.sql
 *
 * Each case runs in a transaction with a simulated JWT (request.jwt.claims),
 * inserts its own pending request, and ROLLBACKs — so the roster inserts,
 * merges, archives, and any fixture tweaks (e.g. nulling a captain) leave no
 * trace and the cases stay independent on the shared DB.
 *
 * Covers: not_authenticated / invalid_action / not_found / already_handled /
 * not_authorized, plus Decline, Add, Replace (real merge), no_placeholder, and
 * the nullable-captain → staff-only path.
 *
 * Run: pnpm test:run src/__tests__/database/approve-join-request
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { executeSql, getPostgresPool } from '@/test/dbTestUtils';
import type { PoolClient } from 'pg';

/** Run fn in a transaction, always rolling back. */
async function inTx(fn: (c: PoolClient) => Promise<void>): Promise<void> {
  const c = await getPostgresPool().connect();
  try {
    await c.query('BEGIN');
    await fn(c);
  } finally {
    await c.query('ROLLBACK');
    c.release();
  }
}

/** Set auth.uid() for the rest of this transaction (null = anonymous). */
async function setJwt(c: PoolClient, sub: string | null): Promise<void> {
  await c.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
    sub ? JSON.stringify({ sub }) : '',
  ]);
}

/** Insert a pending join request for the joiner; returns its id. */
async function insertRequest(
  c: PoolClient,
  teamId: string,
  joinerUser: string,
  joinerMember: string,
  claimedMemberId?: string | null
): Promise<string> {
  const res = await c.query(
    `INSERT INTO team_join_requests
       (team_id, requested_by_user_id, requested_member_id, claimed_member_id)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [teamId, joinerUser, joinerMember, claimedMemberId ?? null]
  );
  return res.rows[0].id;
}

async function approve(
  c: PoolClient,
  requestId: string,
  action: 'add' | 'replace' | 'decline',
  claimedMemberId?: string | null
): Promise<any> {
  const res = await c.query(
    `SELECT approve_join_request($1, $2, $3) AS r`,
    [requestId, action, claimedMemberId ?? null]
  );
  return res.rows[0].r;
}

describe('Onboarding cascade Unit 4 — approve_join_request', () => {
  let teamId: string | null = null;
  let captainUser: string | null = null;
  let orgId: string | null = null;
  let placeholderId: string | null = null;
  let joinerUser: string | null = null;
  let joinerMember: string | null = null;
  let outsiderUser: string | null = null;

  beforeAll(async () => {
    // A team with a registered captain, resolvable org, and a placeholder on it.
    // Deterministic fixture (ORDER BY id, not arbitrary LIMIT 1) whose captain
    // is ALSO org staff — so the nullable-captain→staff case has a valid actor.
    const team = await executeSql(`
      SELECT t.id AS team_id, c.user_id AS captain_user, l.organization_id AS org
        FROM teams t
        JOIN members c ON c.id = t.captain_id
        JOIN leagues l ON l.id = t.league_id
       WHERE t.captain_id IS NOT NULL AND c.user_id IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM team_players tp JOIN members m ON m.id = tp.member_id
            WHERE tp.team_id = t.id AND m.user_id IS NULL
         )
         AND EXISTS (
           SELECT 1 FROM organization_staff os
            WHERE os.organization_id = l.organization_id AND os.member_id = t.captain_id
         )
       ORDER BY t.id
       LIMIT 1`);
    teamId = team[0]?.team_id ?? null;
    captainUser = team[0]?.captain_user ?? null;
    orgId = team[0]?.org ?? null;
    const org = orgId;

    const ph = await executeSql(
      `SELECT tp.member_id FROM team_players tp
         JOIN members m ON m.id = tp.member_id
        WHERE tp.team_id = $1 AND m.user_id IS NULL
        ORDER BY tp.member_id LIMIT 1`,
      [teamId]
    );
    placeholderId = ph[0]?.member_id ?? null;

    // A registered member NOT on the team → the joiner.
    const joiner = await executeSql(
      `SELECT m.id, m.user_id FROM members m
        WHERE m.user_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM team_players tp
                           WHERE tp.team_id = $1 AND tp.member_id = m.id)
        ORDER BY m.id LIMIT 1`,
      [teamId]
    );
    joinerMember = joiner[0]?.id ?? null;
    joinerUser = joiner[0]?.user_id ?? null;

    // A registered user who is neither the captain nor org staff → outsider.
    const outsider = await executeSql(
      `SELECT m.user_id FROM members m
        WHERE m.user_id IS NOT NULL
          AND m.user_id <> $2
          AND NOT EXISTS (SELECT 1 FROM organization_staff os
                           WHERE os.organization_id = $1 AND os.member_id = m.id)
        ORDER BY m.id LIMIT 1`,
      [org, captainUser]
    );
    outsiderUser = outsider[0]?.user_id ?? null;
  });

  it('has the fixtures it needs', () => {
    expect(teamId && captainUser && placeholderId && joinerMember && joinerUser && outsiderUser).toBeTruthy();
  });

  it('rejects an anonymous caller (not_authenticated)', async () => {
    await inTx(async (c) => {
      const id = await insertRequest(c, teamId!, joinerUser!, joinerMember!);
      await setJwt(c, null);
      expect(await approve(c, id, 'add')).toEqual({ ok: false, reason: 'not_authenticated' });
    });
  });

  it('rejects an unknown action (invalid_action)', async () => {
    await inTx(async (c) => {
      const id = await insertRequest(c, teamId!, joinerUser!, joinerMember!);
      await setJwt(c, captainUser);
      const r = await c.query(`SELECT approve_join_request($1, 'bogus', NULL) AS r`, [id]);
      expect(r.rows[0].r).toEqual({ ok: false, reason: 'invalid_action' });
    });
  });

  it('rejects an unknown request id (not_found)', async () => {
    await inTx(async (c) => {
      await setJwt(c, captainUser);
      expect(
        await approve(c, '00000000-0000-0000-0000-000000000000', 'add')
      ).toEqual({ ok: false, reason: 'not_found' });
    });
  });

  it('refuses a non-captain / non-staff caller (not_authorized)', async () => {
    await inTx(async (c) => {
      const id = await insertRequest(c, teamId!, joinerUser!, joinerMember!);
      await setJwt(c, outsiderUser);
      expect(await approve(c, id, 'add')).toEqual({ ok: false, reason: 'not_authorized' });
      // Request untouched.
      const row = await c.query(`SELECT status FROM team_join_requests WHERE id = $1`, [id]);
      expect(row.rows[0].status).toBe('pending');
    });
  });

  it('Decline flips the request to rejected, no roster change', async () => {
    await inTx(async (c) => {
      const id = await insertRequest(c, teamId!, joinerUser!, joinerMember!);
      await setJwt(c, captainUser);
      expect(await approve(c, id, 'decline')).toEqual({ ok: true, reason: 'declined' });

      const row = await c.query(`SELECT status FROM team_join_requests WHERE id = $1`, [id]);
      expect(row.rows[0].status).toBe('rejected');
      const onTeam = await c.query(
        `SELECT 1 FROM team_players WHERE team_id = $1 AND member_id = $2`,
        [teamId, joinerMember]
      );
      expect(onTeam.rowCount).toBe(0);
    });
  });

  it('Add puts the joiner on the roster and approves the request', async () => {
    await inTx(async (c) => {
      const id = await insertRequest(c, teamId!, joinerUser!, joinerMember!);
      await setJwt(c, captainUser);
      expect(await approve(c, id, 'add')).toEqual({ ok: true, reason: 'added' });

      const row = await c.query(`SELECT status FROM team_join_requests WHERE id = $1`, [id]);
      expect(row.rows[0].status).toBe('approved');
      const onTeam = await c.query(
        `SELECT 1 FROM team_players WHERE team_id = $1 AND member_id = $2`,
        [teamId, joinerMember]
      );
      expect(onTeam.rowCount).toBe(1);
    });
  });

  it('Replace merges the placeholder into the joiner and approves', async () => {
    await inTx(async (c) => {
      const id = await insertRequest(c, teamId!, joinerUser!, joinerMember!, placeholderId);
      await setJwt(c, captainUser);
      expect(await approve(c, id, 'replace')).toEqual({ ok: true, reason: 'replaced' });

      const row = await c.query(`SELECT status FROM team_join_requests WHERE id = $1`, [id]);
      expect(row.rows[0].status).toBe('approved');
      // Placeholder consumed by the merge…
      const ph = await c.query(`SELECT 1 FROM members WHERE id = $1`, [placeholderId]);
      expect(ph.rowCount).toBe(0);
      // …and its spot transferred to the joiner.
      const onTeam = await c.query(
        `SELECT 1 FROM team_players WHERE team_id = $1 AND member_id = $2`,
        [teamId, joinerMember]
      );
      expect(onTeam.rowCount).toBe(1);
    });
  });

  it('Replace with no placeholder available → no_placeholder', async () => {
    await inTx(async (c) => {
      const id = await insertRequest(c, teamId!, joinerUser!, joinerMember!); // no claim
      await setJwt(c, captainUser);
      expect(await approve(c, id, 'replace')).toEqual({ ok: false, reason: 'no_placeholder' });
    });
  });

  it('a second approve on a settled request → already_handled', async () => {
    await inTx(async (c) => {
      const id = await insertRequest(c, teamId!, joinerUser!, joinerMember!);
      await setJwt(c, captainUser);
      expect((await approve(c, id, 'add')).ok).toBe(true);
      const again = await approve(c, id, 'add');
      expect(again.reason).toBe('already_handled');
      expect(again.status).toBe('approved');
    });
  });

  it('nullable captain → org staff can still approve', async () => {
    await inTx(async (c) => {
      // Bye/edge team with no captain: staff (here = captainUser, also staff)
      // must still be able to act; the outsider still cannot.
      await c.query(`UPDATE teams SET captain_id = NULL WHERE id = $1`, [teamId]);

      // Pin the staff state IN-TX (rolled back) so this case is immune to a
      // sibling RLS test that mutates organization_staff non-transactionally:
      // the actor IS staff, the outsider is NOT.
      await c.query(
        `INSERT INTO organization_staff (organization_id, member_id, position)
         SELECT $1, m.id, 'admin' FROM members m WHERE m.user_id = $2
         ON CONFLICT (organization_id, member_id) DO NOTHING`,
        [orgId, captainUser]
      );
      await c.query(
        `DELETE FROM organization_staff
          WHERE organization_id = $1
            AND member_id = (SELECT id FROM members WHERE user_id = $2)`,
        [orgId, outsiderUser]
      );

      const id = await insertRequest(c, teamId!, joinerUser!, joinerMember!);

      await setJwt(c, outsiderUser);
      expect(await approve(c, id, 'add')).toEqual({ ok: false, reason: 'not_authorized' });

      await setJwt(c, captainUser); // this user is org staff
      expect((await approve(c, id, 'add')).ok).toBe(true);
    });
  });
});
