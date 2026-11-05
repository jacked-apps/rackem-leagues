/**
 * @fileoverview DB tests for the "start the match when both lineups lock"
 * trigger (migration 20261101223223_start_match_when_both_lineups_locked).
 *
 * Regression for the 2026-11-01 playoff night: a match went live (showed on
 * Live Matches, scoreboard stuck on "Loading…") as soon as the FIRST captain
 * locked. Pins down that `matches.started_at` is set only once the home AND
 * away lineups are both locked, and that a tiebreaker unlock → re-lock never
 * moves an existing start time.
 *
 * Each test runs inside a transaction on one pooled connection and rolls
 * back, so nothing is left in the local database. The create-match trigger
 * makes both empty lineup rows, exactly as in production.
 *
 * Run: `pnpm test:run src/__tests__/database/startMatchWhenBothLineupsLocked`
 * Requires: local Supabase running with the migration applied.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { getPostgresPool, closePostgresPool } from '@/test/dbTestUtils';

describe('start_match_when_both_lineups_locked trigger', () => {
  let pool: Pool;
  let db: PoolClient;

  beforeAll(() => {
    pool = getPostgresPool();
  });
  afterAll(async () => {
    await closePostgresPool();
  });
  beforeEach(async () => {
    db = await pool.connect();
    await db.query('BEGIN');
  });
  afterEach(async () => {
    await db.query('ROLLBACK');
    db.release();
  });

  async function one(sql: string, params: unknown[] = []): Promise<string> {
    return (await db.query<{ id: string }>(sql, params)).rows[0].id;
  }

  /** One scheduled Home-vs-Away match; the create trigger adds both lineups. */
  async function buildMatch() {
    const member = await one('SELECT id FROM members ORDER BY id LIMIT 1');
    const orgId = await one(
      `INSERT INTO organizations (organization_name, organization_address, organization_city,
         organization_state, organization_zip_code, organization_email, organization_phone,
         stripe_customer_id, payment_method_id, card_last4, card_brand, expiry_month, expiry_year,
         billing_zip, created_by)
       VALUES ('StartOrg','1 St','City','ST','00000','o@e.com','555','cus','pm','4242','visa',
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
    const homeId = await one(
      `INSERT INTO teams (season_id, league_id, team_name, roster_size, status)
       VALUES ($1, $2, 'Home', 5, 'active') RETURNING id`,
      [seasonId, leagueId],
    );
    const awayId = await one(
      `INSERT INTO teams (season_id, league_id, team_name, roster_size, status)
       VALUES ($1, $2, 'Away', 5, 'active') RETURNING id`,
      [seasonId, leagueId],
    );
    const matchId = await one(
      `INSERT INTO matches (season_id, season_week_id, match_number, home_team_id, away_team_id, status)
       VALUES ($1, $2, 1, $3, $4, 'scheduled') RETURNING id`,
      [seasonId, weekId, homeId, awayId],
    );
    return { matchId, homeId, awayId };
  }

  async function setLocked(matchId: string, teamId: string, locked: boolean) {
    await db.query(
      'UPDATE match_lineups SET locked = $3 WHERE match_id = $1 AND team_id = $2',
      [matchId, teamId, locked],
    );
  }

  async function startedAt(matchId: string): Promise<Date | null> {
    const { rows } = await db.query<{ started_at: Date | null }>(
      'SELECT started_at FROM matches WHERE id = $1',
      [matchId],
    );
    return rows[0].started_at;
  }

  it('does NOT start the match when only the first team locks', async () => {
    const { matchId, homeId } = await buildMatch();
    await setLocked(matchId, homeId, true);
    expect(await startedAt(matchId)).toBeNull();
  });

  it('starts the match once the second team locks (either order)', async () => {
    const { matchId, homeId, awayId } = await buildMatch();
    await setLocked(matchId, awayId, true);
    expect(await startedAt(matchId)).toBeNull();
    await setLocked(matchId, homeId, true);
    expect(await startedAt(matchId)).not.toBeNull();
  });

  it('does not start after lock → unlock → other team locks', async () => {
    const { matchId, homeId, awayId } = await buildMatch();
    await setLocked(matchId, homeId, true);
    await setLocked(matchId, homeId, false);
    await setLocked(matchId, awayId, true);
    expect(await startedAt(matchId)).toBeNull();
  });

  it('keeps the original start time through a tiebreaker unlock → re-lock', async () => {
    const { matchId, homeId, awayId } = await buildMatch();
    await setLocked(matchId, homeId, true);
    await setLocked(matchId, awayId, true);
    // Pin a known past start so a re-stamp would be visible.
    await db.query(
      `UPDATE matches SET started_at = '2026-01-08 19:00:00+00' WHERE id = $1`,
      [matchId],
    );
    await setLocked(matchId, homeId, false);
    await setLocked(matchId, homeId, true);
    expect((await startedAt(matchId))?.toISOString()).toBe('2026-01-08T19:00:00.000Z');
  });
});
