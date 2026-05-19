/**
 * @fileoverview Tests for the WhenCondition evaluator.
 *
 * @see ../when-evaluator.ts — code under test
 */

import { describe, it, expect } from 'vitest';
import { evaluateWhen, type WhenEvalContext } from '../when-evaluator';
import type { MatchStateBag, WhenCondition } from '../types';

const emptyState: MatchStateBag = {};

describe('evaluateWhen — receipt kind', () => {
  it('fires during receipt phase', () => {
    const cond: WhenCondition = { kind: 'receipt' };
    const ctx: WhenEvalContext = { inputValue: 5, phase: 'receipt' };
    expect(evaluateWhen(cond, emptyState, ctx)).toBe(true);
  });

  it('does not fire during per_game or match_end phases', () => {
    const cond: WhenCondition = { kind: 'receipt' };
    expect(
      evaluateWhen(cond, emptyState, { inputValue: 5, phase: 'per_game' }),
    ).toBe(false);
    expect(
      evaluateWhen(cond, emptyState, { inputValue: 5, phase: 'match_end' }),
    ).toBe(false);
  });
});

describe('evaluateWhen — match_end kind', () => {
  it('fires only during match_end phase', () => {
    const cond: WhenCondition = { kind: 'match_end' };
    expect(
      evaluateWhen(cond, emptyState, { inputValue: undefined, phase: 'match_end' }),
    ).toBe(true);
    expect(
      evaluateWhen(cond, emptyState, { inputValue: undefined, phase: 'receipt' }),
    ).toBe(false);
    expect(
      evaluateWhen(cond, emptyState, { inputValue: undefined, phase: 'per_game' }),
    ).toBe(false);
  });
});

describe('evaluateWhen — total_games_played kind', () => {
  it('fires when gamesPlayed equals the input value', () => {
    const cond: WhenCondition = { kind: 'total_games_played' };
    const ctx: WhenEvalContext = { inputValue: 6, phase: 'per_game', gamesPlayed: 6 };
    expect(evaluateWhen(cond, emptyState, ctx)).toBe(true);
  });

  it('does not fire on the wrong game count', () => {
    const cond: WhenCondition = { kind: 'total_games_played' };
    expect(
      evaluateWhen(cond, emptyState, { inputValue: 6, phase: 'per_game', gamesPlayed: 5 }),
    ).toBe(false);
    expect(
      evaluateWhen(cond, emptyState, { inputValue: 6, phase: 'per_game', gamesPlayed: 7 }),
    ).toBe(false);
  });

  it('does not fire outside per_game phase', () => {
    const cond: WhenCondition = { kind: 'total_games_played' };
    expect(
      evaluateWhen(cond, emptyState, { inputValue: 6, phase: 'receipt' }),
    ).toBe(false);
  });
});

describe('evaluateWhen — side_reaches kind', () => {
  const homeMilestone: WhenCondition = {
    kind: 'side_reaches',
    side: 'home',
    sideVar: 'home_wins',
  };

  it('fires when home just won and home_wins equals input', () => {
    const result = evaluateWhen(
      homeMilestone,
      { home_wins: 9, away_wins: 5 },
      { inputValue: 9, phase: 'per_game', gameWinnerSide: 'home' },
    );
    expect(result).toBe(true);
  });

  it('does not fire when the winning side has not reached the input', () => {
    const result = evaluateWhen(
      homeMilestone,
      { home_wins: 5, away_wins: 3 },
      { inputValue: 9, phase: 'per_game', gameWinnerSide: 'home' },
    );
    expect(result).toBe(false);
  });

  it('does not fire when away just won (the trigger watches home)', () => {
    // home_wins is at 9 from a prior game but home didn't win THIS game.
    // The trigger must NOT refire — only fires when home just incremented.
    const result = evaluateWhen(
      homeMilestone,
      { home_wins: 9, away_wins: 5 },
      { inputValue: 9, phase: 'per_game', gameWinnerSide: 'away' },
    );
    expect(result).toBe(false);
  });

  it('per-side: away-watching trigger fires when away just won and away_wins equals input', () => {
    const awayMilestone: WhenCondition = {
      kind: 'side_reaches',
      side: 'away',
      sideVar: 'away_wins',
    };
    const result = evaluateWhen(
      awayMilestone,
      { home_wins: 5, away_wins: 10 },
      { inputValue: 10, phase: 'per_game', gameWinnerSide: 'away' },
    );
    expect(result).toBe(true);
  });
});

describe('evaluateWhen — all_sides_reach kind', () => {
  const tieBand: WhenCondition = {
    kind: 'all_sides_reach',
    homeVar: 'home_wins',
    awayVar: 'away_wins',
  };

  it('fires when both sides simultaneously hit the input value', () => {
    const result = evaluateWhen(
      tieBand,
      { home_wins: 9, away_wins: 9 },
      { inputValue: 9, phase: 'per_game' },
    );
    expect(result).toBe(true);
  });

  it('does not fire when only one side has reached', () => {
    expect(
      evaluateWhen(
        tieBand,
        { home_wins: 9, away_wins: 8 },
        { inputValue: 9, phase: 'per_game' },
      ),
    ).toBe(false);
  });
});

describe('evaluateWhen — error cases', () => {
  it('throws when total_games_played has no input', () => {
    const cond: WhenCondition = { kind: 'total_games_played' };
    expect(() =>
      evaluateWhen(cond, emptyState, {
        inputValue: undefined,
        phase: 'per_game',
        gamesPlayed: 6,
      }),
    ).toThrow(/none was declared/);
  });

  it('throws when side_reaches has a null input value', () => {
    const cond: WhenCondition = {
      kind: 'side_reaches',
      side: 'home',
      sideVar: 'home_wins',
    };
    expect(() =>
      evaluateWhen(cond, { home_wins: 9 }, {
        inputValue: null,
        phase: 'per_game',
        gameWinnerSide: 'home',
      }),
    ).toThrow(/null input/);
  });
});
