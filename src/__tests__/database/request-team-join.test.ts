/**
 * @fileoverview DB integration tests for the onboarding cascade — Unit 3.
 *
 * Exercises the request_team_join(token, claimed_member_id?) RPC against the
 * local DB:
 *   supabase/migrations/20260529000003_request_team_join.sql
 *
 * Every case runs inside a transaction with a simulated JWT
 * (request.jwt.claims) and rolls back — so the inserted requests and any
 * fixture tweaks (e.g. a temporary roster_size) leave no trace and the cases
 * stay independent on the shared DB.
 *
 * Covers the guard matrix:
 *   not_authenticated / invalid_token / no_member / already_member / full /
 *   invalid_claim / spot_taken, plus the happy self-add, happy claim, and the
 *   idempotent already_pending re-tap.
 *
 * Run: pnpm test:run src/__tests__/database/request-team-join
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { executeSql, getPostgresPool } from '@/test/dbTestUtils';
import type { PoolClient } from 'pg';

/**
 * Run `fn` in a transaction with auth.uid() set to `sub`, then ROLLBACK.
 * `sub` of null leaves no JWT (simulates an anonymous caller).
 */
async function withJwt(
  sub: string | null,
  fn: (client: PoolClient) => Promise<void>
): Promise<void> {
  const client = await getPostgresPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
      sub ? JSON.stringify({ sub }) : '',
    ]);
    await fn(client);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

/** Call the RPC on `client` and return the parsed jsonb result. */
async function callRpc(
  client: PoolClient,
  token: string,
  claimedMemberId?: string | null
): Promise<any> {
  const res = await client.query(
    `SELECT request_team_join($1, $2) AS r`,
    [token, claimedMemberId ?? null]
  );
  return res.rows[0].r;
}

