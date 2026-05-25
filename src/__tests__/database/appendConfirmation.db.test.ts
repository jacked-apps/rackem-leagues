/**
 * @fileoverview Behavior tests for `appendConfirmation` (many-eyes Unit 2),
 * exercised against the local DB via the real app supabase singleton (which
 * `.env` points at localhost:54321).
 *
 * Characterization-first intent: the sacred guarantee is that recording a vouch
 * NEVER touches `match_games` (officiality + counting stay exactly as they
 * were). These tests pin that, plus the append-only / no-op / never-throw
 * contract:
 *   - a confirm appends a full-result row; officiality row is byte-identical after
 *   - exact re-tap → no-op; change of mind → new row (history)
 *   - extra witnesses (different members) accrue without touching match_games
 *   - a vacate marker is recorded
 *   - finalized match → no-op; missing confirmer → no-op
 *   - any failure is swallowed (best-effort), never thrown into scoring
 *
 * Runs in the `db` vitest project (sequential, jsdom). Raw `pg` is used for
 * setup/assertions/cleanup so we read ground truth straight from Postgres.
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import {
  appendConfirmation,
  type ConfirmationResult,
} from '@/api/mutations/appendConfirmation';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';

const baseResult: ConfirmationResult = {
  winnerTeamId: null,
  winnerPlayerId: null,
  breakAndRun: false,
  goldenBreak: false,
  breakFouled: false,
  runout: false,
  winByForfeit: false,
  winnerValue: null,
  loserValue: null,
};

describe('appendConfirmation (many-eyes Unit 2)', () => {
  let gameId: string;
  let matchId: string;
  let gameNumber: number;
  let homeTeamId: string;
  let memberA: string;
  let memberB: string;

  beforeAll(async () => {
    // A real, non-finalized match + one of its games + two members.
    const games = await executeSql(
      `SELECT mg.id AS game_id, mg.match_id, mg.game_number, m.home_team_id
         FROM public.match_games mg
         JOIN public.matches m ON m.id = mg.match_id
        WHERE m.status <> 'completed'
        LIMIT 1`
    );
    const members = await executeSql(`SELECT id FROM public.members LIMIT 2`);

    if (games.length === 0 || members.length < 2) {
      throw new Error(
        'appendConfirmation.db.test requires seed data: a non-completed match with a game and at least two members.'
      );
    }

    gameId = games[0].game_id;
    matchId = games[0].match_id;
    gameNumber = games[0].game_number;
    homeTeamId = games[0].home_team_id;
    memberA = members[0].id;
    memberB = members[1].id;
  });

  // Wipe only the rows this suite creates, between tests, so counts are clean.
  afterEach(async () => {
    await executeSql(
      `DELETE FROM public.game_confirmations
         WHERE game_id = $1 AND confirmer_id = ANY($2::uuid[])`,
      [gameId, [memberA, memberB]]
    );
  });

  afterAll(async () => {
    await closePostgresPool();
  });

  it('appends a confirm vouch row carrying the full result snapshot', async () => {
    const ok = await appendConfirmation({
      gameId,
      matchId,
      gameNumber,
      confirmerId: memberA,
      side: 'home',
      result: {
        ...baseResult,
        winnerTeamId: homeTeamId,
        breakAndRun: true,
        winnerValue: 7,
        loserValue: 3,
      },
    });
    expect(ok).toBe(true);

    const rows = await executeSql(
      `SELECT action, side, break_and_run, winner_value, loser_value, winner_team_id
         FROM public.game_confirmations
        WHERE game_id = $1 AND confirmer_id = $2`,
      [gameId, memberA]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].action).toBe('confirm');
    expect(rows[0].side).toBe('home');
    expect(rows[0].break_and_run).toBe(true);
    expect(rows[0].winner_value).toBe(7);
    expect(rows[0].loser_value).toBe(3);
    expect(rows[0].winner_team_id).toBe(homeTeamId);
  });

  it('does NOT modify the match_games row (officiality preserved)', async () => {
    const before = (
      await executeSql(
        `SELECT confirmed_by_home, confirmed_by_away, winner_team_id, winner_player_id, updated_at
           FROM public.match_games WHERE id = $1`,
        [gameId]
      )
    )[0];

    await appendConfirmation({
      gameId,
      matchId,
      gameNumber,
      confirmerId: memberA,
      side: 'home',
      result: { ...baseResult, winnerTeamId: homeTeamId, winnerValue: 9 },
    });

    const after = (
      await executeSql(
        `SELECT confirmed_by_home, confirmed_by_away, winner_team_id, winner_player_id, updated_at
           FROM public.match_games WHERE id = $1`,
        [gameId]
      )
    )[0];

    expect(after).toEqual(before);
  });

  it('no-ops on an exact duplicate of my latest vouch', async () => {
    const r: ConfirmationResult = { ...baseResult, winnerTeamId: homeTeamId, winnerValue: 5 };
    expect(
      await appendConfirmation({ gameId, matchId, gameNumber, confirmerId: memberA, side: 'home', result: r })
    ).toBe(true);
    expect(
      await appendConfirmation({ gameId, matchId, gameNumber, confirmerId: memberA, side: 'home', result: r })
    ).toBe(false);

    const rows = await executeSql(
      `SELECT 1 FROM public.game_confirmations WHERE game_id = $1 AND confirmer_id = $2`,
      [gameId, memberA]
    );
    expect(rows.length).toBe(1);
  });

  it('appends a new row on a change of mind (different result)', async () => {
    await appendConfirmation({
      gameId, matchId, gameNumber, confirmerId: memberA, side: 'home',
      result: { ...baseResult, winnerValue: 5 },
    });
    const ok = await appendConfirmation({
      gameId, matchId, gameNumber, confirmerId: memberA, side: 'home',
      result: { ...baseResult, winnerValue: 6 },
    });
    expect(ok).toBe(true);

    const rows = await executeSql(
      `SELECT 1 FROM public.game_confirmations WHERE game_id = $1 AND confirmer_id = $2`,
      [gameId, memberA]
    );
    expect(rows.length).toBe(2);
  });

  it('records extra witnesses (different members) without touching match_games', async () => {
    const before = (
      await executeSql(
        `SELECT confirmed_by_home, confirmed_by_away FROM public.match_games WHERE id = $1`,
        [gameId]
      )
    )[0];

    await appendConfirmation({ gameId, matchId, gameNumber, confirmerId: memberA, side: 'home', result: baseResult });
    await appendConfirmation({ gameId, matchId, gameNumber, confirmerId: memberB, side: 'home', result: baseResult });

    const rows = await executeSql(
      `SELECT 1 FROM public.game_confirmations
         WHERE game_id = $1 AND confirmer_id = ANY($2::uuid[])`,
      [gameId, [memberA, memberB]]
    );
    expect(rows.length).toBe(2);

    const after = (
      await executeSql(
        `SELECT confirmed_by_home, confirmed_by_away FROM public.match_games WHERE id = $1`,
        [gameId]
      )
    )[0];
    expect(after).toEqual(before);
  });

  it('records a vacate marker (action = vacate)', async () => {
    const ok = await appendConfirmation({
      gameId, matchId, gameNumber, confirmerId: memberA, side: 'away',
      action: 'vacate', result: baseResult,
    });
    expect(ok).toBe(true);

    const rows = await executeSql(
      `SELECT action FROM public.game_confirmations WHERE game_id = $1 AND confirmer_id = $2`,
      [gameId, memberA]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].action).toBe('vacate');
  });

  it('no-ops once the match is finalized (status = completed)', async () => {
    const orig = (
      await executeSql(`SELECT status FROM public.matches WHERE id = $1`, [matchId])
    )[0].status;
    try {
      await executeSql(`UPDATE public.matches SET status = 'completed' WHERE id = $1`, [matchId]);

      const ok = await appendConfirmation({
        gameId, matchId, gameNumber, confirmerId: memberA, side: 'home', result: baseResult,
      });
      expect(ok).toBe(false);

      const rows = await executeSql(
        `SELECT 1 FROM public.game_confirmations WHERE game_id = $1 AND confirmer_id = $2`,
        [gameId, memberA]
      );
      expect(rows.length).toBe(0);
    } finally {
      await executeSql(`UPDATE public.matches SET status = $2 WHERE id = $1`, [matchId, orig]);
    }
  });

  it('never throws and no-ops on a bad game_id (best-effort)', async () => {
    let threw = false;
    let result: boolean | undefined;
    try {
      result = await appendConfirmation({
        gameId: '00000000-0000-0000-0000-000000000000',
        matchId,
        gameNumber,
        confirmerId: memberA,
        side: 'home',
        result: baseResult,
      });
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(result).toBe(false);
  });

  it('no-ops when there is no confirmer id', async () => {
    const ok = await appendConfirmation({
      gameId, matchId, gameNumber, confirmerId: null, side: 'home', result: baseResult,
    });
    expect(ok).toBe(false);
  });
});
