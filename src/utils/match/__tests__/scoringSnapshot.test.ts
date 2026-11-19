/**
 * @fileoverview Reading a match's frozen scoring settings (scoringSnapshot.ts),
 * shared by updateMatchRunningTotals and the season replay test.
 *
 * @see docs/plans/2026-11-17-001-feat-trustworthy-tests-plan.md (U2)
 */

import { describe, it, expect } from 'vitest';
import { readScoringSnapshot, thresholdsFromMatchRow } from '../scoringSnapshot';

describe('readScoringSnapshot', () => {
  it('reads the frozen settings', () => {
    const snapshot = {
      points_calculator: 'linear_above_threshold',
      points_calculator_params: { multiplier: 2 },
      win_condition: 'points',
      per_game_allocator: { kind: 'x' },
    };
    expect(readScoringSnapshot(snapshot)).toEqual({
      pointsCalculator: 'linear_above_threshold',
      pointsCalculatorParams: { multiplier: 2 },
      winCondition: 'points',
      perGameAllocatorOverride: { kind: 'x' },
    });
  });

  it('defaults: games win condition, empty params, no allocator (pre-Unit-5 snapshots)', () => {
    expect(readScoringSnapshot({ points_calculator: null })).toEqual({
      pointsCalculator: null,
      pointsCalculatorParams: {},
      winCondition: 'games',
      perGameAllocatorOverride: null,
    });
  });

  it('returns null when there is no usable snapshot, so the caller falls back', () => {
    expect(readScoringSnapshot(null)).toBeNull();
    expect(readScoringSnapshot({ lineup_size: 3 })).toBeNull();
  });
});

describe('thresholdsFromMatchRow', () => {
  it('maps the six columns to each side', () => {
    const row = { home_to_win: 10, home_to_tie: 9, home_to_lose: 8, away_to_win: 11, away_to_tie: 10, away_to_lose: 9 };
    expect(thresholdsFromMatchRow(row)).toEqual({
      homeThresholds: { games_to_win: 10, games_to_tie: 9, games_to_lose: 8 },
      awayThresholds: { games_to_win: 11, games_to_tie: 10, games_to_lose: 9 },
    });
  });
});
