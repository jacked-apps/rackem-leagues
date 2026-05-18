/**
 * @fileoverview Tests for the linearAboveThresholdAggregate primitive.
 *
 * The 3-band formula + locked tie-band absorption rule (per-match points = 0
 * when games_won equals the tie threshold). Mirrors the test surface from
 * `src/systems/calculators/linear_above_threshold.ts` so the cross-audit in
 * a later slice can rely on direct equivalence.
 *
 * @see ../aggregate.ts — code under test
 */

import { describe, it, expect } from 'vitest';
import { linearAboveThresholdAggregate } from '../aggregate';
import type { AggregateInput } from '../types';

function input(overrides: Partial<AggregateInput>): AggregateInput {
  return {
    homeWins: 0,
    awayWins: 0,
    homeWinTarget: 10,
    awayWinTarget: 10,
    homeTieTarget: 9,
    awayTieTarget: 9,
    homeLoseTarget: 8,
    awayLoseTarget: 8,
    ...overrides,
  };
}

describe('linearAboveThresholdAggregate — Points 3-Man canonical case (W=10, T=9, multiplier=1)', () => {
  const agg = linearAboveThresholdAggregate({ multiplier: 1 });

  describe('above-win band (games_won > W)', () => {
    it.each([
      [11, 1],
      [12, 2],
      [15, 5],
      [18, 8],
    ])('home_wins=%i → home_points=%i', (homeWins, expected) => {
      const result = agg.compute(input({ homeWins, awayWins: 0 }), agg.params);
      expect(result.homePoints).toBe(expected);
    });
  });

  describe('tie band (T ≤ games_won ≤ W) → ALWAYS 0', () => {
    it.each([9, 10])('home_wins=%i → home_points=0 (locked)', (homeWins) => {
      const result = agg.compute(input({ homeWins, awayWins: 9 }), agg.params);
      expect(result.homePoints).toBe(0);
    });

    it('9-9 tie: BOTH sides get 0', () => {
      const result = agg.compute(input({ homeWins: 9, awayWins: 9 }), agg.params);
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
      const result = agg.compute(
        input({ homeWins, awayWins: 18 - homeWins }),
        agg.params,
      );
      expect(result.homePoints).toBe(expected);
    });
  });
});

describe('linearAboveThresholdAggregate — multiplier scaling', () => {
  it('multiplier=2 doubles the linear bands', () => {
    const agg = linearAboveThresholdAggregate({ multiplier: 2 });
    expect(
      agg.compute(input({ homeWins: 12, awayWins: 6 }), agg.params).homePoints,
    ).toBe(4); // (12-10) * 2
    expect(
      agg.compute(input({ homeWins: 7, awayWins: 11 }), agg.params).homePoints,
    ).toBe(-4); // (7-9) * 2
  });

  it('multiplier does NOT lift the tie band off zero (locked invariant)', () => {
    const agg = linearAboveThresholdAggregate({ multiplier: 1000 });
    expect(
      agg.compute(input({ homeWins: 9, awayWins: 9 }), agg.params).homePoints,
    ).toBe(0);
    expect(
      agg.compute(input({ homeWins: 10, awayWins: 8 }), agg.params).homePoints,
    ).toBe(0);
  });

  it('multiplier=0.5 halves the linear bands', () => {
    const agg = linearAboveThresholdAggregate({ multiplier: 0.5 });
    expect(
      agg.compute(input({ homeWins: 12, awayWins: 6 }), agg.params).homePoints,
    ).toBe(1); // (12-10) * 0.5
  });
});

describe('linearAboveThresholdAggregate — no-tie case (tieTarget = null)', () => {
  const agg = linearAboveThresholdAggregate({ multiplier: 1 });

  it('above-win still works', () => {
    expect(
      agg.compute(
        input({
          homeWins: 13,
          homeWinTarget: 10,
          homeTieTarget: null,
        }),
        agg.params,
      ).homePoints,
    ).toBe(3);
  });

  it('below-win is below-tie too (no absorbed band)', () => {
    expect(
      agg.compute(
        input({
          homeWins: 7,
          homeWinTarget: 10,
          homeTieTarget: null,
        }),
        agg.params,
      ).homePoints,
    ).toBe(-3); // (7 - 10) * 1
  });
});

describe('linearAboveThresholdAggregate — defaults', () => {
  it('uses multiplier=1 when not provided', () => {
    const agg = linearAboveThresholdAggregate();
    expect(
      agg.compute(input({ homeWins: 12, awayWins: 6 }), agg.params).homePoints,
    ).toBe(2);
  });
});
