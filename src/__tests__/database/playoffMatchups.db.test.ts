// @vitest-environment jsdom
/**
 * @fileoverview DB integration test for the playoff-review-page helpers
 * `arePlayoffMatchupsPopulated` (Unit 1) and `resetPlayoffMatchups` (Unit 2).
 *
 * Fixtures + assertions use raw pg; the behavior under test calls the real
 * helpers (supabase-js against the same local DB). Covers:
 *   - signal is FALSE while playoff matches are empty placeholders (null teams)
 *   - signal is TRUE once teams are filled in
 *   - reset NULLs the team IDs but PRESERVES the rows (count unchanged)
 *   - the reset → re-populate loop works (the loop that clearPlayoffMatches breaks)
 *
 * Run: `pnpm test:run src/__tests__/database/playoffMatchups`
 * Requires: local Supabase running.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { getPostgresPool, closePostgresPool } from '@/test/dbTestUtils';
import {
  arePlayoffMatchupsPopulated,
  resetPlayoffMatchups,
} from '@/utils/playoffGenerator';

describe('playoff matchup helpers (DB)', () => {
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
      await pool.query(`DELETE FROM leagues WHERE organization_id = $1`, [orgId]);
      await pool.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
    }
  });

  async function one(sql: string, params: unknown[]): Promise<string> {
    return (await pool.query<{ id: string }>(sql, params)).rows[0].id;
  }

  /** Build one league/season with a playoffs week + two teams + N placeholder matches. */
  async function fixture(matchCount: number) {
    const member = (
      await pool.query<{ id: string }>('SELECT id FROM members ORDER BY id LIMIT 1')
    ).rows[0].id;
    const orgId = await one(
      `INSERT INTO organizations (organization_name, organization_address, organization_city,
         organization_state, organization_zip_code, organization_email, organization_phone,
         stripe_customer_id, payment_method_id, card_last4, card_brand, expiry_month, expiry_year,
         billing_zip, created_by)
       VALUES ('PlayoffOrg','1 St','City','ST','00000','o@e.com','555','cus','pm','4242','visa',
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
    const playoffWeekId = await one(
      `INSERT INTO season_weeks (season_id, scheduled_date, week_name, week_type)
       VALUES ($1, CURRENT_DATE + 7, 'Playoffs', 'playoffs') RETURNING id`,
      [seasonId],
    );
    const teamA = await one(
      `INSERT INTO teams (season_id, league_id, team_name, roster_size, status)
       VALUES ($1, $2, 'Kings', 5, 'active') RETURNING id`,
      [seasonId, leagueId],
    );
    const teamB = await one(
      `INSERT INTO teams (season_id, league_id, team_name, roster_size, status)
       VALUES ($1, $2, 'Aces', 5, 'active') RETURNING id`,
      [seasonId, leagueId],
    );
    // Placeholder matches: NULL team IDs, exactly as schedule generation creates them.
    for (let n = 1; n <= matchCount; n++) {
      await pool.query(
        `INSERT INTO matches (season_id, season_week_id, match_number, home_team_id, away_team_id, status)
         VALUES ($1, $2, $3, NULL, NULL, 'scheduled')`,
        [seasonId, playoffWeekId, n],
      );
    }
    return { seasonId, playoffWeekId, teamA, teamB };
  }

  const rowCount = async (playoffWeekId: string) =>
    Number(
      (
        await pool.query<{ c: string }>(
          'SELECT COUNT(*)::int AS c FROM matches WHERE season_week_id = $1',
          [playoffWeekId],
        )
      ).rows[0].c,
    );

  it('signal is FALSE for empty placeholders, TRUE once teams are filled', async () => {
    const { playoffWeekId, teamA, teamB } = await fixture(2);

    expect(await arePlayoffMatchupsPopulated(playoffWeekId)).toBe(false);

    // Fill in one match's teams (simulating populate).
    await pool.query(
      `UPDATE matches SET home_team_id = $1, away_team_id = $2
       WHERE season_week_id = $3 AND match_number = 1`,
      [teamA, teamB, playoffWeekId],
    );

    expect(await arePlayoffMatchupsPopulated(playoffWeekId)).toBe(true);
  });

  it('reset NULLs team IDs but preserves the rows, and re-populate works again', async () => {
    const { seasonId, playoffWeekId, teamA, teamB } = await fixture(2);

    // Populate both matches.
    await pool.query(
      `UPDATE matches SET home_team_id = $1, away_team_id = $2 WHERE season_week_id = $3`,
      [teamA, teamB, playoffWeekId],
    );
    expect(await arePlayoffMatchupsPopulated(playoffWeekId)).toBe(true);
    const before = await rowCount(playoffWeekId);

    // Reset via the helper under test.
    const result = await resetPlayoffMatchups(seasonId, playoffWeekId);
    expect(result.success).toBe(true);
    expect(result.matchesReset).toBe(2);

    // Rows preserved (NOT deleted) — the key difference from clearPlayoffMatches.
    expect(await rowCount(playoffWeekId)).toBe(before);
    // Teams nulled → back to "not populated".
    expect(await arePlayoffMatchupsPopulated(playoffWeekId)).toBe(false);

    // Re-populate is possible because the placeholder rows survived.
    await pool.query(
      `UPDATE matches SET home_team_id = $1, away_team_id = $2 WHERE season_week_id = $3`,
      [teamA, teamB, playoffWeekId],
    );
    expect(await arePlayoffMatchupsPopulated(playoffWeekId)).toBe(true);
  });
});
