/**
 * @fileoverview DB integration tests for the onboarding cascade.
 *
 * Exercises rotate_team_join_token() + get_league_teams_for_onboarding()
 * against the local DB:
 *   supabase/migrations/20260529000008_join_link_distribution.sql (rotate)
 *   supabase/migrations/20260606010000_onboard_captains_league_scope.sql (league list)
 *
 * Tx-scoped JWT, rolls back. Proves: a captain/staff can rotate the token (it
 * changes); a non-approver cannot; the league onboarding list is org-staff
 * gated, carries team + captain + token, includes ONLY non-bye teams whose
 * captain is still a placeholder (members.user_id IS NULL), is scoped to the
 * one league, and a non-staff caller gets [].
 *
 * The league-list fixtures are constructed in-tx (placeholder captain, bye
 * team, registered-captain team, second-league team) and rolled back, so the
 * exclusion assertions are deterministic regardless of seed contents.
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

/** Insert a placeholder member (user_id NULL) in-tx; returns its id. */
async function insertPlaceholderMember(c: PoolClient, name: string): Promise<string> {
  const res = await c.query(
    `INSERT INTO members (first_name, last_name, city, state, system_player_number, user_id)
     VALUES ($1, 'Placeholder', 'Town', 'CA',
             (SELECT COALESCE(MAX(system_player_number), 0) + 1 FROM members),
             NULL)
     RETURNING id`,
    [name]
  );
  return res.rows[0].id;
}

/** Insert a team in-tx; returns its id. captainId NULL + status 'bye' models a bye. */
async function insertTeam(
  c: PoolClient,
  opts: {
    leagueId: string;
    seasonId: string;
    captainId: string | null;
    name: string;
    status?: string;
  }
): Promise<string> {
  const res = await c.query(
    `INSERT INTO teams (season_id, league_id, captain_id, team_name, roster_size, status)
     VALUES ($1, $2, $3, $4, 5, $5)
     RETURNING id`,
    [opts.seasonId, opts.leagueId, opts.captainId, opts.name, opts.status ?? 'active']
  );
  return res.rows[0].id;
}

