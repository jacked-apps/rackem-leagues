/**
 * @fileoverview DB integration test for sweep_auto_forfeits() — the daily
 * auto-forfeit sweep.
 *
 * Builds one league with five past/future matches covering every branch, calls
 * the function once, and asserts each outcome:
 *   - past-due, exactly one team captainless → forfeit to the captained team
 *   - past-due, both captained                → ignored (real game still to play)
 *   - past-due, neither captained             → skipped (double-forfeit, deferred)
 *   - future (not past-due), one captainless  → untouched
 *   - already completed                       → untouched
 *
 * Raw pg (no supabase-js writes → no jsdom pragma). The function is global
 * (all leagues), so we assert on our specific matches, not the return count,
 * and tear the fixture down explicitly.
 *
 * Run: `pnpm test:run src/__tests__/database/autoForfeitSweep`
 * Requires: local Supabase running with the 20260611000000 migration applied.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { getPostgresPool, closePostgresPool } from '@/test/dbTestUtils';

describe('sweep_auto_forfeits()', () => {
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
        `DELETE FROM match_games WHERE match_id IN (
           SELECT mt.id FROM matches mt JOIN seasons s ON s.id = mt.season_id
           JOIN leagues l ON l.id = s.league_id WHERE l.organization_id = $1)`,
        [orgId],
      );
      await pool.query(
        `DELETE FROM match_lineups WHERE match_id IN (
           SELECT mt.id FROM matches mt JOIN seasons s ON s.id = mt.season_id
           JOIN leagues l ON l.id = s.league_id WHERE l.organization_id = $1)`,
        [orgId],
      );
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
      await pool.query(`DELETE FROM leagues WHERE organization_id = $1`, [orgId]);
      await pool.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
    }
  });

  async function one(sql: string, params: unknown[]): Promise<string> {
    return (await pool.query<{ id: string }>(sql, params)).rows[0].id;
  }

  it('forfeits exactly the past-due, one-captainless matches', async () => {
    const member = (await pool.query<{ id: string }>('SELECT id FROM members ORDER BY id LIMIT 1')).rows[0].id;
    const orgId = await one(
      `INSERT INTO organizations (organization_name, organization_address, organization_city,
         organization_state, organization_zip_code, organization_email, organization_phone,
         stripe_customer_id, payment_method_id, card_last4, card_brand, expiry_month, expiry_year,
         billing_zip, created_by)
       VALUES ('SweepOrg','1 St','City','ST','00000','o@e.com','555','cus','pm','4242','visa',
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
    const pastWeek = await one(
      `INSERT INTO season_weeks (season_id, scheduled_date, week_name, week_type)
       VALUES ($1, CURRENT_DATE - 1, 'Past', 'regular') RETURNING id`,
      [seasonId],
    );
    const futureWeek = await one(
      `INSERT INTO season_weeks (season_id, scheduled_date, week_name, week_type)
       VALUES ($1, CURRENT_DATE + 1, 'Future', 'regular') RETURNING id`,
      [seasonId],
    );

    const team = async (name: string, captained: boolean) =>
      one(
        `INSERT INTO teams (season_id, league_id, team_name, roster_size, status, captain_id)
         VALUES ($1, $2, $3, 5, 'active', $4) RETURNING id`,
        [seasonId, leagueId, name, captained ? member : null],
      );
    const cap1 = await team('Cap1', true);
    const cap2 = await team('Cap2', true);
    const noCap1 = await team('NoCap1', false);
    const noCap2 = await team('NoCap2', false);

    const match = async (n: number, weekId: string, home: string, away: string, status = 'scheduled', winner: string | null = null) =>
      one(
        `INSERT INTO matches (season_id, season_week_id, match_number, home_team_id, away_team_id, status, winner_team_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [seasonId, weekId, n, home, away, status, winner],
      );

    const mForfeit = await match(1, pastWeek, cap1, noCap1); // → forfeit to cap1
    const mBoth = await match(2, pastWeek, cap1, cap2); // → ignored
    const mNeither = await match(3, pastWeek, noCap1, noCap2); // → skipped
    const mFuture = await match(4, futureWeek, cap2, noCap2); // → untouched (not past-due)
    const mDone = await match(5, pastWeek, cap2, noCap1, 'completed', cap2); // → untouched

    await pool.query('SELECT sweep_auto_forfeits()');

    const get = async (id: string) =>
      (await pool.query('SELECT status, winner_team_id FROM matches WHERE id = $1', [id])).rows[0];

    const forfeit = await get(mForfeit);
    expect(forfeit.status).toBe('completed');
    expect(forfeit.winner_team_id).toBe(cap1);

    const both = await get(mBoth);
    expect(both.status).toBe('scheduled');
    expect(both.winner_team_id).toBeNull();

    const neither = await get(mNeither);
    expect(neither.status).toBe('scheduled');
    expect(neither.winner_team_id).toBeNull();

    const future = await get(mFuture);
    expect(future.status).toBe('scheduled');
    expect(future.winner_team_id).toBeNull();

    const done = await get(mDone);
    expect(done.status).toBe('completed');
    expect(done.winner_team_id).toBe(cap2);
  });
});
