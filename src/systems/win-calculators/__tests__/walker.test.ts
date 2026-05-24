/**
 * @fileoverview Tests for the Win Calculator metric-stack walker.
 *
 * The walker is pure: given a metric stack + match data, it returns a `WinnerDecision`.
 * These tests exercise every entry kind and the tied-fallthrough behavior.
 *
 * @see ../walker.ts — the function under test
 * @see ../types.ts — `WinnerDecision`, `MetricStackEntry`, `MatchData`
 */

import { describe, it, expect } from 'vitest';
import { walkMetricStack } from '../walker';
import type { MatchData, MetricStackEntry } from '../types';

/** Helper: build a MatchData object with all four fields supplied. */
function md(homeGames: number, awayGames: number, homePoints = 0, awayPoints = 0): MatchData {
  return {
    home_games_won: homeGames,
    away_games_won: awayGames,
    home_points: homePoints,
    away_points: awayPoints,
  };
}

describe('walkMetricStack — games_won entry', () => {
  const stack: ReadonlyArray<MetricStackEntry> = [{ kind: 'games_won' }];

  it('home has more games_won → home_win', () => {
    expect(walkMetricStack(stack, md(12, 6))).toBe('home_win');
  });

  it('away has more games_won → away_win', () => {
    expect(walkMetricStack(stack, md(6, 12))).toBe('away_win');
  });

  it('games_won tied with no further entries → tied', () => {
    expect(walkMetricStack(stack, md(9, 9))).toBe('tied');
  });

  it('points difference is ignored when only games_won is in the stack', () => {
    // Home loses on games_won but has more points — games_won decides.
    expect(walkMetricStack(stack, md(8, 10, 100, 50))).toBe('away_win');
  });
});

describe('walkMetricStack — points_earned entry', () => {
  const stack: ReadonlyArray<MetricStackEntry> = [{ kind: 'points_earned' }];

  it('home has more points → home_win', () => {
    expect(walkMetricStack(stack, md(0, 0, 85, 42))).toBe('home_win');
  });

  it('away has more points → away_win', () => {
    expect(walkMetricStack(stack, md(0, 0, 42, 85))).toBe('away_win');
  });

  it('points tied with no further entries → tied', () => {
    expect(walkMetricStack(stack, md(0, 0, 50, 50))).toBe('tied');
  });

  it('games_won difference is ignored when only points_earned is in the stack', () => {
    // Home has more games but fewer points — points decides.
    expect(walkMetricStack(stack, md(12, 6, 30, 60))).toBe('away_win');
  });
});

describe('walkMetricStack — multi-entry stack (future-shape — Unit 1 does not populate)', () => {
  // These tests exercise the walker's behavior with multi-entry stacks even though
  // Unit 1's factory never creates them. Lock the walker's fallthrough behavior so
  // future units that DO create multi-entry stacks have a verified algorithm.

  const stack: ReadonlyArray<MetricStackEntry> = [
    { kind: 'games_won' },
    { kind: 'points_earned' },
  ];

  it('games_won decides when teams differ on games → home_win', () => {
    // Points difference is irrelevant because games_won is checked first.
    expect(walkMetricStack(stack, md(12, 6, 20, 80))).toBe('home_win');
  });

  it('games_won tied → walker falls through to points_earned', () => {
    // Games tied; points break the tie.
    expect(walkMetricStack(stack, md(9, 9, 60, 30))).toBe('home_win');
  });

  it('games_won tied AND points_earned tied → tied (stack exhausted)', () => {
    expect(walkMetricStack(stack, md(9, 9, 50, 50))).toBe('tied');
  });

  it('games_won tied, away wins on points → away_win', () => {
    expect(walkMetricStack(stack, md(9, 9, 30, 60))).toBe('away_win');
  });
});

describe('walkMetricStack — edge entry (Unit 1 defensive fallback)', () => {
  // Unit 1's factory never includes `edge` in a league's stack. Unit 9 will wire it
  // to fire the Tiebreak System. For Unit 1, the walker's defensive behavior when
  // it encounters `edge` is: treat as a no-op and fall through. Lock that here.

  it('stack with only edge entry → tied (Unit 1 defensive fallback)', () => {
    const stack: ReadonlyArray<MetricStackEntry> = [{ kind: 'edge' }];
    expect(walkMetricStack(stack, md(9, 9))).toBe('tied');
  });

  it('games_won decides before edge is reached → home_win', () => {
    // Even though the stack has edge, games_won breaks the tie first; edge never evaluated.
    const stack: ReadonlyArray<MetricStackEntry> = [
      { kind: 'games_won' },
      { kind: 'edge' },
    ];
    expect(walkMetricStack(stack, md(12, 6))).toBe('home_win');
  });

  it('games_won tied + edge entry → tied (edge is a no-op in Unit 1)', () => {
    // When Unit 9 wires the Tiebreak System, this case will fire the trigger and return
    // a winner. In Unit 1, this returns 'tied' as the defensive fallback.
    const stack: ReadonlyArray<MetricStackEntry> = [
      { kind: 'games_won' },
      { kind: 'edge' },
    ];
    expect(walkMetricStack(stack, md(9, 9))).toBe('tied');
  });
});

describe('walkMetricStack — empty stack', () => {
  it('empty stack → tied (no metrics to evaluate)', () => {
    expect(walkMetricStack([], md(12, 6, 80, 40))).toBe('tied');
  });
});
