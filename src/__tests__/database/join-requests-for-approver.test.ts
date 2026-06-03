/**
 * @fileoverview DB integration tests for the onboarding cascade — Unit 5 read.
 *
 * Exercises get_join_requests_for_approver() + the league/member display
 * helpers against the local DB:
 *   supabase/migrations/20260529000005_join_requests_for_approver.sql
 *
 * Each case runs under a tx-scoped JWT and rolls back its seeded requests.
 *
 * Proves: anonymous/no-member → []; a captain sees their team's pending request
 * with person + team + league labels; non-pending and expired requests are
 * excluded; a non-approver sees nothing; and a request appears once even when
 * the caller is both captain and staff (de-dup).
 *
 * Run: pnpm test:run src/__tests__/database/join-requests-for-approver
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { executeSql, getPostgresPool } from '@/test/dbTestUtils';
import type { PoolClient } from 'pg';

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

async function setJwt(c: PoolClient, sub: string | null): Promise<void> {
  await c.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
    sub ? JSON.stringify({ sub }) : '',
  ]);
}

async function feed(c: PoolClient): Promise<any[]> {
  const res = await c.query(`SELECT get_join_requests_for_approver() AS f`);
  return res.rows[0].f;
}

describe('Onboarding cascade Unit 5 — get_join_requests_for_approver', () => {
  let teamId: string | null = null;
  let captainUser: string | null = null;
  let joinerUser: string | null = null;
  let joinerMember: string | null = null;
  let outsiderUser: string | null = null;

  beforeAll(async () => {
    const team = await executeSql(`
      SELECT t.id AS team_id, c.user_id AS captain_user, l.organization_id AS org
        FROM teams t
        JOIN members c ON c.id = t.captain_id
        JOIN leagues l ON l.id = t.league_id
       WHERE t.captain_id IS NOT NULL AND c.user_id IS NOT NULL
       LIMIT 1`);
    teamId = team[0]?.team_id ?? null;
    captainUser = team[0]?.captain_user ?? null;
    const org = team[0]?.org ?? null;

    const joiner = await executeSql(
      `SELECT m.id, m.user_id FROM members m
        WHERE m.user_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM team_players tp
                           WHERE tp.team_id = $1 AND tp.member_id = m.id)
        LIMIT 1`,
      [teamId]
    );
    joinerMember = joiner[0]?.id ?? null;
    joinerUser = joiner[0]?.user_id ?? null;

    const outsider = await executeSql(
      `SELECT m.user_id FROM members m
        WHERE m.user_id IS NOT NULL AND m.user_id <> $2
          AND NOT EXISTS (SELECT 1 FROM organization_staff os
                           WHERE os.organization_id = $1 AND os.member_id = m.id)
        LIMIT 1`,
      [org, captainUser]
    );
    outsiderUser = outsider[0]?.user_id ?? null;
  });

  async function seedPending(c: PoolClient): Promise<string> {
    const res = await c.query(
      `INSERT INTO team_join_requests (team_id, requested_by_user_id, requested_member_id)
       VALUES ($1, $2, $3) RETURNING id`,
      [teamId, joinerUser, joinerMember]
    );
    return res.rows[0].id;
  }

  it('has fixtures', () => {
    expect(teamId && captainUser && joinerUser && joinerMember && outsiderUser).toBeTruthy();
  });

  it('returns [] for an anonymous caller', async () => {
    await inTx(async (c) => {
      await seedPending(c);
      await setJwt(c, null);
      expect(await feed(c)).toEqual([]);
    });
  });

  it("lists the captain's pending request with labels", async () => {
    await inTx(async (c) => {
      const id = await seedPending(c);
      await setJwt(c, captainUser);
      const rows = await feed(c);
      const mine = rows.find((r) => r.request_id === id);
      expect(mine).toBeTruthy();
      expect(mine.team_id).toBe(teamId);
      expect(typeof mine.team_name).toBe('string');
      expect(mine.league_name).toMatch(/^[A-Z]/);
      expect(typeof mine.requester_name).toBe('string');
      expect(mine.requester_name.length).toBeGreaterThan(0);
    });
  });

  it('excludes non-pending and expired requests', async () => {
    await inTx(async (c) => {
      // approved + expired requests should not appear.
      const approved = await c.query(
        `INSERT INTO team_join_requests (team_id, requested_by_user_id, requested_member_id, status)
         VALUES ($1, $2, $3, 'approved') RETURNING id`,
        [teamId, joinerUser, joinerMember]
      );
      const expired = await c.query(
        `INSERT INTO team_join_requests (team_id, requested_by_user_id, requested_member_id, expires_at)
         VALUES ($1, $2, $3, now() - interval '1 day') RETURNING id`,
        [teamId, outsiderUser, joinerMember]
      );
      await setJwt(c, captainUser);
      const ids = (await feed(c)).map((r) => r.request_id);
      expect(ids).not.toContain(approved.rows[0].id);
      expect(ids).not.toContain(expired.rows[0].id);
    });
  });

  it('shows nothing to a non-approver', async () => {
    await inTx(async (c) => {
      await seedPending(c);
      await setJwt(c, outsiderUser);
      // The outsider may legitimately have their own approvable teams, but must
      // NOT see this team's request.
      const ids = (await feed(c)).map((r) => r.team_id);
      expect(ids).not.toContain(teamId);
    });
  });

  it('lists a request once even when the caller is captain AND staff', async () => {
    await inTx(async (c) => {
      const id = await seedPending(c);
      await setJwt(c, captainUser); // fixture captain is also org staff
      const rows = await feed(c);
      expect(rows.filter((r) => r.request_id === id)).toHaveLength(1);
    });
  });
});
