/**
 * @fileoverview Tests for the WhenCondition evaluator.
 *
 * @see ../when-evaluator.ts — code under test
 */

import { describe, it, expect } from 'vitest';
import { evaluateWhen, type WhenEvalContext } from '../when-evaluator';
import type { MatchStateBag, WhenCondition } from '../types';

const emptyState: MatchStateBag = {};
const emptyThresholds = {};

describe('evaluateWhen — receipt kind', () => {
  it('fires during receipt phase', () => {
    const cond: WhenCondition = { kind: 'receipt', thresholdRef: 'anyRef' };
    const ctx: WhenEvalContext = { thresholdValues: emptyThresholds, phase: 'receipt' };
    expect(evaluateWhen(cond, emptyState, ctx)).toEqual({
      fires: true,
      triggeringSide: null,
    });
  });

  it('does not fire during per_game or match_end phases', () => {
    const cond: WhenCondition = { kind: 'receipt', thresholdRef: 'anyRef' };
    expect(
      evaluateWhen(cond, emptyState, { thresholdValues: emptyThresholds, phase: 'per_game' }).fires,
    ).toBe(false);
    expect(
      evaluateWhen(cond, emptyState, { thresholdValues: emptyThresholds, phase: 'match_end' })
        .fires,
    ).toBe(false);
  });
});

describe('evaluateWhen — match_end kind', () => {
  it('fires only during match_end phase', () => {
    const cond: WhenCondition = { kind: 'match_end' };
    expect(
      evaluateWhen(cond, emptyState, { thresholdValues: emptyThresholds, phase: 'match_end' })
        .fires,
    ).toBe(true);
    expect(
      evaluateWhen(cond, emptyState, { thresholdValues: emptyThresholds, phase: 'receipt' }).fires,
    ).toBe(false);
    expect(
      evaluateWhen(cond, emptyState, { thresholdValues: emptyThresholds, phase: 'per_game' }).fires,
    ).toBe(false);
  });
});

describe('evaluateWhen — total_games_played kind', () => {
  it('fires when gamesPlayed equals the threshold value', () => {
    const cond: WhenCondition = { kind: 'total_games_played', thresholdRef: 'target' };
    const ctx: WhenEvalContext = {
      thresholdValues: { target: 6 },
      phase: 'per_game',
      gamesPlayed: 6,
    };
    expect(evaluateWhen(cond, emptyState, ctx).fires).toBe(true);
  });

  it('does not fire on the wrong game count', () => {
    const cond: WhenCondition = { kind: 'total_games_played', thresholdRef: 'target' };
    expect(
      evaluateWhen(cond, emptyState, {
        thresholdValues: { target: 6 },
        phase: 'per_game',
        gamesPlayed: 5,
      }).fires,
    ).toBe(false);
    expect(
      evaluateWhen(cond, emptyState, {
        thresholdValues: { target: 6 },
        phase: 'per_game',
        gamesPlayed: 7,
      }).fires,
    ).toBe(false);
  });

  it('does not fire outside per_game phase', () => {
    const cond: WhenCondition = { kind: 'total_games_played', thresholdRef: 'target' };
    expect(
      evaluateWhen(cond, emptyState, {
        thresholdValues: { target: 6 },
        phase: 'receipt',
      }).fires,
    ).toBe(false);
  });
});

describe('evaluateWhen — side_reaches kind', () => {
  const milestoneCondition: WhenCondition = {
    kind: 'side_reaches',
    thresholdRef: 'milestoneTarget',
    side: 'any',
    sideVarTemplate: '<side>_wins',
  };

  it('fires for the side that just won, when their wins equal the threshold', () => {
    const result = evaluateWhen(
      milestoneCondition,
      { home_wins: 9, away_wins: 5 },
      {
        thresholdValues: { milestoneTarget: 9 },
        phase: 'per_game',
        gameWinnerSide: 'home',
      },
    );
    expect(result).toEqual({ fires: true, triggeringSide: 'home' });
  });

  it('does not fire when the winning side has not reached the threshold', () => {
    const result = evaluateWhen(
      milestoneCondition,
      { home_wins: 5, away_wins: 3 },
      {
        thresholdValues: { milestoneTarget: 9 },
        phase: 'per_game',
        gameWinnerSide: 'home',
      },
    );
    expect(result.fires).toBe(false);
  });

  it('does not fire for the side that did NOT win this game (avoids stale re-fires)', () => {
    // away has 9 wins already (from past) but home won THIS game — milestone
    // shouldn't fire because away's state didn't change.
    const result = evaluateWhen(
      milestoneCondition,
      { home_wins: 5, away_wins: 9 },
      {
        thresholdValues: { milestoneTarget: 9 },
        phase: 'per_game',
        gameWinnerSide: 'home',
      },
    );
    expect(result.fires).toBe(false);
  });

  it('fires with side: home when restricted to that side specifically', () => {
    const cond: WhenCondition = {
      kind: 'side_reaches',
      thresholdRef: 'target',
      side: 'home',
      sideVarTemplate: '<side>_wins',
    };
    const result = evaluateWhen(
      cond,
      { home_wins: 10, away_wins: 5 },
      {
        thresholdValues: { target: 10 },
        phase: 'per_game',
        gameWinnerSide: 'home',
      },
    );
    expect(result).toEqual({ fires: true, triggeringSide: 'home' });
  });
});

describe('evaluateWhen — all_sides_reach kind', () => {
  const tieBandCondition: WhenCondition = {
    kind: 'all_sides_reach',
    thresholdRef: 'tieGames',
    sideVarTemplate: '<side>_wins',
  };

  it('fires when both sides simultaneously hit the threshold', () => {
    const result = evaluateWhen(
      tieBandCondition,
      { home_wins: 9, away_wins: 9 },
      {
        thresholdValues: { tieGames: 9 },
        phase: 'per_game',
      },
    );
    expect(result).toEqual({ fires: true, triggeringSide: null });
  });

  it('does not fire when only one side has reached', () => {
    expect(
      evaluateWhen(
        tieBandCondition,
        { home_wins: 9, away_wins: 8 },
        { thresholdValues: { tieGames: 9 }, phase: 'per_game' },
      ).fires,
    ).toBe(false);
  });
});

describe('evaluateWhen — error cases', () => {
  it('throws on undefined threshold reference', () => {
    const cond: WhenCondition = { kind: 'total_games_played', thresholdRef: 'missing' };
    expect(() =>
      evaluateWhen(cond, emptyState, {
        thresholdValues: {},
        phase: 'per_game',
        gamesPlayed: 6,
      }),
    ).toThrow(/undefined threshold/);
  });
});
