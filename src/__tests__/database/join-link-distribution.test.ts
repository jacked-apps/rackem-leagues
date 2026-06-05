/**
 * @fileoverview DB integration tests for the onboarding cascade — Unit 7.
 *
 * Exercises rotate_team_join_token() + get_org_teams_for_onboarding() against
 * the local DB:
 *   supabase/migrations/20260529000008_join_link_distribution.sql
 *
 * Tx-scoped JWT, rolls back. Proves: a captain/staff can rotate the token (it
 * changes); a non-approver cannot; the org-teams list is org-staff gated and
 * carries team + captain + token; a non-staff caller gets [].
 *
 * Run: pnpm test:run src/__tests__/database/join-link-distribution
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

describe('Onboarding cascade Unit 7 — join-link distribution', () => {
  let teamId: string | null = null;
  let captainUser: string | null = null;
  let orgId: string | null = null;
  let outsiderUser: string | null = null;

  beforeAll(async () => {
    // Deterministic fixture whose captain is also org staff (the org-teams list
    // is staff-gated, and this user acts as both captain and staff here).
    const team = await executeSql(`
      SELECT t.id AS team_id, c.user_id AS captain_user, l.organization_id AS org
        FROM teams t
        JOIN members c ON c.id = t.captain_id
        JOIN leagues l ON l.id = t.league_id
       WHERE t.captain_id IS NOT NULL AND c.user_id IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM organization_staff os
            WHERE os.organization_id = l.organization_id AND os.member_id = t.captain_id
         )
       ORDER BY t.id
       LIMIT 1`);
    teamId = team[0]?.team_id ?? null;
    captainUser = team[0]?.captain_user ?? null;
    orgId = team[0]?.org ?? null;

    const outsider = await executeSql(
      `SELECT m.user_id FROM members m
        WHERE m.user_id IS NOT NULL AND m.user_id <> $2
          AND NOT EXISTS (SELECT 1 FROM organization_staff os
                           WHERE os.organization_id = $1 AND os.member_id = m.id)
        LIMIT 1`,
      [orgId, captainUser]
    );
    outsiderUser = outsider[0]?.user_id ?? null;
  });

  it('has fixtures', () => {
    expect(teamId && captainUser && orgId && outsiderUser).toBeTruthy();
  });

  it('captain/staff can rotate the join token (it changes)', async () => {
    await inTx(async (c) => {
      const before = await c.query(`SELECT join_token FROM teams WHERE id = $1`, [teamId]);
      await setJwt(c, captainUser);
      const res = await c.query(`SELECT rotate_team_join_token($1) AS r`, [teamId]);
      expect(res.rows[0].r.ok).toBe(true);
      const after = await c.query(`SELECT join_token FROM teams WHERE id = $1`, [teamId]);
      expect(after.rows[0].join_token).not.toBe(before.rows[0].join_token);
      expect(res.rows[0].r.join_token).toBe(after.rows[0].join_token);
    });
  });

  it('a non-approver cannot rotate the token', async () => {
    await inTx(async (c) => {
      const before = await c.query(`SELECT join_token FROM teams WHERE id = $1`, [teamId]);
      await setJwt(c, outsiderUser);
      const res = await c.query(`SELECT rotate_team_join_token($1) AS r`, [teamId]);
      expect(res.rows[0].r.ok).toBe(false);
      const after = await c.query(`SELECT join_token FROM teams WHERE id = $1`, [teamId]);
      expect(after.rows[0].join_token).toBe(before.rows[0].join_token);
    });
  });

  it('org staff sees the onboard-captains list with team + captain + token', async () => {
    await inTx(async (c) => {
      // Pin staff IN-TX (rolled back) — immune to a sibling RLS test mutating
      // organization_staff non-transactionally. get_org_teams is staff-only.
      await c.query(
        `INSERT INTO organization_staff (organization_id, member_id, position)
         SELECT $1, m.id, 'admin' FROM members m WHERE m.user_id = $2
         ON CONFLICT (organization_id, member_id) DO NOTHING`,
        [orgId, captainUser]
      );
      await setJwt(c, captainUser); // fixture captain is also org staff
      const res = await c.query(`SELECT get_org_teams_for_onboarding($1) AS r`, [orgId]);
      const rows = res.rows[0].r;
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBeGreaterThan(0);
      const mine = rows.find((r: any) => r.team_id === teamId);
      expect(mine).toBeTruthy();
      expect(typeof mine.team_name).toBe('string');
      expect(typeof mine.captain_name).toBe('string');
      expect(mine.join_token).toBeTruthy();
    });
  });

  it('a non-staff caller gets an empty onboard list', async () => {
    await inTx(async (c) => {
      await setJwt(c, outsiderUser);
      const res = await c.query(`SELECT get_org_teams_for_onboarding($1) AS r`, [orgId]);
      expect(res.rows[0].r).toEqual([]);
    });
  });
});
