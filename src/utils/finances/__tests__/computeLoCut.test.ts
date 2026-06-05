/**
 * @fileoverview Tests for the LO-cut calculator. Three modes:
 * flat, percentage, both.
 */

import { describe, it, expect } from 'vitest';
import { computeLoCut } from '../computeLoCut';

describe('computeLoCut', () => {
  it('flat mode: takes flat × weeks regardless of pool', () => {
    expect(
      computeLoCut({
        kind: 'flat',
        flatPerWeek: 25,
        percent: 0,
        totalWeeks: 12,
        preCutPool: 4000,
      }),
    ).toBe(300); // 25 × 12

    // Ignores pool entirely
    expect(
      computeLoCut({
        kind: 'flat',
        flatPerWeek: 25,
        percent: 50, // irrelevant in flat mode
        totalWeeks: 12,
        preCutPool: 999999,
      }),
    ).toBe(300);
  });

  it('percentage mode: takes percent of pool regardless of flat', () => {
    expect(
      computeLoCut({
        kind: 'percentage',
        flatPerWeek: 25, // irrelevant in percentage mode
        percent: 10,
        totalWeeks: 12,
        preCutPool: 4000,
      }),
    ).toBe(400); // 10% of 4000
  });

  it('both mode: stacks flat + percentage', () => {
    expect(
      computeLoCut({
        kind: 'both',
        flatPerWeek: 25,
        percent: 5,
        totalWeeks: 12,
        preCutPool: 4000,
      }),
    ).toBe(500); // (25 × 12) + (4000 × 0.05) = 300 + 200
  });

  it('clamps percent to [0, 100]', () => {
    expect(
      computeLoCut({
        kind: 'percentage',
        flatPerWeek: 0,
        percent: 150, // clamped to 100
        totalWeeks: 12,
        preCutPool: 4000,
      }),
    ).toBe(4000);

    expect(
      computeLoCut({
        kind: 'percentage',
        flatPerWeek: 0,
        percent: -10, // clamped to 0
        totalWeeks: 12,
        preCutPool: 4000,
      }),
    ).toBe(0);
  });

  it('clamps negative pool to zero', () => {
    expect(
      computeLoCut({
        kind: 'percentage',
        flatPerWeek: 0,
        percent: 10,
        totalWeeks: 12,
        preCutPool: -500, // defensive
      }),
    ).toBe(0);
  });
});
