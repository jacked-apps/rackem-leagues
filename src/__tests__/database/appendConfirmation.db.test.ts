/**
 * @fileoverview Behavior tests for `appendConfirmation` (many-eyes Unit 2 +
 * Phase 2 Amendment B), exercised against the local DB via the real app
 * supabase singleton (which `.env` points at localhost:54321).
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
 *   - is_initiator semantics (Amendment B): tagged on write; multiple
 *     is_initiator=true rows per (game_id, side) are accepted by the schema
 *     and by the helper's no-exact-dup guard (the dup guard ignores is_initiator).
 *
 * Runs in the `db` vitest project (sequential, jsdom). Raw `pg` is used for
 * setup/assertions/cleanup so we read ground truth straight from Postgres.
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import {
  appendConfirmation,
  type AppendConfirmationParams,
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

describe('appendConfirmation (many-eyes Unit 2 + Amendment B)', () => {
  let gameId: string;
  let matchId: string;
  let gameNumber: number;
  let homeTeamId: string;
  let memberA: string;
  let memberB: string;

  /**
   * Small helper: supplies the verbose required params (gameId/matchId/etc.)
   * and sensible defaults (confirmer = memberA, side = 'home', result =
   * baseResult, action = 'confirm', isInitiator = false). Tests override what
   * they care about via the partial. Keeps each test focused on its assertion
   * instead of plumbing.
   */
  function append(overrides: Partial<AppendConfirmationParams> = {}) {
    return appendConfirmation({
      gameId,
      matchId,
      gameNumber,
      confirmerId: memberA,
      side: 'home',
      result: baseResult,
      action: 'confirm',
      isInitiator: false,
      ...overrides,
    });
  }

  beforeAll(async () => {
    // Build our OWN non-finalized match and game rather than hunting for one.
    //
    // The seed has no such row and cannot have one: games are written at
    // lineup lock by prep_match, so every seeded match with games is also
    // completed. This suite used to fish for "any match that isn't completed
    // with a game attached", find nothing, and throw in beforeAll — failing
    // all of its cases for a reason that had nothing to do with the code
    // under test.
    const seasonWeek = await executeSql(
      `SELECT sw.id AS week_id, sw.season_id
         FROM public.season_weeks sw
        ORDER BY sw.id
        LIMIT 1`
    );
    const members = await executeSql(`SELECT id FROM public.members LIMIT 2`);

    if (seasonWeek.length === 0 || members.length < 2) {
      throw new Error(
        'appendConfirmation.db.test requires seed data: a season week and at least two members.'
      );
    }

    const match = await executeSql(
      `INSERT INTO public.matches (season_id, season_week_id, match_number, status)
       VALUES ($1, $2, 9901, 'scheduled')
       RETURNING id, home_team_id`,
      [seasonWeek[0].season_id, seasonWeek[0].week_id]
    );
    matchId = match[0].id;
    homeTeamId = match[0].home_team_id;

    const game = await executeSql(
      `INSERT INTO public.match_games
         (match_id, game_number, home_action, away_action, game_type)
       VALUES ($1, 1, 'breaks', 'racks', 'eight_ball')
       RETURNING id, game_number`,
      [matchId]
    );
    gameId = game[0].id;
    gameNumber = game[0].game_number;

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
    // Ours to remove — confirmations first, they reference the game.
    await executeSql(`DELETE FROM public.game_confirmations WHERE game_id = $1`, [gameId]);
    await executeSql(`DELETE FROM public.match_games WHERE match_id = $1`, [matchId]);
    await executeSql(`DELETE FROM public.matches WHERE id = $1`, [matchId]);
    await closePostgresPool();
  });

  it('appends a confirm vouch row carrying the full result snapshot', async () => {
    const ok = await append({
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
      `SELECT action, side, break_and_run, winner_value, loser_value, winner_team_id, is_initiator
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
    // The default in this helper is isInitiator: false (confirmer semantics).
    expect(rows[0].is_initiator).toBe(false);
  });

  it('does NOT modify the match_games row (officiality preserved)', async () => {
    const before = (
      await executeSql(
        `SELECT confirmed_by_home, confirmed_by_away, winner_team_id, winner_player_id, updated_at
           FROM public.match_games WHERE id = $1`,
        [gameId]
      )
    )[0];

    await append({ result: { ...baseResult, winnerTeamId: homeTeamId, winnerValue: 9 } });

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
    expect(await append({ result: r })).toBe(true);
    expect(await append({ result: r })).toBe(false);

    const rows = await executeSql(
      `SELECT 1 FROM public.game_confirmations WHERE game_id = $1 AND confirmer_id = $2`,
      [gameId, memberA]
    );
    expect(rows.length).toBe(1);
  });

  it('appends a new row on a change of mind (different result)', async () => {
    await append({ result: { ...baseResult, winnerValue: 5 } });
    const ok = await append({ result: { ...baseResult, winnerValue: 6 } });
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

    await append({ confirmerId: memberA });
    await append({ confirmerId: memberB });

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
    const ok = await append({ side: 'away', action: 'vacate' });
    expect(ok).toBe(true);

    const rows = await executeSql(
      `SELECT action, is_initiator FROM public.game_confirmations WHERE game_id = $1 AND confirmer_id = $2`,
      [gameId, memberA]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].action).toBe('vacate');
    // A vacate is not an initiation.
    expect(rows[0].is_initiator).toBe(false);
  });

  it('no-ops once the match is finalized (status = completed)', async () => {
    const orig = (
      await executeSql(`SELECT status FROM public.matches WHERE id = $1`, [matchId])
    )[0].status;
    try {
      await executeSql(`UPDATE public.matches SET status = 'completed' WHERE id = $1`, [matchId]);

      const ok = await append();
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
      result = await append({ gameId: '00000000-0000-0000-0000-000000000000' });
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(result).toBe(false);
  });

  it('no-ops when there is no confirmer id', async () => {
    const ok = await append({ confirmerId: null });
    expect(ok).toBe(false);
  });

  // ── Amendment B: is_initiator semantics ─────────────────────────────────────

  it('records is_initiator=true when caller marks the row as an initiation', async () => {
    const ok = await append({ isInitiator: true });
    expect(ok).toBe(true);

    const rows = await executeSql(
      `SELECT is_initiator FROM public.game_confirmations WHERE game_id = $1 AND confirmer_id = $2`,
      [gameId, memberA]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].is_initiator).toBe(true);
  });

  it('accepts a SECOND is_initiator=true row on the same (game, side) — agreement is the strongest confirmation', async () => {
    // First initiator: member A.
    await append({ isInitiator: true });
    // Second initiator on the SAME side: member B, same result. Per the locked
    // model, this is the strongest confirmation, not a conflict. Both rows land.
    const ok = await append({ confirmerId: memberB, isInitiator: true });
    expect(ok).toBe(true);

    const rows = await executeSql(
      `SELECT confirmer_id, is_initiator FROM public.game_confirmations
         WHERE game_id = $1 AND confirmer_id = ANY($2::uuid[])
       ORDER BY created_at ASC`,
      [gameId, [memberA, memberB]]
    );
    expect(rows.length).toBe(2);
    expect(rows.every((r) => r.is_initiator === true)).toBe(true);
  });

  it("the no-exact-dup guard ignores is_initiator (same data + same person, different role = still a dup)", async () => {
    // First: this person initiates with the default (baseResult).
    expect(await append({ isInitiator: true })).toBe(true);
    // Then: the same person taps Confirm (is_initiator=false) with the SAME
    // data. Functionally a re-tap of the same vouch → no-op. The role label
    // changing doesn't make it a new vouch.
    expect(await append({ isInitiator: false })).toBe(false);

    const rows = await executeSql(
      `SELECT 1 FROM public.game_confirmations WHERE game_id = $1 AND confirmer_id = $2`,
      [gameId, memberA]
    );
    expect(rows.length).toBe(1);
  });

  // ── auto_confirmed metric (scoring participation modes) ──────────────────────

  it('defaults auto_confirmed to false when the caller omits it (manual vouch)', async () => {
    expect(await append({})).toBe(true);

    const rows = await executeSql(
      `SELECT auto_confirmed FROM public.game_confirmations WHERE game_id = $1 AND confirmer_id = $2`,
      [gameId, memberA]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].auto_confirmed).toBe(false);
  });

  it('records auto_confirmed=true when the vouch came from Auto-Confirm mode', async () => {
    expect(await append({ autoConfirmed: true })).toBe(true);

    const rows = await executeSql(
      `SELECT auto_confirmed FROM public.game_confirmations WHERE game_id = $1 AND confirmer_id = $2`,
      [gameId, memberA]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].auto_confirmed).toBe(true);
  });
});
