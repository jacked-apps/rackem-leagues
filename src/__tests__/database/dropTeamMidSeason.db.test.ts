/**
 * @fileoverview DB integration test for drop_team_mid_season() — dropping a
 * team that has already played.
 *
 * Verifies: the dropped team is WITHDRAWN (its row + past results kept), a fresh
 * BYE is created, every UNPLAYED match (home or away) is rewired onto the BYE
 * along with its lineup rows, and PLAYED matches are left untouched. Plus the
 * two guards (must be active, one BYE per season).
 *
 * Raw pg (RPC called directly, no supabase-js writes → no jsdom pragma). The
 * fixture is built + torn down explicitly.
 *
 * Run: `pnpm test:run src/__tests__/database/dropTeamMidSeason`
 * Requires: local Supabase + the 20260611000001 migration applied.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { getPostgresPool, closePostgresPool } from '@/test/dbTestUtils';

describe('drop_team_mid_season()', () => {
  let pool: Pool;
  const orgIds: string[] = [];

  beforeAll(() => {
    pool = getPostgresPool();
  });
  afterAll(async () => {
    await closePostgresPool();
  });

  afterEach(async () => {
    for (const orgId of orgIds.splice(0)) {
      const seasonFilter = `season_id IN (SELECT s.id FROM seasons s JOIN leagues l ON l.id = s.league_id WHERE l.organization_id = $1)`;
      const matchFilter = `match_id IN (SELECT mt.id FROM matches mt WHERE mt.${seasonFilter})`;
      await pool.query(`DELETE FROM match_games WHERE ${matchFilter}`, [orgId]);
      await pool.query(`DELETE FROM match_lineups WHERE ${matchFilter}`, [orgId]);
      await pool.query(`DELETE FROM matches WHERE ${seasonFilter}`, [orgId]);
      await pool.query(`DELETE FROM teams WHERE ${seasonFilter}`, [orgId]);
      await pool.query(`DELETE FROM season_weeks WHERE ${seasonFilter}`, [orgId]);
      await pool.query(`DELETE FROM seasons WHERE league_id IN (SELECT id FROM leagues WHERE organization_id = $1)`, [orgId]);
      await pool.query(`DELETE FROM leagues WHERE organization_id = $1`, [orgId]);
      await pool.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
    }
  });

  async function one(sql: string, params: unknown[]): Promise<string> {
    return (await pool.query<{ id: string }>(sql, params)).rows[0].id;
  }

  type Fx = {
    orgId: string;
    seasonId: string;
    sharks: string;
    opp1: string;
    opp2: string;
    opp3: string;
    playedMatch: string;
    unplayedHome: string;
    unplayedAway: string;
  };

  async function buildFixture(): Promise<Fx> {
    const member = (await pool.query<{ id: string }>('SELECT id FROM members ORDER BY id LIMIT 1')).rows[0].id;
    const orgId = await one(
      `INSERT INTO organizations (organization_name, organization_address, organization_city,
         organization_state, organization_zip_code, organization_email, organization_phone,
         stripe_customer_id, payment_method_id, card_last4, card_brand, expiry_month, expiry_year,
         billing_zip, created_by)
       VALUES ('MidDropOrg','1 St','City','ST','00000','o@e.com','555','c','p','4242','visa',12,2030,'00000',$1) RETURNING id`,
      [member],
    );
    orgIds.push(orgId);
    const leagueId = await one(
      `INSERT INTO leagues (organization_id, game_type, day_of_week, league_start_date)
       VALUES ($1,'eight_ball','monday','2026-01-01') RETURNING id`, [orgId]);
    const seasonId = await one(
      `INSERT INTO seasons (league_id, season_name, start_date, end_date, season_length)
       VALUES ($1,'S1','2026-01-01','2026-12-01',12) RETURNING id`, [leagueId]);
    const wk = await one(
      `INSERT INTO season_weeks (season_id, scheduled_date, week_name, week_type)
       VALUES ($1,'2026-02-01','W','regular') RETURNING id`, [seasonId]);

    const team = (name: string) =>
      one(`INSERT INTO teams (season_id, league_id, team_name, roster_size, status, captain_id)
           VALUES ($1,$2,$3,5,'active',$4) RETURNING id`, [seasonId, leagueId, name, member]);
    const sharks = await team('Sharks');
    const opp1 = await team('Opp1');
    const opp2 = await team('Opp2');
    const opp3 = await team('Opp3');

    const match = (n: number, home: string, away: string, status = 'scheduled', winner: string | null = null) =>
      one(`INSERT INTO matches (season_id, season_week_id, match_number, home_team_id, away_team_id, status, winner_team_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [seasonId, wk, n, home, away, status, winner]);

    const playedMatch = await match(1, sharks, opp1, 'completed', opp1); // kept
    const unplayedHome = await match(2, sharks, opp2); // sharks home → rewired
    const unplayedAway = await match(3, opp3, sharks); // sharks away → rewired

    return { orgId, seasonId, sharks, opp1, opp2, opp3, playedMatch, unplayedHome, unplayedAway };
  }

  it('withdraws the team, creates a BYE, and rewires only the unplayed matches', async () => {
    const f = await buildFixture();

    const byeId = (
      await pool.query<{ drop_team_mid_season: string }>('SELECT drop_team_mid_season($1, $2)', [
        f.sharks,
        f.seasonId,
      ])
    ).rows[0].drop_team_mid_season;

    // Dropped team is withdrawn (kept, not deleted).
    const sharks = (await pool.query('SELECT status FROM teams WHERE id = $1', [f.sharks])).rows[0];
    expect(sharks.status).toBe('withdrawn');

    // A fresh BYE was created.
    const bye = (await pool.query('SELECT status, team_name, captain_id FROM teams WHERE id = $1', [byeId])).rows[0];
    expect(bye.status).toBe('bye');
    expect(bye.team_name).toBe('BYE');
    expect(bye.captain_id).toBeNull();

    // Played match is untouched — Sharks keeps its history.
    const played = (await pool.query('SELECT home_team_id, away_team_id, status, winner_team_id FROM matches WHERE id = $1', [f.playedMatch])).rows[0];
    expect(played.home_team_id).toBe(f.sharks);
    expect(played.status).toBe('completed');
    expect(played.winner_team_id).toBe(f.opp1);

    // Unplayed matches are rewired onto the BYE (home + away sides).
    const home = (await pool.query('SELECT home_team_id FROM matches WHERE id = $1', [f.unplayedHome])).rows[0];
    expect(home.home_team_id).toBe(byeId);
    const away = (await pool.query('SELECT away_team_id FROM matches WHERE id = $1', [f.unplayedAway])).rows[0];
    expect(away.away_team_id).toBe(byeId);

    // The rewired matches' lineup rows moved to the BYE; none still point at Sharks.
    const staleLineups = (
      await pool.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM match_lineups
           WHERE match_id IN ($1, $2) AND team_id = $3`,
        [f.unplayedHome, f.unplayedAway, f.sharks],
      )
    ).rows[0].n;
    expect(staleLineups).toBe(0);
  });

  it('refuses when the season already has a BYE', async () => {
    const f = await buildFixture();
    await pool.query(`UPDATE teams SET status = 'bye', captain_id = NULL WHERE id = $1`, [f.opp3]);

    await expect(
      pool.query('SELECT drop_team_mid_season($1, $2)', [f.sharks, f.seasonId]),
    ).rejects.toThrow(/already has a BYE/i);
  });
});
