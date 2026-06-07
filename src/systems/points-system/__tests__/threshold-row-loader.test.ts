/**
 * @fileoverview Tests for the threshold row loader (Unit 1 of the threshold
 * room). Mirrors the trigger-loader test structure: every failure path
 * surfaces as `null` + console.warn, never an uncaught throw.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  registerThresholdOperation,
  clearThresholdRegistry,
} from '../threshold-registry';
import type { ThresholdOperation } from '../types';

const mockMaybeSingle = vi.fn();
const mockFetchResolvedChart = vi.fn();

vi.mock('@/supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mockMaybeSingle,
        }),
      }),
    }),
  },
}));

vi.mock('@/api/queries/thresholdCharts', () => ({
  fetchResolvedChart: (...args: unknown[]) => mockFetchResolvedChart(...args),
}));

import { loadThreshold } from '../threshold-row-loader';
import { chartLookupOperation } from '../operations/chart-lookup';

const ID = '22222222-2222-2222-2222-222222222222';

/** Minimal registered operation so buildThresholdRow can resolve a row. */
const STUB_OP: ThresholdOperation = {
  name: 'stub_op',
  consumesHandicapType: 'none',
  consumesSize: { kind: 'none' },
  producesOutputType: 'numeric',
  producesOutputSide: 'shared',
  producesOutputRange: { min: 'unbounded', max: 'unbounded' },
  compute: () => 1,
};

function rowData(overrides: Record<string, unknown> = {}) {
  return {
    id: ID,
    name: 'threshold_abc123',
    label: 'Finish line',
    description: 'How many a team must win.',
    definition: { operationKind: 'stub_op', operationArgs: {} },
    expansion_mode: 'home_away',
    ...overrides,
  };
}

beforeEach(() => {
  mockMaybeSingle.mockReset();
  mockFetchResolvedChart.mockReset();
  clearThresholdRegistry();
  registerThresholdOperation(STUB_OP);
});

afterEach(() => {
  clearThresholdRegistry();
});

describe('loadThreshold — happy path', () => {
  it('rebuilds the ThresholdRow and carries the workshop metadata', async () => {
    mockMaybeSingle.mockResolvedValue({ data: rowData(), error: null });
    const result = await loadThreshold(ID);
    expect(result).not.toBeNull();
    expect(result?.id).toBe(ID);
    expect(result?.label).toBe('Finish line');
    expect(result?.description).toBe('How many a team must win.');
    expect(result?.expansionMode).toBe('home_away');
    // Row metadata is re-derived from the registered operation, not stored.
    expect(result?.row.name).toBe('threshold_abc123');
    expect(result?.row.operationKind).toBe('stub_op');
    expect(result?.row.expectedHandicapType).toBe('none');
    expect(result?.row.outputType).toBe('numeric');
  });

  it('normalizes a missing description to null', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: rowData({ description: null }),
      error: null,
    });
    const result = await loadThreshold(ID);
    expect(result?.description).toBeNull();
  });
});

describe('loadThreshold — not-found and supabase failures', () => {
  it('returns null + warn when the row does not exist', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await loadThreshold(ID);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(`no row found for id=${ID}`),
    );
    warnSpy.mockRestore();
  });

  it('returns null + warn when supabase reports an error', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'PGRST' } });
    const result = await loadThreshold(ID);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('supabase error'));
    warnSpy.mockRestore();
  });

  it('returns null + warn when supabase throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockMaybeSingle.mockRejectedValue(new Error('network down'));
    const result = await loadThreshold(ID);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unexpected error'));
    warnSpy.mockRestore();
  });
});

describe('loadThreshold — malformed definition / registry', () => {
  it('returns null + warn when definition is not an object', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockMaybeSingle.mockResolvedValue({
      data: rowData({ definition: 'nope' }),
      error: null,
    });
    const result = await loadThreshold(ID);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('rejected'));
    warnSpy.mockRestore();
  });

  it('returns null + warn when operationKind is missing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockMaybeSingle.mockResolvedValue({
      data: rowData({ definition: { operationArgs: {} } }),
      error: null,
    });
    const result = await loadThreshold(ID);
    expect(result).toBeNull();
    warnSpy.mockRestore();
  });

  it('returns null + warn when the operation is not registered', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockMaybeSingle.mockResolvedValue({
      data: rowData({ definition: { operationKind: 'ghost_op', operationArgs: {} } }),
      error: null,
    });
    const result = await loadThreshold(ID);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('rejected'));
    warnSpy.mockRestore();
  });

  it('returns null + warn when expansion_mode is invalid', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockMaybeSingle.mockResolvedValue({
      data: rowData({ expansion_mode: 'banana' }),
      error: null,
    });
    const result = await loadThreshold(ID);
    expect(result).toBeNull();
    warnSpy.mockRestore();
  });
});

describe('loadThreshold — chart_lookup enrichment (the chart rides in the load)', () => {
  beforeEach(() => {
    registerThresholdOperation(chartLookupOperation);
  });

  const chartDef = {
    operationKind: 'chart_lookup',
    operationArgs: { chart_id: 'chart-1', output_field: 'result_1', side: 'home' },
  };

  it('embeds the fetched chart into the row operationArgs', async () => {
    const chart = { chartType: 'team_points', lookupMode: 'exact', rows: [] };
    mockFetchResolvedChart.mockResolvedValue(chart);
    mockMaybeSingle.mockResolvedValue({
      data: rowData({ definition: chartDef }),
      error: null,
    });
    const result = await loadThreshold(ID);
    expect(result).not.toBeNull();
    expect(mockFetchResolvedChart).toHaveBeenCalledWith('chart-1');
    expect(result?.row.operationArgs.chart).toEqual(chart);
  });

  it('returns null + warn when the referenced chart cannot be loaded', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockFetchResolvedChart.mockResolvedValue(null);
    mockMaybeSingle.mockResolvedValue({
      data: rowData({ definition: chartDef }),
      error: null,
    });
    expect(await loadThreshold(ID)).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('rejected'));
    warnSpy.mockRestore();
  });
});
