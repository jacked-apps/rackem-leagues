/**
 * @fileoverview DB integration tests for the richer approve surface — Unit 1.
 *
 * Exercises the two reads added by
 *   supabase/migrations/20260612000000_approve_surface_roster.sql
 * against the local DB:
 *   - get_join_requests_for_approver() now carries a captain summary
 *     (captain_name + captain_is_placeholder).
 *   - get_team_roster_for_approver(team_id) returns a team's full roster
 *     (registered members + claimable placeholders), each marked, captain first.
 *
 * Each case runs under a tx-scoped JWT and rolls back its seeded requests.
 *
 * Proves: the roster always includes the captain (even when the captain is only
 * in teams.captain_id, not team_players) flagged is_captain with consistent
 * claimable/is_registered; a non-approver gets []; and the feed's captain
 * summary reflects whether that captain is still a placeholder.
 *
 * Run: pnpm test:run src/__tests__/database/approve-surface-roster
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

async function roster(c: PoolClient, teamId: string): Promise<any[]> {
  const res = await c.query(`SELECT get_team_roster_for_approver($1) AS r`, [teamId]);
  return res.rows[0].r;
}

async function feed(c: PoolClient): Promise<any[]> {
  const res = await c.query(`SELECT get_join_requests_for_approver() AS f`);
  return res.rows[0].f;
}

describe('Approve surface Unit 1 — roster RPC + feed captain summary', () => {
  // Fixture A — a team whose captain is REGISTERED and is also org staff (gives
  // a registered caller + a registered-captain roster row + the false case).
  let regTeam: string | null = null;
  let regCaptainUser: string | null = null;

  // Fixture B — a team whose captain is a PLACEHOLDER, in an org that has some
  // registered staff member to act as the caller (the captain-is-placeholder
  // case + the "captain only in teams.captain_id" robustness case).
  let phTeam: string | null = null;
  let phStaffUser: string | null = null;
  let phStaffMember: string | null = null;

  // An outsider registered user (not captain, not staff of either fixture org).
  let outsiderUser: string | null = null;
  // A registered member to stand in as the requester when seeding a request.
  let joinerUser: string | null = null;
  let joinerMember: string | null = null;

  beforeAll(async () => {
    const a = await executeSql(`
      SELECT t.id AS team_id, c.user_id AS captain_user, l.organization_id AS org
        FROM teams t
        JOIN members c ON c.id = t.captain_id
        JOIN leagues l ON l.id = t.league_id
       WHERE c.user_id IS NOT NULL
         AND EXISTS (SELECT 1 FROM organization_staff os
                      WHERE os.organization_id = l.organization_id
                        AND os.member_id = t.captain_id)
       ORDER BY t.id
       LIMIT 1`);
    regTeam = a[0]?.team_id ?? null;
    regCaptainUser = a[0]?.captain_user ?? null;

    const b = await executeSql(`
      SELECT t.id AS team_id,
             s.member_id AS staff_member,
             sm.user_id  AS staff_user
        FROM teams t
        JOIN members c ON c.id = t.captain_id
        JOIN leagues l ON l.id = t.league_id
        JOIN organization_staff s ON s.organization_id = l.organization_id
        JOIN members sm ON sm.id = s.member_id AND sm.user_id IS NOT NULL
       WHERE c.user_id IS NULL
       ORDER BY t.id
       LIMIT 1`);
    phTeam = b[0]?.team_id ?? null;
    phStaffMember = b[0]?.staff_member ?? null;
    phStaffUser = b[0]?.staff_user ?? null;

    const outsider = await executeSql(
      `SELECT m.user_id FROM members m
        WHERE m.user_id IS NOT NULL
          AND m.id <> COALESCE($1::uuid, '00000000-0000-0000-0000-000000000000')
          AND NOT EXISTS (
            SELECT 1 FROM organization_staff os
              JOIN teams t ON t.id = $2::uuid
              JOIN leagues l ON l.id = t.league_id
             WHERE os.organization_id = l.organization_id AND os.member_id = m.id)
        LIMIT 1`,
      [phStaffMember, phTeam]
    );
    outsiderUser = outsider[0]?.user_id ?? null;

    const joiner = await executeSql(
      `SELECT m.id, m.user_id FROM members m WHERE m.user_id IS NOT NULL LIMIT 1`
    );
    joinerMember = joiner[0]?.id ?? null;
    joinerUser = joiner[0]?.user_id ?? null;
  });

  it('has fixtures', () => {
    expect(regTeam && regCaptainUser).toBeTruthy();
    expect(phTeam && phStaffUser).toBeTruthy();
    expect(outsiderUser && joinerUser && joinerMember).toBeTruthy();
  });

  // --- Roster RPC ---------------------------------------------------------

  it('returns the captain row flagged is_captain, registered, not claimable', async () => {
    await inTx(async (c) => {
      await setJwt(c, regCaptainUser);
      const rows = await roster(c, regTeam!);
      const captains = rows.filter((r) => r.is_captain);
      expect(captains).toHaveLength(1);
      expect(captains[0].is_registered).toBe(true);
      expect(captains[0].claimable).toBe(false);
      // Every row's claimable is the inverse of is_registered (a placeholder is
      // exactly an unregistered member).
      rows.forEach((r) => expect(r.claimable).toBe(!r.is_registered));
    });
  });

  it('always includes the captain even when only in teams.captain_id (placeholder team)', async () => {
    await inTx(async (c) => {
      await setJwt(c, phStaffUser);
      const rows = await roster(c, phTeam!);
      const captains = rows.filter((r) => r.is_captain);
      expect(captains).toHaveLength(1);
      // This captain is still a placeholder → claimable connect target.
      expect(captains[0].claimable).toBe(true);
      expect(captains[0].is_registered).toBe(false);
      expect(typeof captains[0].display_name).toBe('string');
      expect(captains[0].display_name.length).toBeGreaterThan(0);
      // Captain sorts first.
      expect(rows[0].is_captain).toBe(true);
    });
  });

  it('returns [] to a non-approver (authz mirrors the placeholders RPC)', async () => {
    await inTx(async (c) => {
      await setJwt(c, outsiderUser);
      expect(await roster(c, phTeam!)).toEqual([]);
    });
  });

  it('returns [] to an anonymous caller', async () => {
    await inTx(async (c) => {
      await setJwt(c, null);
      expect(await roster(c, phTeam!)).toEqual([]);
    });
  });

  // --- Feed captain summary ----------------------------------------------

  it('marks captain_is_placeholder=true on a placeholder-captain team', async () => {
    await inTx(async (c) => {
      await c.query(
        `INSERT INTO team_join_requests (team_id, requested_by_user_id, requested_member_id)
         VALUES ($1, $2, $3)`,
        [phTeam, joinerUser, joinerMember]
      );
      await setJwt(c, phStaffUser);
      const row = (await feed(c)).find((r) => r.team_id === phTeam);
      expect(row).toBeTruthy();
      expect(row.captain_is_placeholder).toBe(true);
      expect(typeof row.captain_name).toBe('string');
      expect(row.captain_name.length).toBeGreaterThan(0);
    });
  });

  it('marks captain_is_placeholder=false on a registered-captain team', async () => {
    await inTx(async (c) => {
      await c.query(
        `INSERT INTO team_join_requests (team_id, requested_by_user_id, requested_member_id)
         VALUES ($1, $2, $3)`,
        [regTeam, joinerUser, joinerMember]
      );
      await setJwt(c, regCaptainUser);
      const row = (await feed(c)).find((r) => r.team_id === regTeam);
      expect(row).toBeTruthy();
      expect(row.captain_is_placeholder).toBe(false);
      expect(row.captain_name.length).toBeGreaterThan(0);
    });
  });
});
