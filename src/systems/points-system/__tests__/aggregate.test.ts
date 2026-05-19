/**
 * @fileoverview Tests for the linear_above_threshold aggregate operation.
 *
 * The 3-band formula + locked tie-band absorption rule (per-match points = 0
 * when games_won lands in the tie band). The operation reads the state bag
 * directly (home_wins/away_wins + the chart-target state vars). Mirrors the
 * test surface from `src/systems/calculators/linear_above_threshold.ts` so
 * the Points 3-Man cross-audit relies on direct equivalence.
 *
 * @see ../aggregate-operations/linear-above-threshold.ts — code under test
 */

import { describe, it, expect } from 'vitest';
import { linearAboveThresholdOperation } from '../aggregate-operations/linear-above-threshold';
import type { MatchStateBag } from '../types';

/**
 * Build a state bag with the chart-target vars the aggregate reads. Defaults
 * to the Points 3-Man canonical targets (W=10, T=9).
 */
function state(overrides: Partial<MatchStateBag>): Readonly<MatchStateBag> {
  return {
    home_wins: 0,
    away_wins: 0,
    homeWinTarget: 10,
    awayWinTarget: 10,
    homeTieTarget: 9,
    awayTieTarget: 9,
    homeLoseTarget: 8,
    awayLoseTarget: 8,
    ...overrides,
  };
}

const compute = (args: Record<string, unknown>, s: Readonly<MatchStateBag>) =>
  linearAboveThresholdOperation.compute(args, s);

describe('linear_above_threshold — Points 3-Man canonical case (W=10, T=9, multiplier=1)', () => {
  const args = { multiplier: 1 };

  describe('above-win band (games_won > W)', () => {
    it.each([
      [11, 1],
      [12, 2],
      [15, 5],
      [18, 8],
    ])('home_wins=%i → home_points=%i', (homeWins, expected) => {
      const result = compute(args, state({ home_wins: homeWins, away_wins: 0 }));
      expect(result.homePoints).toBe(expected);
    });
  });

  describe('tie band (T ≤ games_won ≤ W) → ALWAYS 0', () => {
    it.each([9, 10])('home_wins=%i → home_points=0 (locked)', (homeWins) => {
      const result = compute(args, state({ home_wins: homeWins, away_wins: 9 }));
      expect(result.homePoints).toBe(0);
    });

    it('9-9 tie: BOTH sides get 0', () => {
      const result = compute(args, state({ home_wins: 9, away_wins: 9 }));
      expect(result.homePoints).toBe(0);
      expect(result.awayPoints).toBe(0);
    });
  });

  describe('below-tie band (games_won < T)', () => {
    it.each([
      [8, -1],
      [7, -2],
      [5, -4],
      [0, -9],
    ])('home_wins=%i → home_points=%i', (homeWins, expected) => {
      const result = compute(args, state({ home_wins: homeWins, away_wins: 18 - homeWins }));
      expect(result.homePoints).toBe(expected);
    });
  });
});

describe('linear_above_threshold — multiplier scaling', () => {
  it('multiplier=2 doubles the linear bands', () => {
    expect(compute({ multiplier: 2 }, state({ home_wins: 12, away_wins: 6 })).homePoints).toBe(4);
    expect(compute({ multiplier: 2 }, state({ home_wins: 7, away_wins: 11 })).homePoints).toBe(-4);
  });

  it('multiplier does NOT lift the tie band off zero (locked invariant)', () => {
    expect(compute({ multiplier: 1000 }, state({ home_wins: 9, away_wins: 9 })).homePoints).toBe(0);
    expect(compute({ multiplier: 1000 }, state({ home_wins: 10, away_wins: 8 })).homePoints).toBe(0);
  });

  it('multiplier=0.5 halves the linear bands', () => {
    expect(compute({ multiplier: 0.5 }, state({ home_wins: 12, away_wins: 6 })).homePoints).toBe(1);
  });
});

describe('linear_above_threshold — no-tie case (tieTarget = null)', () => {
  it('above-win still works', () => {
    const result = compute(
      { multiplier: 1 },
      state({ home_wins: 13, homeWinTarget: 10, homeTieTarget: null }),
    );
    expect(result.homePoints).toBe(3);
  });

  it('below-win is below-tie too (no absorbed band)', () => {
    const result = compute(
      { multiplier: 1 },
      state({ home_wins: 7, homeWinTarget: 10, homeTieTarget: null }),
    );
    expect(result.homePoints).toBe(-3);
  });
});

describe('linear_above_threshold — defaults', () => {
  it('uses multiplier=1 when args.multiplier is missing', () => {
    expect(compute({}, state({ home_wins: 12, away_wins: 6 })).homePoints).toBe(2);
  });
});
