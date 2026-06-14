// @vitest-environment jsdom
/**
 * @fileoverview DB integration tests for convertTeamToBye — the pre-season
 * "drop a real team → it becomes the BYE" path.
 *
 * Verifies the in-place repurpose: an active team is reshaped to the canonical
 * bye shape (status='bye', captain_id=null, team_name='BYE', home_venue=null),
 * its roster is released, and its MATCHES are left untouched (so they become
 * bye weeks automatically). Plus the three guards: must be active, only one bye
 * per season, and no matches already played.
 *
 * The mutation runs through the real supabase-js client (jsdom pragma per
 * project_happy_dom_supabase_insert_limit), so the fixture is built with raw pg
 * (committed) and torn down explicitly — there's no transaction to roll back.
 *
 * Run: `pnpm test:run src/__tests__/database/convertTeamToBye`
 * Requires: local Supabase running (`pnpm run db:start`).
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { getPostgresPool, closePostgresPool } from '@/test/dbTestUtils';
import { convertTeamToBye } from '@/api/mutations/teams';

type Fixture = {
  orgId: string;
  leagueId: string;
  seasonId: string;
  weekId: string;
  teamAId: string; // the team we drop
  teamBId: string; // its opponent
  matchId: string;
};

describe('convertTeamToBye (pre-season drop → BYE)', () => {
  let pool: Pool;
  const created: Fixture[] = [];

  beforeAll(() => {
    pool = getPostgresPool();
  });

  afterAll(async () => {
    await closePostgresPool();
  });

  // Explicit teardown in dependency order (no ROLLBACK isolation available).
  afterEach(async () => {
    for (const f of created.splice(0)) {
      await pool.query('DELETE FROM match_games WHERE match_id = $1', [f.matchId]);
      await pool.query('DELETE FROM match_lineups WHERE match_id = $1', [f.matchId]);
      await pool.query('DELETE FROM matches WHERE id = $1', [f.matchId]);
      await pool.query('DELETE FROM team_players WHERE team_id = ANY($1)', [[f.teamAId, f.teamBId]]);
      await pool.query('DELETE FROM teams WHERE id = ANY($1)', [[f.teamAId, f.teamBId]]);
      await pool.query('DELETE FROM season_weeks WHERE id = $1', [f.weekId]);
      await pool.query('DELETE FROM seasons WHERE id = $1', [f.seasonId]);
      await pool.query('DELETE FROM leagues WHERE id = $1', [f.leagueId]);
      await pool.query('DELETE FROM organizations WHERE id = $1', [f.orgId]);
    }
  });

  async function one(sql: string, params: unknown[]): Promise<string> {
    return (await pool.query<{ id: string }>(sql, params)).rows[0].id;
  }

  /** Build an even (2-team) pre-season league with one scheduled A-vs-B match. */
  async function buildFixture(): Promise<Fixture> {
    const member = (await pool.query<{ id: string }>('SELECT id FROM members ORDER BY id LIMIT 1')).rows[0].id;
    const orgId = await one(
      `INSERT INTO organizations (organization_name, organization_address, organization_city,
         organization_state, organization_zip_code, organization_email, organization_phone,
         stripe_customer_id, payment_method_id, card_last4, card_brand, expiry_month, expiry_year,
         billing_zip, created_by)
       VALUES ('DropOrg','1 St','City','ST','00000','o@e.com','555','cus','pm','4242','visa',
         12, 2030, '00000', $1) RETURNING id`,
      [member],
    );
    const leagueId = await one(
      `INSERT INTO leagues (organization_id, game_type, day_of_week, league_start_date)
       VALUES ($1, 'eight_ball', 'monday', '2026-01-01') RETURNING id`,
      [orgId],
    );
    const seasonId = await one(
      `INSERT INTO seasons (league_id, season_name, start_date, end_date, season_length)
       VALUES ($1, 'S1', '2026-01-01', '2026-04-01', 12) RETURNING id`,
      [leagueId],
    );
    const weekId = await one(
      `INSERT INTO season_weeks (season_id, scheduled_date, week_name, week_type)
       VALUES ($1, '2026-01-08', 'Week 1', 'regular') RETURNING id`,
      [seasonId],
    );
    const teamAId = await one(
      `INSERT INTO teams (season_id, league_id, team_name, roster_size, status, captain_id)
       VALUES ($1, $2, 'Sharks', 5, 'active', $3) RETURNING id`,
      [seasonId, leagueId, member],
    );
    const teamBId = await one(
      `INSERT INTO teams (season_id, league_id, team_name, roster_size, status)
       VALUES ($1, $2, 'Jets', 5, 'active') RETURNING id`,
      [seasonId, leagueId],
    );
    // Give the dropping team a roster row to prove it gets cleared.
    await pool.query(
      `INSERT INTO team_players (team_id, member_id, is_captain, status, season_id)
       VALUES ($1, $2, true, 'active', $3)`,
      [teamAId, member, seasonId],
    );
    const matchId = await one(
      `INSERT INTO matches (season_id, season_week_id, match_number, home_team_id, away_team_id, status)
       VALUES ($1, $2, 1, $3, $4, 'scheduled') RETURNING id`,
      [seasonId, weekId, teamAId, teamBId],
    );

    const f: Fixture = { orgId, leagueId, seasonId, weekId, teamAId, teamBId, matchId };
    created.push(f);
    return f;
  }

  it('reshapes the team to the BYE, clears its roster, and leaves the match in place', async () => {
    const f = await buildFixture();

    await convertTeamToBye({ teamId: f.teamAId, seasonId: f.seasonId });

    const team = (
      await pool.query(
        'SELECT status, captain_id, team_name, home_venue_id FROM teams WHERE id = $1',
        [f.teamAId],
      )
    ).rows[0];
    expect(team.status).toBe('bye');
    expect(team.captain_id).toBeNull();
    expect(team.team_name).toBe('BYE');
    expect(team.home_venue_id).toBeNull();

    const roster = (
      await pool.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM team_players WHERE team_id = $1',
        [f.teamAId],
      )
    ).rows[0].n;
    expect(roster).toBe(0);

    // The match is untouched — it now points at the BYE, becoming a bye week.
    const match = (
      await pool.query('SELECT home_team_id, away_team_id, status FROM matches WHERE id = $1', [
        f.matchId,
      ])
    ).rows[0];
    expect(match.home_team_id).toBe(f.teamAId);
    expect(match.away_team_id).toBe(f.teamBId);
    expect(match.status).toBe('scheduled');
  });

  it('refuses when the season already has a BYE', async () => {
    const f = await buildFixture();
    // Turn the opponent into a bye first.
    await pool.query(`UPDATE teams SET status = 'bye', captain_id = NULL WHERE id = $1`, [f.teamBId]);

    await expect(convertTeamToBye({ teamId: f.teamAId, seasonId: f.seasonId })).rejects.toThrow(
      /already has a BYE/i,
    );
    // Team A is unchanged.
    const status = (await pool.query('SELECT status FROM teams WHERE id = $1', [f.teamAId])).rows[0].status;
    expect(status).toBe('active');
  });

  it('refuses when the team has already played a match', async () => {
    const f = await buildFixture();
    // 'in_progress' marks the match as started (satisfies the "played" guard)
    // without firing the heavier match-completion triggers.
    await pool.query(`UPDATE matches SET status = 'in_progress' WHERE id = $1`, [f.matchId]);

    await expect(convertTeamToBye({ teamId: f.teamAId, seasonId: f.seasonId })).rejects.toThrow(
      /already played/i,
    );
    const status = (await pool.query('SELECT status FROM teams WHERE id = $1', [f.teamAId])).rows[0].status;
    expect(status).toBe('active');
  });
});
