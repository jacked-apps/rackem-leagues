/**
 * @fileoverview DB integration test for assign_tables_for_week() skipping BYE
 * matches.
 *
 * A BYE is a real `teams` row (`status='bye'`); a matchup containing it is not a
 * real match and must NOT be assigned a table — nor may it consume a table slot
 * that a real match should get. Builds one league + one venue (3 tables) + one
 * week with three matches in match_number order:
 *   1. real vs real  → table 1
 *   2. real vs BYE   → NO table (NULL), and consumes no slot
 *   3. real vs real  → table 2  (proves the bye didn't burn table 2)
 *
 * Raw pg (no supabase-js writes → no jsdom pragma). Fixture is torn down
 * explicitly in afterEach.
 *
 * Run: `pnpm test:run src/__tests__/database/byeMatchTableAssignment`
 * Requires: local Supabase running with the 20260615000000 migration applied.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { getPostgresPool, closePostgresPool } from '@/test/dbTestUtils';

describe('assign_tables_for_week() — BYE matches', () => {
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
      await pool.query(
        `DELETE FROM matches WHERE season_id IN (
           SELECT s.id FROM seasons s JOIN leagues l ON l.id = s.league_id WHERE l.organization_id = $1)`,
        [orgId],
      );
      await pool.query(
        `DELETE FROM teams WHERE season_id IN (
           SELECT s.id FROM seasons s JOIN leagues l ON l.id = s.league_id WHERE l.organization_id = $1)`,
        [orgId],
      );
      await pool.query(
        `DELETE FROM season_weeks WHERE season_id IN (
           SELECT s.id FROM seasons s JOIN leagues l ON l.id = s.league_id WHERE l.organization_id = $1)`,
        [orgId],
      );
      await pool.query(
        `DELETE FROM seasons WHERE league_id IN (SELECT id FROM leagues WHERE organization_id = $1)`,
        [orgId],
      );
      await pool.query(
        `DELETE FROM league_venues WHERE league_id IN (SELECT id FROM leagues WHERE organization_id = $1)`,
        [orgId],
      );
      await pool.query(`DELETE FROM leagues WHERE organization_id = $1`, [orgId]);
      await pool.query(`DELETE FROM venues WHERE organization_id = $1`, [orgId]);
      await pool.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
    }
  });

  async function one(sql: string, params: unknown[]): Promise<string> {
    return (await pool.query<{ id: string }>(sql, params)).rows[0].id;
  }

  it('assigns tables to real matches only; a BYE match gets none and burns no slot', async () => {
    const member = (await pool.query<{ id: string }>('SELECT id FROM members ORDER BY id LIMIT 1')).rows[0].id;
    const orgId = await one(
      `INSERT INTO organizations (organization_name, organization_address, organization_city,
         organization_state, organization_zip_code, organization_email, organization_phone,
         stripe_customer_id, payment_method_id, card_last4, card_brand, expiry_month, expiry_year,
         billing_zip, created_by)
       VALUES ('ByeTableOrg','1 St','City','ST','00000','o@e.com','555','cus','pm','4242','visa',
         12, 2030, '00000', $1) RETURNING id`,
      [member],
    );
    orgIds.push(orgId);
    const leagueId = await one(
      `INSERT INTO leagues (organization_id, game_type, day_of_week, league_start_date)
       VALUES ($1, 'eight_ball', 'monday', '2026-01-01') RETURNING id`,
      [orgId],
    );
    const seasonId = await one(
      `INSERT INTO seasons (league_id, season_name, start_date, end_date, season_length)
       VALUES ($1, 'S1', '2026-01-01', '2026-12-01', 12) RETURNING id`,
      [leagueId],
    );
    const weekId = await one(
      `INSERT INTO season_weeks (season_id, scheduled_date, week_name, week_type)
       VALUES ($1, '2026-02-02', 'Wk1', 'regular') RETURNING id`,
      [seasonId],
    );

    // One venue with three tables (numbers 1,2,3), wired to the league.
    // total_tables is generated from the *_table_numbers arrays, so seed one.
    const venueId = await one(
      `INSERT INTO venues (organization_id, name, street_address, city, state, zip_code, phone,
         bar_box_table_numbers)
       VALUES ($1, 'The Hall', '2 Rd', 'City', 'ST', '00000', '555', '{1,2,3}') RETURNING id`,
      [orgId],
    );
    await pool.query(
      `INSERT INTO league_venues (league_id, venue_id, available_bar_box_tables,
         available_regulation_tables, available_table_numbers)
       VALUES ($1, $2, 3, 0, '{1,2,3}')`,
      [leagueId, venueId],
    );

    const team = async (name: string, status: 'active' | 'bye') =>
      one(
        `INSERT INTO teams (season_id, league_id, team_name, roster_size, status, captain_id)
         VALUES ($1, $2, $3, 5, $4, $5) RETURNING id`,
        [seasonId, leagueId, name, status, status === 'bye' ? null : member],
      );
    const a = await team('A', 'active');
    const b = await team('B', 'active');
    const c = await team('C', 'active');
    const d = await team('D', 'active');
    const e = await team('E', 'active');
    const bye = await team('BYE', 'bye');

    // Three matches in match_number order; each home team's venue is set so the
    // assigner processes it.
    const match = async (n: number, home: string, away: string) =>
      one(
        `INSERT INTO matches (season_id, season_week_id, match_number, home_team_id, away_team_id,
           status, scheduled_venue_id)
         VALUES ($1, $2, $3, $4, $5, 'scheduled', $6) RETURNING id`,
        [seasonId, weekId, n, home, away, venueId],
      );
    const mReal1 = await match(1, a, b); // → table 1
    const mBye = await match(2, c, bye); // → no table
    const mReal2 = await match(3, d, e); // → table 2 (NOT 3 — bye burned no slot)

    await pool.query('SELECT assign_tables_for_week($1)', [weekId]);

    const tableOf = async (id: string) =>
      (await pool.query<{ assigned_table_number: number | null }>(
        'SELECT assigned_table_number FROM matches WHERE id = $1',
        [id],
      )).rows[0].assigned_table_number;

    expect(await tableOf(mReal1)).toBe(1);
    expect(await tableOf(mBye)).toBeNull();
    expect(await tableOf(mReal2)).toBe(2);
  });
});
