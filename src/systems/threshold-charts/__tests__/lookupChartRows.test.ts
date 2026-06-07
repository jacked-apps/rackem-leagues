/**
 * @fileoverview Tests for the synchronous chart lookup (Unit 3 of the threshold
 * room). Pure port of the `lookup_threshold` SQL — exact, range, and the 2D
 * race upper-triangle swap.
 */

import { describe, it, expect } from 'vitest';
import { lookupChartRows, type ResolvedChart } from '../lookupChartRows';

const teamExact: ResolvedChart = {
  chartType: 'team_points',
  lookupMode: 'exact',
  rows: [
    { comp_1: -3, comp_2: null, result_1: 8, result_2: null, result_3: 7 },
    { comp_1: 0, comp_2: null, result_1: 10, result_2: 9, result_3: 8 },
    { comp_1: 3, comp_2: null, result_1: 11, result_2: null, result_3: 10 },
  ],
};

const teamRange: ResolvedChart = {
  chartType: 'team_percentage',
  lookupMode: 'range',
  rows: [
    { comp_1: 0, comp_2: null, result_1: 9, result_2: 8, result_3: 7 },
    { comp_1: 5, comp_2: null, result_1: 11, result_2: 10, result_3: 9 },
    { comp_1: 10, comp_2: null, result_1: 13, result_2: 12, result_3: 11 },
  ],
};

const raceExact: ResolvedChart = {
  chartType: 'race_points',
  lookupMode: 'exact',
  // Upper triangle only (comp_1 >= comp_2).
  rows: [{ comp_1: 2, comp_2: -2, result_1: 6, result_2: null, result_3: 2 }],
};

describe('lookupChartRows — exact (1D team)', () => {
  it('returns the matching row', () => {
    expect(lookupChartRows(teamExact, 0)).toEqual({
      result_1: 10,
      result_2: 9,
      result_3: 8,
      was_swapped: false,
    });
  });

  it('returns null result_2 where the chart has no tie', () => {
    expect(lookupChartRows(teamExact, 3)?.result_2).toBeNull();
  });

  it('returns null when no row matches', () => {
    expect(lookupChartRows(teamExact, 99)).toBeNull();
  });
});

describe('lookupChartRows — range (VLOOKUP)', () => {
  it('picks the highest comp_1 at or below the input', () => {
    expect(lookupChartRows(teamRange, 7)?.result_1).toBe(11); // row comp_1=5
  });

  it('returns the exact band edge', () => {
    expect(lookupChartRows(teamRange, 10)?.result_1).toBe(13);
  });

  it('returns null when the input is below every band', () => {
    expect(lookupChartRows(teamRange, -1)).toBeNull();
  });
});

describe('lookupChartRows — 2D race upper-triangle swap', () => {
  it('reads the stored row directly when comp_1 >= comp_2', () => {
    const r = lookupChartRows(raceExact, 2, -2);
    expect(r).toEqual({ result_1: 6, result_2: null, result_3: 2, was_swapped: false });
  });

  it('swaps comps and swaps result_1/result_3 back when reversed', () => {
    const r = lookupChartRows(raceExact, -2, 2);
    expect(r).toEqual({ result_1: 2, result_2: null, result_3: 6, was_swapped: true });
  });
});
