/**
 * @fileoverview Tests for the prize-distribution engine. Covers
 * each shape preset, doubling/sliding/flat algorithms, custom
 * percentages, and the rounding convention (remainder → 1st place).
 */

import { describe, it, expect } from 'vitest';
import { distributePrizes, percentagesForShape } from '../distributePrizes';

describe('percentagesForShape', () => {
  it('50_30_20 returns [50, 30, 20] for top 3', () => {
    expect(percentagesForShape('50_30_20', 3)).toEqual([50, 30, 20]);
  });

  it('40_30_20_10 returns [40, 30, 20, 10] for top 4', () => {
    expect(percentagesForShape('40_30_20_10', 4)).toEqual([40, 30, 20, 10]);
  });

  it('35_25_20_12_8 returns the bowling 5-place split', () => {
    expect(percentagesForShape('35_25_20_12_8', 5)).toEqual([35, 25, 20, 12, 8]);
  });

  it('doubling produces 1st = 2× 2nd = 4× 3rd', () => {
    const result = percentagesForShape('doubling', 3);
    // Weights: 4, 2, 1 (sum 7). Percentages: 4/7, 2/7, 1/7.
    expect(result[0]).toBeCloseTo((4 / 7) * 100, 5);
    expect(result[1]).toBeCloseTo((2 / 7) * 100, 5);
    expect(result[2]).toBeCloseTo((1 / 7) * 100, 5);
    // 1st should be double 2nd
    expect(result[0] / result[1]).toBeCloseTo(2, 5);
  });

  it('flat divides evenly', () => {
    expect(percentagesForShape('flat', 4)).toEqual([25, 25, 25, 25]);
    expect(percentagesForShape('flat', 5)).toEqual([20, 20, 20, 20, 20]);
  });

  it('sliding_scale produces a descending curve summing to 100', () => {
    const result = percentagesForShape('sliding_scale', 4);
    expect(result.length).toBe(4);
    // Descending
    expect(result[0]).toBeGreaterThan(result[1]);
    expect(result[1]).toBeGreaterThan(result[2]);
    expect(result[2]).toBeGreaterThan(result[3]);
    // Sums to 100
    expect(result.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 5);
  });

  it('custom uses provided percentages', () => {
    expect(percentagesForShape('custom', 3, [60, 25, 15])).toEqual([60, 25, 15]);
  });

  it('custom falls back to flat when percentages missing', () => {
    expect(percentagesForShape('custom', 3, null)).toEqual([100 / 3, 100 / 3, 100 / 3]);
  });

  it('pads preset with zeros when placesPaid exceeds preset length', () => {
    // 50/30/20 with 5 places → [50, 30, 20, 0, 0]
    expect(percentagesForShape('50_30_20', 5)).toEqual([50, 30, 20, 0, 0]);
  });
});

describe('distributePrizes — without rounding', () => {
  it('returns the brainstorm worked example for 50_30_20 on $3,840', () => {
    const result = distributePrizes({
      pool: 3840,
      shape: '50_30_20',
      placesPaid: 3,
    });
    expect(result).toEqual([
      { place: 1, amount: 1920 },
      { place: 2, amount: 1152 },
      { place: 3, amount: 768 },
    ]);
  });

  it('produces messy numbers for percentage mode when the math is uneven', () => {
    // $1000 in doubling for 3 places: 4/7, 2/7, 1/7
    const result = distributePrizes({
      pool: 1000,
      shape: 'doubling',
      placesPaid: 3,
    });
    expect(result[0].amount).toBeCloseTo(571.43, 2);
    expect(result[1].amount).toBeCloseTo(285.71, 2);
    expect(result[2].amount).toBeCloseTo(142.86, 2);
  });

  it('empty result for zero pool', () => {
    expect(distributePrizes({ pool: 0, shape: '50_30_20', placesPaid: 3 })).toEqual([]);
  });

  it('empty result for zero places paid', () => {
    expect(distributePrizes({ pool: 1000, shape: '50_30_20', placesPaid: 0 })).toEqual([]);
  });
});

describe('distributePrizes — with rounding', () => {
  it('rounds each prize to the nearest $25 and dumps remainder into 1st', () => {
    // $3,840 pool, 50/30/20, $25 rounding:
    //   exact = [1920, 1152, 768]
    //   rounded = [1925 (round 1920→1925? no, round to nearest 25 = 1925),
    //              1150, 775]
    // Wait — let me recompute:
    //   1920 / 25 = 76.8 → round = 77 × 25 = 1925
    //   1152 / 25 = 46.08 → round = 46 × 25 = 1150
    //   768 / 25 = 30.72 → round = 31 × 25 = 775
    // Rounded sum = 1925 + 1150 + 775 = 3850
    // Remainder = 3840 - 3850 = -10 → goes to 1st
    // Final: [1915, 1150, 775], sum = 3840 ✓
    const result = distributePrizes({
      pool: 3840,
      shape: '50_30_20',
      placesPaid: 3,
      roundingTarget: 25,
    });
    expect(result).toEqual([
      { place: 1, amount: 1915 },
      { place: 2, amount: 1150 },
      { place: 3, amount: 775 },
    ]);
    // Sum should match pool exactly
    const sum = result.reduce((acc, p) => acc + p.amount, 0);
    expect(sum).toBe(3840);
  });

  it('rounds to $50 buckets correctly', () => {
    const result = distributePrizes({
      pool: 1000,
      shape: '50_30_20',
      placesPaid: 3,
      roundingTarget: 50,
    });
    // exact = [500, 300, 200] (already clean)
    // rounded = [500, 300, 200], remainder = 0
    expect(result).toEqual([
      { place: 1, amount: 500 },
      { place: 2, amount: 300 },
      { place: 3, amount: 200 },
    ]);
  });

  it('rounds to $100 buckets and dumps remainder into 1st', () => {
    const result = distributePrizes({
      pool: 1234,
      shape: '50_30_20',
      placesPaid: 3,
      roundingTarget: 100,
    });
    // exact = [617, 370.20, 246.80]
    // rounded = [600, 400, 200], sum = 1200
    // remainder = 1234 - 1200 = 34 → 1st
    // final = [634, 400, 200]
    expect(result[0].amount).toBe(634);
    expect(result[1].amount).toBe(400);
    expect(result[2].amount).toBe(200);
    expect(result.reduce((a, p) => a + p.amount, 0)).toBe(1234);
  });

  it('roundingTarget=0 skips rounding (exact percentages)', () => {
    const result = distributePrizes({
      pool: 1234,
      shape: '50_30_20',
      placesPaid: 3,
      roundingTarget: 0,
    });
    expect(result[0].amount).toBeCloseTo(617, 2);
    expect(result[1].amount).toBeCloseTo(370.2, 2);
    expect(result[2].amount).toBeCloseTo(246.8, 2);
  });

  it('custom percentages distribute correctly', () => {
    const result = distributePrizes({
      pool: 1000,
      shape: 'custom',
      placesPaid: 3,
      customPercentages: [60, 25, 15],
      roundingTarget: 0,
    });
    expect(result).toEqual([
      { place: 1, amount: 600 },
      { place: 2, amount: 250 },
      { place: 3, amount: 150 },
    ]);
  });
});
