/**
 * @fileoverview Tests for the RESERVED Race Points / Race Percentage Chart variants.
 *
 * Both variants ship as stubs (no shipping Scoring System uses them today).
 * The tests confirm the module identity and that calling `compute` throws
 * — the contract is "never called in production today".
 *
 * @see ../race-points.ts — the Race Points stub
 * @see ../race-percentage.ts — the Race Percentage stub
 */

import { describe, it, expect } from 'vitest';
import { racePointsChart } from '../race-points';
import { racePercentageChart } from '../race-percentage';

const EMPTY_OVERRIDES = {};

describe('racePointsChart — RESERVED', () => {
  it('kind is "race_points"', () => {
    expect(racePointsChart.kind).toBe('race_points');
  });

  it('compute throws (RESERVED — no shipping consumer)', () => {
    expect(() => racePointsChart.compute(2, -1, EMPTY_OVERRIDES)).toThrow(/RESERVED/);
  });
});

describe('racePercentageChart — RESERVED', () => {
  it('kind is "race_percentage"', () => {
    expect(racePercentageChart.kind).toBe('race_percentage');
  });

  it('compute throws (RESERVED — no shipping consumer)', () => {
    expect(() => racePercentageChart.compute(50, 30, EMPTY_OVERRIDES)).toThrow(
      /RESERVED/,
    );
  });
});
