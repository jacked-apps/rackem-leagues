/**
 * @fileoverview Tests for the generalized `chart_lookup` threshold operation
 * (Unit 3). Resolves against a chart embedded in operationArgs by the loader;
 * 1D team charts resolve now, 2D race charts are deferred (null + warn).
 */

import { describe, it, expect, vi } from 'vitest';
import { chartLookupOperation as OP } from '../chart-lookup';
import { registeredThresholdOperationNames } from '../../threshold-registry';
import type { ResolvedChart } from '@/systems/threshold-charts/lookupChartRows';
import type { ThresholdInputs } from '../../types';

function inputs(overrides: Partial<ThresholdInputs> = {}): ThresholdInputs {
  return {
    homeRatings: [],
    awayRatings: [],
    homeHandicapDiff: 0,
    awayHandicapDiff: 0,
    gameCount: 18,
    prefs: {},
    ...overrides,
  };
}

const teamChart: ResolvedChart = {
  chartType: 'team_points',
  lookupMode: 'exact',
  rows: [
    { comp_1: 0, comp_2: null, result_1: 10, result_2: 9, result_3: 8 },
    { comp_1: 3, comp_2: null, result_1: 11, result_2: null, result_3: 10 },
  ],
};

const raceChart: ResolvedChart = {
  chartType: 'race_points',
  lookupMode: 'exact',
  rows: [{ comp_1: 2, comp_2: -2, result_1: 6, result_2: null, result_3: 2 }],
};

describe('chart_lookup — 1D team chart resolution', () => {
  it('reads the home side diff for the requested output field', () => {
    const i = inputs({ homeHandicapDiff: 0 });
    expect(OP.compute({ chart: teamChart, output_field: 'result_1', side: 'home' }, i)).toBe(10);
    expect(OP.compute({ chart: teamChart, output_field: 'result_2', side: 'home' }, i)).toBe(9);
    expect(OP.compute({ chart: teamChart, output_field: 'result_3', side: 'home' }, i)).toBe(8);
  });

  it('reads the away side diff (the mirror)', () => {
    const i = inputs({ awayHandicapDiff: 3 });
    expect(OP.compute({ chart: teamChart, output_field: 'result_1', side: 'away' }, i)).toBe(11);
  });

  it('propagates a null tie result', () => {
    const i = inputs({ homeHandicapDiff: 3 });
    expect(OP.compute({ chart: teamChart, output_field: 'result_2', side: 'home' }, i)).toBeNull();
  });
});

describe('chart_lookup — never-throw failures', () => {
  it('returns null + warn when no chart is embedded', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(OP.compute({ output_field: 'result_1', side: 'home' }, inputs())).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('returns null + warn on a bad output_field', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(OP.compute({ chart: teamChart, output_field: 'result_9' }, inputs())).toBeNull();
    warnSpy.mockRestore();
  });

  it('returns null + warn when no chart row matches the diff', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const i = inputs({ homeHandicapDiff: 99 });
    expect(OP.compute({ chart: teamChart, output_field: 'result_1', side: 'home' }, i)).toBeNull();
    warnSpy.mockRestore();
  });

  it('defers 2D race charts (null + warn)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(OP.compute({ chart: raceChart, output_field: 'result_1', side: 'home' }, inputs())).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('per-pairing'));
    warnSpy.mockRestore();
  });
});

describe('chart_lookup — declarations + registration', () => {
  it('producesOutputSide follows the binding side', () => {
    const fn = OP.producesOutputSide as (a: Record<string, unknown>) => string;
    expect(fn({ side: 'home' })).toBe('home');
    expect(fn({ side: 'away' })).toBe('away');
    expect(fn({})).toBe('shared');
  });

  it('registers itself in the threshold registry on import', () => {
    expect(registeredThresholdOperationNames()).toContain('chart_lookup');
  });
});
