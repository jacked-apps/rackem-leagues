/**
 * @fileoverview DB integration test for apply_odd_league_drop(): dropping a
 * team mid-season from a league that ALREADY has a BYE.
 *
 * Fixture (one remaining week, 5 real teams + BYE):
 *   Dropped (home) vs X      → deleted
 *   Y (home)       vs BYE    → becomes X (home) vs Y (away)  [Ed's swap]
 *   A (home)       vs B      → must stay EXACTLY as it was
 * plus an earlier, completed Dropped vs A match that must be kept.
 *
 * Checks the venue follows the new home team, Y keeps the lineup its captain
 * already entered, X gets a fresh lineup, the BYE's lineup is gone, the team
 * is withdrawn, and the guards reject a stale or incomplete plan with NOTHING
 * changed.
 *
 * Raw pg (RPC called directly, no supabase-js writes → no jsdom pragma).
 * Run: `pnpm test:run src/__tests__/database/applyOddLeagueDrop`
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { getPostgresPool, closePostgresPool } from '@/test/dbTestUtils';

describe('apply_odd_league_drop()', () => {
  let pool: Pool;
  const orgIds: string[] = [];
  const venueIds: string[] = [];

  beforeAll(() => { pool = getPostgresPool(); });
  afterAll(async () => { await closePostgresPool(); });

  afterEach(async () => {
    for (const orgId of orgIds.splice(0)) {
      const seasonFilter = `season_id IN (SELECT s.id FROM seasons s JOIN leagues l ON l.id = s.league_id WHERE l.organization_id = $1)`;
      const matchFilter = `match_id IN (SELECT mt.id FROM matches mt WHERE mt.${seasonFilter})`;
      await pool.query(`DELETE FROM match_lineups WHERE ${matchFilter}`, [orgId]);
      await pool.query(`DELETE FROM matches WHERE ${seasonFilter}`, [orgId]);
      await pool.query(`DELETE FROM teams WHERE ${seasonFilter}`, [orgId]);
      await pool.query(`DELETE FROM season_weeks WHERE ${seasonFilter}`, [orgId]);
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
       VALUES ('OddDropOrg','1 St','City','ST','00000','o@e.com','555','c','p','4242','visa',12,2030,'00000',$1) RETURNING id`,
      [member]);
    orgIds.push(orgId);
    const leagueId = await one(`INSERT INTO leagues (organization_id, game_type, day_of_week, league_start_date)
       VALUES ($1,'eight_ball','monday','2026-01-01') RETURNING id`, [orgId]);
    const seasonId = await one(`INSERT INTO seasons (league_id, season_name, start_date, end_date, season_length)
       VALUES ($1,'S1','2026-01-01','2026-12-01',12) RETURNING id`, [leagueId]);
    const week = (date: string) => one(`INSERT INTO season_weeks (season_id, scheduled_date, week_name, week_type)
       VALUES ($1,$2,'W','regular') RETURNING id`, [seasonId, date]);
    const pastWeek = await week('2026-02-01');
    const nextWeek = await week('2026-02-08');

    const venue = async (name: string) => {
      const id = await one(`INSERT INTO venues (name, street_address, city, state, zip_code, phone, bar_box_table_numbers)
         VALUES ($1,'1 St','City','ST','00000','555','{1,2}') RETURNING id`, [name]);
      venueIds.push(id);
      return id;
    };
    const xVenue = await venue('X Bar');
    const yVenue = await venue('Y Bar');
    const team = (name: string, status = 'active', venueId: string | null = null) =>
      one(`INSERT INTO teams (season_id, league_id, team_name, roster_size, status, captain_id, home_venue_id)
           VALUES ($1,$2,$3,5,$4,$5,$6) RETURNING id`,
        [seasonId, leagueId, name, status, status === 'bye' ? null : member, venueId]);
    const dropped = await team('Dropped');
    const x = await team('X', 'active', xVenue);
    const y = await team('Y', 'active', yVenue);
    const a = await team('A');
    const b = await team('B');
    const bye = await team('BYE', 'bye');

    const match = (weekId: string, n: number, home: string, away: string, status = 'scheduled', winner: string | null = null) =>
      one(`INSERT INTO matches (season_id, season_week_id, match_number, home_team_id, away_team_id, status, winner_team_id, scheduled_venue_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,(SELECT home_venue_id FROM teams WHERE id = $4)) RETURNING id`,
        [seasonId, weekId, n, home, away, status, winner]);
    const played = await match(pastWeek, 1, dropped, a, 'completed', a);
    const dMatch = await match(nextWeek, 1, dropped, x);
    const byeMatch = await match(nextWeek, 2, y, bye);
    const abMatch = await match(nextWeek, 3, a, b);

    // Y's captain already entered a player for next week.
    await pool.query(`UPDATE match_lineups SET player1_id = $1, player1_handicap = 4.5
                       WHERE match_id = $2 AND team_id = $3`, [member, byeMatch, y]);

    return { seasonId, dropped, x, y, a, b, bye, xVenue, played, dMatch, byeMatch, abMatch, member };
  }

  const apply = (f: Awaited<ReturnType<typeof buildFixture>>, updates: object[], rewire: string[], del: string[]) =>
    pool.query('SELECT apply_odd_league_drop($1, $2, $3, $4, $5)',
      [f.dropped, f.seasonId, JSON.stringify(updates), rewire, del]);

  it("pairs X with Y in the BYE's match, keeps Y's lineup, and leaves everything else alone", async () => {
    const f = await buildFixture();
    // The table re-deal re-saves the week, bumping updated_at; every real column must match.
    const abNow = async () => { const { updated_at: _, ...rest } = await row('SELECT * FROM matches WHERE id = $1', [f.abMatch]); return rest; };
    const abBefore = await abNow();

    await apply(f, [{ matchId: f.byeMatch, homeTeamId: f.x, awayTeamId: f.y }], [], [f.dMatch]);

    const m = await row(`SELECT home_team_id, away_team_id, scheduled_venue_id, home_lineup_id, away_lineup_id
                           FROM matches WHERE id = $1`, [f.byeMatch]);
    expect([m.home_team_id, m.away_team_id]).toEqual([f.x, f.y]);
    expect(m.scheduled_venue_id).toBe(f.xVenue); // venue follows the new home team

    const lineups = (await pool.query(`SELECT id, team_id, player1_id FROM match_lineups WHERE match_id = $1 ORDER BY team_id`, [f.byeMatch])).rows;
    expect(lineups).toHaveLength(2); // the BYE's lineup is gone
    const yLineup = lineups.find((l) => l.team_id === f.y)!;
    const xLineup = lineups.find((l) => l.team_id === f.x)!;
    expect(yLineup.player1_id).toBe(f.member); // Y kept what its captain entered
    expect(m.away_lineup_id).toBe(yLineup.id);
    expect(m.home_lineup_id).toBe(xLineup.id);
    expect(xLineup.player1_id).toBeNull(); // X starts fresh

    expect(await row('SELECT count(*)::int AS n FROM matches WHERE id = $1', [f.dMatch])).toEqual({ n: 0 });
    expect((await row('SELECT status FROM teams WHERE id = $1', [f.dropped])).status).toBe('withdrawn');
    expect((await row('SELECT home_team_id, winner_team_id FROM matches WHERE id = $1', [f.played])))
      .toEqual({ home_team_id: f.dropped, winner_team_id: f.a }); // history kept
    expect(await abNow()).toEqual(abBefore); // excluded row untouched
  });

  it('moves a planned match onto the BYE (opponent will take the forfeit win)', async () => {
    const f = await buildFixture();
    await pool.query(`UPDATE matches SET status = 'completed', winner_team_id = $1 WHERE id = $2`, [f.y, f.byeMatch]);

    await apply(f, [], [f.dMatch], []);

    const m = await row('SELECT home_team_id, away_team_id FROM matches WHERE id = $1', [f.dMatch]);
    expect(m).toEqual({ home_team_id: f.bye, away_team_id: f.x });
    const teams = (await pool.query('SELECT team_id FROM match_lineups WHERE match_id = $1', [f.dMatch])).rows.map((r) => r.team_id).sort();
    expect(teams).toEqual([f.bye, f.x].sort());
  });

  it('rejects a stale plan (a lineup got locked) and changes nothing', async () => {
    const f = await buildFixture();
    await pool.query('UPDATE match_lineups SET locked = true WHERE match_id = $1 AND team_id = $2', [f.byeMatch, f.y]);

    await expect(apply(f, [{ matchId: f.byeMatch, homeTeamId: f.x, awayTeamId: f.y }], [], [f.dMatch]))
      .rejects.toThrow(/schedule changed/i);
    expect((await row('SELECT status FROM teams WHERE id = $1', [f.dropped])).status).toBe('active');
    expect(await row('SELECT count(*)::int AS n FROM matches WHERE id = $1', [f.dMatch])).toEqual({ n: 1 });
  });

  it("rejects a plan that misses one of the dropped team's matches and changes nothing", async () => {
    const f = await buildFixture();

    await expect(apply(f, [{ matchId: f.byeMatch, homeTeamId: f.x, awayTeamId: f.y }], [], []))
      .rejects.toThrow(/missed some/i);
    expect((await row('SELECT home_team_id FROM matches WHERE id = $1', [f.byeMatch])).home_team_id).toBe(f.y);
    expect((await row('SELECT status FROM teams WHERE id = $1', [f.dropped])).status).toBe('active');
  });
});
