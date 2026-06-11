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
 * Each test runs in a BEGIN/ROLLBACK transaction (raw pg — no supabase-js
 * writes, so no jsdom pragma needed). Fixtures are discovered from local seed
 * data; tests skip with a clear notice when no suitable fixture exists.
 *
 * Run: `pnpm test:run src/__tests__/database/swapPlayerInLineupRpc`
 * Requires: local Supabase running (`pnpm run db:start`) with seed data, and
 * the 20260602000000 + 20260602000001 migrations applied.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { getPostgresPool, closePostgresPool } from '@/test/dbTestUtils';

/** Discovered fixture: a match + home lineup with a swappable player at pos 1. */
type SwapFixture = {
  matchId: string;
  homeLineupId: string;
  oldPlayerId: string;
  newPlayerId: string;
};

const THRESHOLDS = JSON.stringify({
  home_to_win: 13,
  home_to_tie: 12,
  home_to_lose: 11,
  away_to_win: 14,
  away_to_tie: null,
  away_to_lose: 13,
});

function resolutionFor(fixture: SwapFixture): string {
  return JSON.stringify({
    kind: 'approved',
    by_member_id: null,
    resolved_at: '2026-06-02T00:00:00.000Z',
    position: 1,
    old_player_id: fixture.oldPlayerId,
    new_player_id: fixture.newPlayerId,
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

  /** Borrow a client, run inside a transaction, always ROLLBACK. */
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

  /** Find a match whose home lineup has player1 set + an away lineup, plus a
   *  distinct member to swap in. Returns null on a fixture-less DB. */
  async function findFixture(c: PoolClient): Promise<SwapFixture | null> {
    const r = await c.query<{ match_id: string; home_lineup_id: string; old_player_id: string }>(`
      SELECT m.id AS match_id, hl.id AS home_lineup_id, hl.player1_id AS old_player_id
      FROM matches m
      JOIN match_lineups hl ON hl.match_id = m.id AND hl.team_id = m.home_team_id
      JOIN match_lineups al ON al.match_id = m.id AND al.team_id = m.away_team_id
      WHERE hl.player1_id IS NOT NULL
      LIMIT 1
    `);
    if (!r.rows[0]) return null;

    const np = await c.query<{ id: string }>(
      `SELECT id FROM members WHERE id <> $1 LIMIT 1`,
      [r.rows[0].old_player_id],
    );
    if (!np.rows[0]) return null;

    return {
      matchId: r.rows[0].match_id,
      homeLineupId: r.rows[0].home_lineup_id,
      oldPlayerId: r.rows[0].old_player_id,
      newPlayerId: np.rows[0].id,
    };
  }

  /** Put the match in progress and open a pending swap at position 1. */
  async function armSwap(c: PoolClient, f: SwapFixture, handicap = 5): Promise<void> {
    await c.query(`UPDATE matches SET status = 'in_progress' WHERE id = $1`, [f.matchId]);
    await c.query(
      `UPDATE match_lineups
          SET swap_position = 1,
              swap_new_player_id = $2,
              swap_new_player_handicap = $3,
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
      const f = await findFixture(c);
      if (!f) return void console.warn('[skip] no suitable match fixture in local DB');

      await armSwap(c, f);
      await callRpc(c, f);

      const lineup = (
        await c.query(
          `SELECT player1_id, player1_handicap, swap_position, swap_new_player_id,
                  swap_requested_at, swap_last_resolution
             FROM match_lineups WHERE id = $1`,
          [f.homeLineupId],
        )
      ).rows[0];
      expect(lineup.player1_id).toBe(f.newPlayerId);
      expect(Number(lineup.player1_handicap)).toBe(5);
      expect(lineup.swap_position).toBeNull();
      expect(lineup.swap_new_player_id).toBeNull();
      expect(lineup.swap_requested_at).toBeNull();
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
      const f = await findFixture(c);
      if (!f) return void console.warn('[skip] no fixture');

      const unplayedBefore = (
        await c.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM match_games
             WHERE match_id = $1 AND home_player_id = $2 AND winner_player_id IS NULL`,
          [f.matchId, f.oldPlayerId],
        )
      ).rows[0].n;
      if (unplayedBefore === 0)
        return void console.warn('[skip] outgoing player has no unplayed games to cascade');

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
      expect(newAssigned).toBeGreaterThanOrEqual(unplayedBefore);
    });
  });

  it('rejects a double approve (second call finds no pending swap)', async () => {
    await inTransaction(async (c) => {
      const f = await findFixture(c);
      if (!f) return void console.warn('[skip] no fixture');

      await armSwap(c, f);
      await callRpc(c, f); // first resolves
      await expect(callRpc(c, f)).rejects.toThrow(/No pending lineup swap/);
    });
  });

  it('rejects when the match is no longer in progress', async () => {
    await inTransaction(async (c) => {
      const f = await findFixture(c);
      if (!f) return void console.warn('[skip] no fixture');

      await armSwap(c, f);
      await c.query(`UPDATE matches SET status = 'completed' WHERE id = $1`, [f.matchId]);
      await expect(callRpc(c, f)).rejects.toThrow(/no longer in progress/);
    });
  });

  it('rejects when the outgoing player has already played a game', async () => {
    await inTransaction(async (c) => {
      const f = await findFixture(c);
      if (!f) return void console.warn('[skip] no fixture');

      const game = (
        await c.query<{ id: string }>(
          `SELECT id FROM match_games WHERE match_id = $1 AND home_player_id = $2 LIMIT 1`,
          [f.matchId, f.oldPlayerId],
        )
      ).rows[0];
      if (!game) return void console.warn('[skip] outgoing player has no game rows');

      await c.query(`UPDATE match_games SET winner_player_id = $2 WHERE id = $1`, [
        game.id,
        f.oldPlayerId,
      ]);
      await armSwap(c, f);
      await expect(callRpc(c, f)).rejects.toThrow(/already played games/);
    });
  });
});
