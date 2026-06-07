/**
 * @fileoverview Tests for fetchResolvedChart (Unit 3) — pulls a chart + rows
 * into the in-memory ResolvedChart shape. Never throws (null + warn).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockChartMaybeSingle = vi.fn();
const mockRowsOrder = vi.fn();

vi.mock('@/supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'threshold_charts') {
        return { select: () => ({ eq: () => ({ maybeSingle: mockChartMaybeSingle }) }) };
      }
      return { select: () => ({ eq: () => ({ order: mockRowsOrder }) }) };
    },
  },
}));

import { fetchResolvedChart } from '../thresholdCharts';

const ID = '3852b39e-a043-40b5-9508-ae7b2ed4aeb5';

beforeEach(() => {
  mockChartMaybeSingle.mockReset();
  mockRowsOrder.mockReset();
});

describe('fetchResolvedChart — happy path', () => {
  it('maps chart metadata + rows into a ResolvedChart', async () => {
    mockChartMaybeSingle.mockResolvedValue({
      data: { chart_type: 'team_points', lookup_mode: 'exact' },
      error: null,
    });
    mockRowsOrder.mockResolvedValue({
      data: [
        { comp_1: '0', comp_2: null, result_1: 10, result_2: 9, result_3: 8, sort_order: 0 },
        { comp_1: '3', comp_2: null, result_1: 11, result_2: null, result_3: 10, sort_order: 1 },
      ],
      error: null,
    });
    const chart = await fetchResolvedChart(ID);
    expect(chart).not.toBeNull();
    expect(chart?.chartType).toBe('team_points');
    expect(chart?.lookupMode).toBe('exact');
    expect(chart?.rows).toHaveLength(2);
    // Numeric coercion from NUMERIC strings.
    expect(chart?.rows[0]).toMatchObject({ comp_1: 0, comp_2: null, result_1: 10 });
  });
});

describe('fetchResolvedChart — failures (null + warn)', () => {
  it('returns null when the chart is not found', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockChartMaybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await fetchResolvedChart(ID)).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('no chart found'));
    warnSpy.mockRestore();
  });

  it('returns null on a supabase error', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockChartMaybeSingle.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await fetchResolvedChart(ID)).toBeNull();
    warnSpy.mockRestore();
  });

  it('returns null on an unknown chart_type', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockChartMaybeSingle.mockResolvedValue({
      data: { chart_type: 'banana', lookup_mode: 'exact' },
      error: null,
    });
    expect(await fetchResolvedChart(ID)).toBeNull();
    warnSpy.mockRestore();
  });
});
