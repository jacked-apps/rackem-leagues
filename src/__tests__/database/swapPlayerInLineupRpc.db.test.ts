/**
 * @fileoverview DB integration tests for the swap_player_in_lineup RPC.
 *
 * Verifies the atomic mid-match swap: apply the new player at its position,
 * cascade into UNPLAYED match_games only, write thresholds, stamp the audit
 * JSONB — plus the three data-integrity guards (pending swap exists, match in
 * progress, outgoing player has no completed games).
 *
 * Per memory feedback_gate_ui_relax_rls, the RPC does NOT police caller
 * identity, so these tests never exercise an auth path — only data integrity.
 *
 * The local seed has no matches, so each test builds a self-contained match
 * fixture (org → league → season → week → 2 teams → match → 2 lineups → games)
 * inside a BEGIN/ROLLBACK transaction (raw pg — no supabase-js writes, so no
 * jsdom pragma needed). Nothing leaks between tests or into the real DB.
 *
 * Run: `pnpm test:run src/__tests__/database/swapPlayerInLineupRpc`
 * Requires: local Supabase running (`pnpm run db:start` / `pnpm db:reset`).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { getPostgresPool, closePostgresPool } from '@/test/dbTestUtils';

type SwapFixture = {
  matchId: string;
  homeTeamId: string;
  homeLineupId: string;
  oldPlayerId: string;
  newPlayerId: string;
  awayPlayerId: string;
};

const THRESHOLDS = JSON.stringify({
  home_to_win: 13,
  home_to_tie: 12,
  home_to_lose: 11,
  away_to_win: 14,
  away_to_tie: null,
  away_to_lose: 13,
});

function resolutionFor(f: SwapFixture): string {
  return JSON.stringify({
    kind: 'approved',
    by_member_id: f.newPlayerId,
    resolved_at: '2026-06-02T00:00:00.000Z',
    position: 1,
    old_player_id: f.oldPlayerId,
    new_player_id: f.newPlayerId,
  });
}

describe('swap_player_in_lineup RPC', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = getPostgresPool();
  });

  afterAll(async () => {
    await closePostgresPool();
  });

  async function inTransaction<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      return await fn(client);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  }

  /** One-shot insert helper returning the new row's id. */
  async function ins(c: PoolClient, sql: string, params: unknown[]): Promise<string> {
    const r = await c.query<{ id: string }>(sql, params);
    return r.rows[0].id;
  }

  /**
   * Build a complete in-progress match with a home lineup (old player at
   * position 1) + away lineup + two UNPLAYED home games. Reuses three seed
   * members as the players.
   */
  async function seedSwapFixture(c: PoolClient): Promise<SwapFixture> {
    const members = (
      await c.query<{ id: string }>('SELECT id FROM members ORDER BY id LIMIT 3')
    ).rows;
    if (members.length < 3) throw new Error('need >=3 seed members for the fixture');
    const [oldPlayerId, newPlayerId, awayPlayerId] = members.map((m) => m.id);

    const orgId = await ins(
      c,
      `INSERT INTO organizations (organization_name, organization_address, organization_city,
         organization_state, organization_zip_code, organization_email, organization_phone,
         stripe_customer_id, payment_method_id, card_last4, card_brand, expiry_month, expiry_year,
         billing_zip, created_by)
       VALUES ('Test Org','1 St','City','ST','00000','o@e.com','555','cus','pm','4242','visa',
         12, 2030, '00000', $1) RETURNING id`,
      [oldPlayerId],
    );
    const leagueId = await ins(
      c,
      `INSERT INTO leagues (organization_id, game_type, day_of_week, league_start_date)
       VALUES ($1, 'eight_ball', 'monday', '2026-01-01') RETURNING id`,
      [orgId],
    );
    const seasonId = await ins(
      c,
      `INSERT INTO seasons (league_id, season_name, start_date, end_date, season_length)
       VALUES ($1, 'S1', '2026-01-01', '2026-04-01', 12) RETURNING id`,
      [leagueId],
    );
    const weekId = await ins(
      c,
      `INSERT INTO season_weeks (season_id, scheduled_date, week_name, week_type)
       VALUES ($1, '2026-01-08', 'Week 1', 'regular') RETURNING id`,
      [seasonId],
    );
    const homeTeamId = await ins(
      c,
      `INSERT INTO teams (season_id, league_id, team_name, roster_size)
       VALUES ($1, $2, 'Home', 5) RETURNING id`,
      [seasonId, leagueId],
    );
    const awayTeamId = await ins(
      c,
      `INSERT INTO teams (season_id, league_id, team_name, roster_size)
       VALUES ($1, $2, 'Away', 5) RETURNING id`,
      [seasonId, leagueId],
    );
    const matchId = await ins(
      c,
      `INSERT INTO matches (season_id, season_week_id, match_number, home_team_id, away_team_id, status)
       VALUES ($1, $2, 1, $3, $4, 'in_progress') RETURNING id`,
      [seasonId, weekId, homeTeamId, awayTeamId],
    );
    // Inserting the match auto-creates a lineup row per team (DB trigger), so
    // populate those rather than INSERTing (which collides on the
    // (match_id, team_id) unique key).
    const homeLineupId = (
      await c.query<{ id: string }>(
        `UPDATE match_lineups
            SET player1_id = $3, player1_handicap = 5, player2_handicap = 5, player3_handicap = 5
          WHERE match_id = $1 AND team_id = $2 RETURNING id`,
        [matchId, homeTeamId, oldPlayerId],
      )
    ).rows[0].id;
    await c.query(
      `UPDATE match_lineups
          SET player1_id = $3, player1_handicap = 5, player2_handicap = 5, player3_handicap = 5
        WHERE match_id = $1 AND team_id = $2`,
      [matchId, awayTeamId, awayPlayerId],
    );
    // Two unplayed home games for the outgoing player (winner_player_id NULL).
    for (const n of [1, 2]) {
      await c.query(
        `INSERT INTO match_games (match_id, game_number, home_action, away_action, game_type,
           home_player_id, away_player_id)
         VALUES ($1, $2, 'breaks', 'racks', 'eight_ball', $3, $4)`,
        [matchId, n, oldPlayerId, awayPlayerId],
      );
    }

    return { matchId, homeTeamId, homeLineupId, oldPlayerId, newPlayerId, awayPlayerId };
  }

  /** Open a pending swap at position 1 on the home lineup. */
  async function armSwap(c: PoolClient, f: SwapFixture, handicap = 7): Promise<void> {
    await c.query(
      `UPDATE match_lineups
          SET swap_position = 1, swap_new_player_id = $2, swap_new_player_handicap = $3,
              swap_requested_at = now()
        WHERE id = $1`,
      [f.homeLineupId, f.newPlayerId, handicap],
    );
  }

  function callRpc(c: PoolClient, f: SwapFixture) {
    return c.query(`SELECT swap_player_in_lineup($1::uuid, $2::jsonb, $3::jsonb)`, [
      f.homeLineupId,
      THRESHOLDS,
      resolutionFor(f),
    ]);
  }

  it('applies the swap, clears request fields, stamps audit, writes thresholds', async () => {
    await inTransaction(async (c) => {
      const f = await seedSwapFixture(c);
      await armSwap(c, f);
      await callRpc(c, f);

      const lineup = (
        await c.query(
          `SELECT player1_id, player1_handicap, swap_position, swap_new_player_id,
                  swap_requested_at, swap_requested_by_member_id, swap_last_resolution
             FROM match_lineups WHERE id = $1`,
          [f.homeLineupId],
        )
      ).rows[0];
      expect(lineup.player1_id).toBe(f.newPlayerId);
      expect(Number(lineup.player1_handicap)).toBe(7);
      expect(lineup.swap_position).toBeNull();
      expect(lineup.swap_new_player_id).toBeNull();
      expect(lineup.swap_requested_at).toBeNull();
      expect(lineup.swap_requested_by_member_id).toBeNull();
      expect(lineup.swap_last_resolution).toMatchObject({ kind: 'approved', position: 1 });

      const match = (
        await c.query(`SELECT home_to_win, home_to_tie, away_to_tie FROM matches WHERE id = $1`, [
          f.matchId,
        ])
      ).rows[0];
      expect(match.home_to_win).toBe(13);
      expect(match.home_to_tie).toBe(12);
      expect(match.away_to_tie).toBeNull();
    });
  });

  it('cascades the new player into the outgoing player\'s UNPLAYED games', async () => {
    await inTransaction(async (c) => {
      const f = await seedSwapFixture(c);
      await armSwap(c, f);
      await callRpc(c, f);

      const oldRemaining = (
        await c.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM match_games
             WHERE match_id = $1 AND home_player_id = $2 AND winner_player_id IS NULL`,
          [f.matchId, f.oldPlayerId],
        )
      ).rows[0].n;
      const newAssigned = (
        await c.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM match_games
             WHERE match_id = $1 AND home_player_id = $2 AND winner_player_id IS NULL`,
          [f.matchId, f.newPlayerId],
        )
      ).rows[0].n;

      expect(oldRemaining).toBe(0);
      expect(newAssigned).toBe(2);
    });
  });

  it('rejects a double approve (second call finds no pending swap)', async () => {
    await inTransaction(async (c) => {
      const f = await seedSwapFixture(c);
      await armSwap(c, f);
      await callRpc(c, f); // first resolves
      await expect(callRpc(c, f)).rejects.toThrow(/No pending lineup swap/);
    });
  });

  it('rejects when the match is no longer in progress', async () => {
    await inTransaction(async (c) => {
      const f = await seedSwapFixture(c);
      await armSwap(c, f);
      await c.query(`UPDATE matches SET status = 'completed' WHERE id = $1`, [f.matchId]);
      await expect(callRpc(c, f)).rejects.toThrow(/no longer in progress/);
    });
  });

  it('rejects when the outgoing player has already played a game', async () => {
    await inTransaction(async (c) => {
      const f = await seedSwapFixture(c);
      // Complete one of the outgoing player's games.
      await c.query(
        `UPDATE match_games SET winner_player_id = $2
           WHERE match_id = $1 AND home_player_id = $2 AND game_number = 1`,
        [f.matchId, f.oldPlayerId],
      );
      await armSwap(c, f);
      await expect(callRpc(c, f)).rejects.toThrow(/already played games/);
    });
  });
});