describe('Onboarding cascade Unit 3 — request_team_join', () => {
  let token: string | null = null;
  let teamId: string | null = null;
  let placeholderId: string | null = null;
  let joinerUser: string | null = null; // registered, NOT on the team
  let otherUser: string | null = null; // a second registered user, NOT on the team
  let onTeamUser: string | null = null; // a user already on the team

  beforeAll(async () => {
    // A team that has open placeholders AND room for a self-add.
    const team = await executeSql(
      `SELECT t.id, t.join_token
         FROM teams t
         JOIN team_players tp ON tp.team_id = t.id
         JOIN members m ON m.id = tp.member_id
        WHERE m.user_id IS NULL
        GROUP BY t.id, t.join_token, t.roster_size
       HAVING t.roster_size IS NULL
           OR COUNT(*) FILTER (WHERE tp.status = 'active') < t.roster_size
        LIMIT 1`
    );
    teamId = team[0]?.id ?? null;
    token = team[0]?.join_token ?? null;

    const ph = await executeSql(
      `SELECT tp.member_id
         FROM team_players tp
         JOIN members m ON m.id = tp.member_id
        WHERE tp.team_id = $1 AND m.user_id IS NULL
        LIMIT 1`,
      [teamId]
    );
    placeholderId = ph[0]?.member_id ?? null;

    // A user already on this team (for already_member).
    const onTeam = await executeSql(
      `SELECT m.user_id
         FROM team_players tp
         JOIN members m ON m.id = tp.member_id
        WHERE tp.team_id = $1 AND m.user_id IS NOT NULL
        LIMIT 1`,
      [teamId]
    );
    onTeamUser = onTeam[0]?.user_id ?? null;

    // Two registered users who are NOT on this team (joiner + race partner).
    const others = await executeSql(
      `SELECT m.user_id
         FROM members m
        WHERE m.user_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM team_players tp
             WHERE tp.team_id = $1 AND tp.member_id = m.id
          )
        LIMIT 2`,
      [teamId]
    );
    joinerUser = others[0]?.user_id ?? null;
    otherUser = others[1]?.user_id ?? null;
  });

  it('has the fixtures it needs', () => {
    expect(token && teamId && placeholderId && joinerUser && otherUser && onTeamUser).toBeTruthy();
  });

  it('rejects an anonymous caller (not_authenticated)', async () => {
    await withJwt(null, async (c) => {
      const r = await callRpc(c, token!);
      expect(r).toEqual({ ok: false, reason: 'not_authenticated' });
    });
  });

  it('rejects an unknown token (invalid_token)', async () => {
    await withJwt(joinerUser, async (c) => {
      const r = await callRpc(c, '00000000-0000-0000-0000-000000000000');
      expect(r).toEqual({ ok: false, reason: 'invalid_token' });
    });
  });

  it('rejects a caller with no member row (no_member)', async () => {
    // A JWT sub that matches no members.user_id → must complete profile first.
    await withJwt('99999999-9999-9999-9999-999999999999', async (c) => {
      const r = await callRpc(c, token!);
      expect(r).toEqual({ ok: false, reason: 'no_member' });
    });
  });

  it('rejects someone already on the team (already_member)', async () => {
    await withJwt(onTeamUser, async (c) => {
      const r = await callRpc(c, token!);
      expect(r).toEqual({ ok: false, reason: 'already_member' });
    });
  });

  it('files a self-add request (submitted → pending)', async () => {
    await withJwt(joinerUser, async (c) => {
      const r = await callRpc(c, token!);
      expect(r.ok).toBe(true);
      expect(r.reason).toBe('submitted');
      expect(r.status).toBe('pending');
      expect(r.request_id).toBeTruthy();

      // The row is really there (within this tx).
      const row = await c.query(
        `SELECT status, claimed_member_id FROM team_join_requests WHERE id = $1`,
        [r.request_id]
      );
      expect(row.rows[0].status).toBe('pending');
      expect(row.rows[0].claimed_member_id).toBeNull();
    });
  });

  it('is idempotent on a second self-add (already_pending)', async () => {
    await withJwt(joinerUser, async (c) => {
      const first = await callRpc(c, token!);
      expect(first.ok).toBe(true);
      const second = await callRpc(c, token!);
      expect(second.reason).toBe('already_pending');
      expect(second.status).toBe('pending');
    });
  });

  it('files a claim on an open placeholder (submitted)', async () => {
    await withJwt(joinerUser, async (c) => {
      const r = await callRpc(c, token!, placeholderId);
      expect(r.ok).toBe(true);
      expect(r.reason).toBe('submitted');
      const row = await c.query(
        `SELECT claimed_member_id FROM team_join_requests WHERE id = $1`,
        [r.request_id]
      );
      expect(row.rows[0].claimed_member_id).toBe(placeholderId);
    });
  });

  it('rejects a claim on a non-placeholder / wrong-team member (invalid_claim)', async () => {
    await withJwt(joinerUser, async (c) => {
      // onTeamUser's member id is a registered member on this team, not an
      // open placeholder — claiming it is invalid.
      const m = await c.query(`SELECT id FROM members WHERE user_id = $1 LIMIT 1`, [onTeamUser]);
      const r = await callRpc(c, token!, m.rows[0].id);
      expect(r).toEqual({ ok: false, reason: 'invalid_claim' });
    });
  });

  it('rejects a second pending claim on the same spot (spot_taken)', async () => {
    await withJwt(joinerUser, async (c) => {
      const first = await callRpc(c, token!, placeholderId);
      expect(first.ok).toBe(true);
      // Same transaction, different caller's claim on the same placeholder.
      await c.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: otherUser }),
      ]);
      const second = await callRpc(c, token!, placeholderId);
      expect(second).toEqual({ ok: false, reason: 'spot_taken' });
    });
  });

  it('rejects a self-add when the roster is full (full)', async () => {
    await withJwt(joinerUser, async (c) => {
      // Shrink roster_size to the current active count so the team is "full".
      await c.query(
        `UPDATE teams
            SET roster_size = (SELECT COUNT(*) FROM team_players
                                WHERE team_id = $1 AND status = 'active')
          WHERE id = $1`,
        [teamId]
      );
      const r = await callRpc(c, token!);
      expect(r).toEqual({ ok: false, reason: 'full' });

      // ...but claiming an existing placeholder spot is still allowed.
      const claim = await callRpc(c, token!, placeholderId);
      expect(claim.ok).toBe(true);
    });
  });
});
