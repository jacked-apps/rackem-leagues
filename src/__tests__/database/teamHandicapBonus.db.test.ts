// @vitest-environment jsdom
/**
 * @fileoverview Real-database test for `getTeamHandicapBonus`.
 *
 * The unit test mocks supabase, which can't tell whether the select string,
 * the week join or the resolved-preferences read actually work. This runs the
 * real queries against local Postgres:
 *  - a REGULAR-week match gets the bonus (home 4 wins vs away 0 → +2),
 *  - a PLAYOFF-week match between the same teams gets 0 (Ed, 2026-11-01),
 *  - a league whose preferences say `reduced` divides by 3 (→ +1).
 *
 * Fixture is committed with raw pg (supabase-js can't see an open pg
 * transaction) and torn down in afterAll.
 *
 * Run: `pnpm test:run src/__tests__/database/teamHandicapBonus`
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { getPostgresPool, closePostgresPool } from '@/test/dbTestUtils';
import { getTeamHandicapBonus } from '@/utils/getTeamHandicapBonus';

describe('getTeamHandicapBonus against the real database', () => {
  let pool: Pool;
  const ids: Record<string, string> = {};

  async function one(sql: string, params: unknown[] = []): Promise<string> {
    return (await pool.query<{ id: string }>(sql, params)).rows[0].id;
  }

  beforeAll(async () => {
    pool = getPostgresPool();
    const member = await one('SELECT id FROM members ORDER BY id LIMIT 1');
    ids.org = await one(
      `INSERT INTO organizations (organization_name, organization_address, organization_city,
         organization_state, organization_zip_code, organization_email, organization_phone,
         stripe_customer_id, payment_method_id, card_last4, card_brand, expiry_month, expiry_year,
         billing_zip, created_by)
       VALUES ('BonusOrg','1 St','City','ST','00000','o@e.com','555','cus','pm','4242','visa',
         12, 2030, '00000', $1) RETURNING id`,
      [member],
    );
    ids.league = await one(
      `INSERT INTO leagues (organization_id, game_type, day_of_week, league_start_date)
       VALUES ($1, 'eight_ball', 'monday', '2026-01-01') RETURNING id`,
      [ids.org],
    );
    ids.season = await one(
      `INSERT INTO seasons (league_id, season_name, start_date, end_date, season_length)
       VALUES ($1, 'S1', '2026-01-01', '2026-04-01', 12) RETURNING id`,
      [ids.league],
    );
    ids.regularWeek = await one(
      `INSERT INTO season_weeks (season_id, scheduled_date, week_name, week_type)
       VALUES ($1, '2026-01-08', 'Week 1', 'regular') RETURNING id`,
      [ids.season],
    );
    ids.playoffWeek = await one(
      `INSERT INTO season_weeks (season_id, scheduled_date, week_name, week_type)
       VALUES ($1, '2026-03-26', 'Playoffs', 'playoffs') RETURNING id`,
      [ids.season],
    );
    const team = (name: string) =>
      one(
        `INSERT INTO teams (season_id, league_id, team_name, roster_size, status)
         VALUES ($1, $2, $3, 5, 'active') RETURNING id`,
        [ids.season, ids.league, name],
      );
    ids.home = await team('Home');
    ids.away = await team('Away');
    ids.other = await team('Other');

    const match = (week: string, home: string, away: string, n: number) =>
      one(
        `INSERT INTO matches (season_id, season_week_id, match_number, home_team_id, away_team_id, status)
         VALUES ($1, $2, $3, $4, $5, 'scheduled') RETURNING id`,
        [ids.season, week, n, home, away],
      );
    // Home has won 4 completed matches (against Other); Away has won none.
    for (let n = 1; n <= 4; n++) {
      const id = await match(ids.regularWeek, ids.home, ids.other, 100 + n);
      await pool.query(
        `UPDATE matches SET status = 'completed', winner_team_id = $2 WHERE id = $1`,
        [id, ids.home],
      );
    }
    ids.regularMatch = await match(ids.regularWeek, ids.home, ids.away, 1);
    ids.playoffMatch = await match(ids.playoffWeek, ids.home, ids.away, 2);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM preferences WHERE entity_id = $1', [ids.league]);
    await pool.query('DELETE FROM match_games WHERE match_id IN (SELECT id FROM matches WHERE season_id = $1)', [ids.season]);
    await pool.query('DELETE FROM match_lineups WHERE match_id IN (SELECT id FROM matches WHERE season_id = $1)', [ids.season]);
    await pool.query('DELETE FROM matches WHERE season_id = $1', [ids.season]);
    await pool.query('DELETE FROM teams WHERE season_id = $1', [ids.season]);
    await pool.query('DELETE FROM season_weeks WHERE season_id = $1', [ids.season]);
    await pool.query('DELETE FROM seasons WHERE id = $1', [ids.season]);
    await pool.query('DELETE FROM leagues WHERE id = $1', [ids.league]);
    await pool.query('DELETE FROM organizations WHERE id = $1', [ids.org]);
    await closePostgresPool();
  });

  it('regular-week match: home 4–0 in a standard league → +2', async () => {
    expect(await getTeamHandicapBonus(ids.regularMatch, 'points')).toBe(2);
  });

  it('PLAYOFF-week match between the same teams → 0', async () => {
    expect(await getTeamHandicapBonus(ids.playoffMatch, 'points')).toBe(0);
  });

  it("league set to 'reduced' divides by 3 → +1", async () => {
    // A league gets its preferences row automatically when it's created.
    await pool.query(
      `UPDATE preferences SET team_handicap_variant = 'reduced'
        WHERE entity_type = 'league' AND entity_id = $1`,
      [ids.league],
    );
    expect(await getTeamHandicapBonus(ids.regularMatch, 'points')).toBe(1);
    expect(await getTeamHandicapBonus(ids.playoffMatch, 'points')).toBe(0);
  });
});
