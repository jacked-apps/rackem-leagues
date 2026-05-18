/**
 * @fileoverview Tests for the Threshold Charts registry / factory.
 *
 * Verifies `getThresholdChart(kind)` routes to the correct Chart variant for
 * each of the five `ChartKind` values.
 *
 * @see ../index.ts — the function under test
 */

import { describe, it, expect } from 'vitest';
import {
  getThresholdChart,
  gamesNeeded3v3Chart,
  gamesNeeded5v5Chart,
  fargoFormulaChart,
  racePointsChart,
  racePercentageChart,
} from '../index';

describe('getThresholdChart — selection by chartKind', () => {
  it('routes "games_needed_3v3" to gamesNeeded3v3Chart', () => {
    expect(getThresholdChart('games_needed_3v3')).toBe(gamesNeeded3v3Chart);
  });

  it('routes "games_needed_5v5" to gamesNeeded5v5Chart', () => {
    expect(getThresholdChart('games_needed_5v5')).toBe(gamesNeeded5v5Chart);
  });

  it('routes "fargo_formula" to fargoFormulaChart', () => {
    expect(getThresholdChart('fargo_formula')).toBe(fargoFormulaChart);
  });

  it('routes "race_points" to racePointsChart', () => {
    expect(getThresholdChart('race_points')).toBe(racePointsChart);
  });

  it('routes "race_percentage" to racePercentageChart', () => {
    expect(getThresholdChart('race_percentage')).toBe(racePercentageChart);
  });

  it('returned Chart has the matching kind discriminator', () => {
    expect(getThresholdChart('games_needed_3v3').kind).toBe('games_needed_3v3');
    expect(getThresholdChart('games_needed_5v5').kind).toBe('games_needed_5v5');
    expect(getThresholdChart('fargo_formula').kind).toBe('fargo_formula');
    expect(getThresholdChart('race_points').kind).toBe('race_points');
    expect(getThresholdChart('race_percentage').kind).toBe('race_percentage');
  });
});
