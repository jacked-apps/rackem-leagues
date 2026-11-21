// @vitest-environment jsdom
/**
 * @fileoverview DB test for dropTeamOddLeague / fetchSeasonByeTeamId: the app
 * path that loads the schedule + standings, plans the re-pairing and calls
 * apply_odd_league_drop, run through the real supabase-js client.
 *
 * Fixture: one played week (Dropped beat A) and one remaining week:
 *   Dropped (home) vs X,  Y (home) vs BYE,  A (home) vs B
 * Ed's rule: X and Y play each other; they already sit on different sides, so
 * Y stays home and X away. A vs B stays. A second season (no BYE) has a match
 * that the season-scoped query must EXCLUDE: it stays untouched.
 *
 * Run: `pnpm test:run src/__tests__/database/dropTeamOddLeague`
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { getPostgresPool, closePostgresPool } from '@/test/dbTestUtils';
import { dropTeamOddLeague, fetchSeasonByeTeamId } from '@/operator/team-management/dropTeamOddLeague';

describe('dropTeamOddLeague (odd-league drop through the app)', () => {
  let pool: Pool;
  const orgIds: string[] = [];
  const venueIds: string[] = [];

  beforeAll(() => { pool = getPostgresPool(); });
  afterAll(async () => { await closePostgresPool(); });
  afterEach(async () => {
    for (const orgId of orgIds.splice(0)) {
      const seasonFilter = `season_id IN (SELECT s.id FROM seasons s JOIN leagues l ON l.id = s.league_id WHERE l.organization_id = $1)`;
      await pool.query(`DELETE FROM match_lineups WHERE match_id IN (SELECT id FROM matches WHERE ${seasonFilter})`, [orgId]);
      for (const t of ['matches', 'teams', 'season_weeks']) await pool.query(`DELETE FROM ${t} WHERE ${seasonFilter}`, [orgId]);
      await pool.query(`DELETE FROM seasons WHERE league_id IN (SELECT id FROM leagues WHERE organization_id = $1)`, [orgId]);
      await pool.query(`DELETE FROM leagues WHERE organization_id = $1`, [orgId]);
      await pool.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
    }
    await pool.query(`DELETE FROM venues WHERE id = ANY($1)`, [venueIds.splice(0)]);
  });

  const one = async (sql: string, params: unknown[]) => (await pool.query<{ id: string }>(sql, params)).rows[0].id;
  const row = async (sql: string, params: unknown[]) => (await pool.query(sql, params)).rows[0];

  async function buildFixture() {
    const member = (await pool.query<{ id: string }>('SELECT id FROM members ORDER BY id LIMIT 1')).rows[0].id;
    const orgId = await one(
      `INSERT INTO organizations (organization_name, organization_address, organization_city,
         organization_state, organization_zip_code, organization_email, organization_phone,
         stripe_customer_id, payment_method_id, card_last4, card_brand, expiry_month, expiry_year,
         billing_zip, created_by)
       VALUES ('OddDropAppOrg','1 St','City','ST','00000','o@e.com','555','c','p','4242','visa',12,2030,'00000',$1) RETURNING id`,
      [member]);
    orgIds.push(orgId);
    const leagueId = await one(`INSERT INTO leagues (organization_id, game_type, day_of_week, league_start_date)
       VALUES ($1,'eight_ball','monday','2026-01-01') RETURNING id`, [orgId]);
    const season = () => one(`INSERT INTO seasons (league_id, season_name, start_date, end_date, season_length)
       VALUES ($1,'S','2026-01-01','2026-12-01',12) RETURNING id`, [leagueId]);
    const seasonId = await season();
    const otherSeasonId = await season();
    const week = (sid: string, date: string) => one(`INSERT INTO season_weeks (season_id, scheduled_date, week_name, week_type)
       VALUES ($1,$2,'W','regular') RETURNING id`, [sid, date]);
    const pastWeek = await week(seasonId, '2026-02-01');
    const nextWeek = await week(seasonId, '2026-02-08');
    const otherWeek = await week(otherSeasonId, '2026-02-08');

    const yVenue = await one(`INSERT INTO venues (name, street_address, city, state, zip_code, phone, bar_box_table_numbers)
       VALUES ('Y Bar','1 St','City','ST','00000','555','{1,2}') RETURNING id`, []);
    venueIds.push(yVenue);
    const team = (sid: string, name: string, status = 'active', venueId: string | null = null) =>
      one(`INSERT INTO teams (season_id, league_id, team_name, roster_size, status, captain_id, home_venue_id)
           VALUES ($1,$2,$3,5,$4,$5,$6) RETURNING id`, [sid, leagueId, name, status, status === 'bye' ? null : member, venueId]);
    const dropped = await team(seasonId, 'Dropped');
    const x = await team(seasonId, 'X');
    const y = await team(seasonId, 'Y', 'active', yVenue);
    const a = await team(seasonId, 'A');
    const b = await team(seasonId, 'B');
    const bye = await team(seasonId, 'BYE', 'bye');
    const o1 = await team(otherSeasonId, 'O1');
    const o2 = await team(otherSeasonId, 'O2');

    const match = (sid: string, weekId: string, n: number, home: string, away: string, status = 'scheduled', winner: string | null = null) =>
      one(`INSERT INTO matches (season_id, season_week_id, match_number, home_team_id, away_team_id, status, winner_team_id, scheduled_venue_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,(SELECT home_venue_id FROM teams WHERE id = $4)) RETURNING id`,
        [sid, weekId, n, home, away, status, winner]);
    await match(seasonId, pastWeek, 1, dropped, a, 'completed', dropped);
    const dMatch = await match(seasonId, nextWeek, 1, dropped, x);
    const byeMatch = await match(seasonId, nextWeek, 2, y, bye);
    const abMatch = await match(seasonId, nextWeek, 3, a, b);
    const otherMatch = await match(otherSeasonId, otherWeek, 1, o1, o2);

    return { seasonId, otherSeasonId, dropped, x, y, a, b, bye, yVenue, dMatch, byeMatch, abMatch, otherMatch };
  }

  const pair = (id: string) => row('SELECT home_team_id, away_team_id FROM matches WHERE id = $1', [id]);

  it('finds the BYE only in the season that has one', async () => {
    const f = await buildFixture();
    expect(await fetchSeasonByeTeamId(f.seasonId)).toBe(f.bye);
    expect(await fetchSeasonByeTeamId(f.otherSeasonId)).toBeNull();
  });

  it('re-pairs X with Y (Y stays home), withdraws the team, and leaves everything else alone', async () => {
    const f = await buildFixture();
    const otherBefore = await row('SELECT * FROM matches WHERE id = $1', [f.otherMatch]);

    await dropTeamOddLeague(f.dropped, f.seasonId, f.bye);

    expect(await pair(f.byeMatch)).toEqual({ home_team_id: f.y, away_team_id: f.x });
    expect((await row('SELECT scheduled_venue_id FROM matches WHERE id = $1', [f.byeMatch])).scheduled_venue_id).toBe(f.yVenue);
    expect(await pair(f.abMatch)).toEqual({ home_team_id: f.a, away_team_id: f.b });
    expect(await row('SELECT count(*)::int AS n FROM matches WHERE id = $1', [f.dMatch])).toEqual({ n: 0 });
    expect((await row('SELECT status FROM teams WHERE id = $1', [f.dropped])).status).toBe('withdrawn');
    expect(await row('SELECT * FROM matches WHERE id = $1', [f.otherMatch])).toEqual(otherBefore); // other season excluded
  });
});