describe('Onboarding cascade — join-link distribution', () => {
  // Rotate fixture: a registered captain who is also org staff.
  let rotateTeamId: string | null = null;
  let captainUser: string | null = null;
  let orgId: string | null = null;
  let outsiderUser: string | null = null;

  // League-list fixture: a (league, season) the staff actor governs, plus a
  // second (league, season) to prove league scoping.
  let leagueId: string | null = null;
  let seasonId: string | null = null;
  let staffMember: string | null = null;
  let staffUser: string | null = null;
  let otherLeagueId: string | null = null;
  let otherSeasonId: string | null = null;

  beforeAll(async () => {
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
    rotateTeamId = team[0]?.team_id ?? null;
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

    // A league (with a season) governed by an org-staff member who is registered.
    const gov = await executeSql(`
      SELECT l.id AS league_id, l.organization_id AS org_id, s.id AS season_id,
             os.member_id AS staff_member, sm.user_id AS staff_user
        FROM leagues l
        JOIN seasons s ON s.league_id = l.id
        JOIN organization_staff os ON os.organization_id = l.organization_id
        JOIN members sm ON sm.id = os.member_id AND sm.user_id IS NOT NULL
       ORDER BY l.id
       LIMIT 1`);
    leagueId = gov[0]?.league_id ?? null;
    seasonId = gov[0]?.season_id ?? null;
    staffMember = gov[0]?.staff_member ?? null;
    staffUser = gov[0]?.staff_user ?? null;

    const other = await executeSql(
      `SELECT l.id AS league_id, s.id AS season_id
         FROM leagues l JOIN seasons s ON s.league_id = l.id
        WHERE l.id <> $1 ORDER BY l.id LIMIT 1`,
      [leagueId]
    );
    otherLeagueId = other[0]?.league_id ?? null;
    otherSeasonId = other[0]?.season_id ?? null;
  });

  it('has rotate fixtures', () => {
    expect(rotateTeamId && captainUser && orgId && outsiderUser).toBeTruthy();
  });

  it('has league-list fixtures', () => {
    expect(leagueId && seasonId && staffMember && staffUser).toBeTruthy();
    expect(otherLeagueId && otherSeasonId).toBeTruthy();
  });

  it('captain/staff can rotate the join token (it changes)', async () => {
    await inTx(async (c) => {
      const before = await c.query(`SELECT join_token FROM teams WHERE id = $1`, [rotateTeamId]);
      await setJwt(c, captainUser);
      const res = await c.query(`SELECT rotate_team_join_token($1) AS r`, [rotateTeamId]);
      expect(res.rows[0].r.ok).toBe(true);
      const after = await c.query(`SELECT join_token FROM teams WHERE id = $1`, [rotateTeamId]);
      expect(after.rows[0].join_token).not.toBe(before.rows[0].join_token);
      expect(res.rows[0].r.join_token).toBe(after.rows[0].join_token);
    });
  });

  it('a non-approver cannot rotate the token', async () => {
    await inTx(async (c) => {
      const before = await c.query(`SELECT join_token FROM teams WHERE id = $1`, [rotateTeamId]);
      await setJwt(c, outsiderUser);
      const res = await c.query(`SELECT rotate_team_join_token($1) AS r`, [rotateTeamId]);
      expect(res.rows[0].r.ok).toBe(false);
      const after = await c.query(`SELECT join_token FROM teams WHERE id = $1`, [rotateTeamId]);
      expect(after.rows[0].join_token).toBe(before.rows[0].join_token);
    });
  });

  it('lists a non-bye team whose captain is still a placeholder; excludes bye + registered-captain teams', async () => {
    await inTx(async (c) => {
      // Pin staff IN-TX (rolled back) — immune to a sibling test mutating
      // organization_staff non-transactionally. The RPC is staff-gated.
      await c.query(
        `INSERT INTO organization_staff (organization_id, member_id, position)
         SELECT $1, $2, 'admin'
         ON CONFLICT (organization_id, member_id) DO NOTHING`,
        [orgId, staffMember]
      );

      const placeholder = await insertPlaceholderMember(c, 'NewCap');
      const placeholderTeam = await insertTeam(c, {
        leagueId: leagueId!,
        seasonId: seasonId!,
        captainId: placeholder,
        name: 'ZZ Placeholder-Captain Team',
      });
      const registeredTeam = await insertTeam(c, {
        leagueId: leagueId!,
        seasonId: seasonId!,
        captainId: staffMember, // a registered member (user_id NOT NULL)
        name: 'ZZ Registered-Captain Team',
      });
      const byeTeam = await insertTeam(c, {
        leagueId: leagueId!,
        seasonId: seasonId!,
        captainId: null,
        name: 'BYE',
        status: 'bye',
      });

      await setJwt(c, staffUser);
      const res = await c.query(`SELECT get_league_teams_for_onboarding($1) AS r`, [leagueId]);
      const rows = res.rows[0].r as Array<{ team_id: string; team_name: string; captain_name: string; join_token: string }>;
      expect(Array.isArray(rows)).toBe(true);

      const ids = rows.map((r) => r.team_id);
      expect(ids).toContain(placeholderTeam);
      expect(ids).not.toContain(registeredTeam);
      expect(ids).not.toContain(byeTeam);

      const mine = rows.find((r) => r.team_id === placeholderTeam)!;
      expect(typeof mine.team_name).toBe('string');
      expect(typeof mine.captain_name).toBe('string');
      expect(mine.join_token).toBeTruthy();
    });
  });

  it('is scoped to the league — a placeholder team in another league does not appear', async () => {
    await inTx(async (c) => {
      await c.query(
        `INSERT INTO organization_staff (organization_id, member_id, position)
         SELECT $1, $2, 'admin'
         ON CONFLICT (organization_id, member_id) DO NOTHING`,
        [orgId, staffMember]
      );
      const placeholder = await insertPlaceholderMember(c, 'OtherCap');
      const otherTeam = await insertTeam(c, {
        leagueId: otherLeagueId!,
        seasonId: otherSeasonId!,
        captainId: placeholder,
        name: 'ZZ Other-League Placeholder Team',
      });

      await setJwt(c, staffUser);
      const res = await c.query(`SELECT get_league_teams_for_onboarding($1) AS r`, [leagueId]);
      const ids = (res.rows[0].r as Array<{ team_id: string }>).map((r) => r.team_id);
      expect(ids).not.toContain(otherTeam);
    });
  });

  it('a non-staff caller gets an empty onboard list', async () => {
    await inTx(async (c) => {
      await setJwt(c, outsiderUser);
      const res = await c.query(`SELECT get_league_teams_for_onboarding($1) AS r`, [leagueId]);
      expect(res.rows[0].r).toEqual([]);
    });
  });
});
