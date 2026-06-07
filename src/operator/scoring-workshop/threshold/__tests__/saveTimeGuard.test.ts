/**
 * @fileoverview Tests for the threshold save-time guard. Dry-runs the authored
 * definition through the real resolver; accepts formula + chart thresholds,
 * rejects unresolvable ones.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetchResolvedChart = vi.fn();
vi.mock('@/api/queries/thresholdCharts', () => ({
  fetchResolvedChart: (...args: unknown[]) => mockFetchResolvedChart(...args),
}));

import { thresholdSaveGuard } from '../saveTimeGuard';
import type { ThresholdDefinition } from '../useThresholdRoom';

const constFormula: ThresholdDefinition = {
  operationKind: 'evaluate_expression',
  operationArgs: { expression: { kind: 'const', value: 5 } },
};

const mirroredFormula: ThresholdDefinition = {
  operationKind: 'evaluate_expression',
  operationArgs: {
    expression: {
      kind: 'op',
      op: '-',
      left: { kind: 'var', name: 'this_side_team_handicap' },
      right: { kind: 'var', name: 'other_side_team_handicap' },
    },
  },
};

const chartDef: ThresholdDefinition = {
  operationKind: 'chart_lookup',
  operationArgs: { chart_id: 'chart-1', output_field: 'result_1' },
};

beforeEach(() => mockFetchResolvedChart.mockReset());

describe('thresholdSaveGuard — accepts resolvable thresholds', () => {
  it('accepts a side-less constant formula', async () => {
    expect(await thresholdSaveGuard(constFormula, 'single')).toEqual({ ok: true });
  });

  it('accepts a mirrored formula (both bindings resolve)', async () => {
    expect(await thresholdSaveGuard(mirroredFormula, 'home_away')).toEqual({ ok: true });
  });

  it('accepts a chart threshold whose chart loads and resolves', async () => {
    mockFetchResolvedChart.mockResolvedValue({
      chartType: 'team_points',
      lookupMode: 'exact',
      rows: [{ comp_1: 0, comp_2: null, result_1: 10, result_2: 9, result_3: 8 }],
    });
    expect(await thresholdSaveGuard(chartDef, 'home_away')).toEqual({ ok: true });
    expect(mockFetchResolvedChart).toHaveBeenCalledWith('chart-1');
  });
});

describe('thresholdSaveGuard — rejects unresolvable thresholds', () => {
  it('rejects a chart that cannot be loaded', async () => {
    mockFetchResolvedChart.mockResolvedValue(null);
    const res = await thresholdSaveGuard(chartDef, 'single');
    expect(res.ok).toBe(false);
  });

  it('rejects a chart definition with no chart_id', async () => {
    const res = await thresholdSaveGuard(
      { operationKind: 'chart_lookup', operationArgs: { output_field: 'result_1' } },
      'single',
    );
    expect(res).toEqual({ ok: false, reason: 'Pick a chart for this threshold.' });
  });

  it('rejects an unknown operation kind', async () => {
    const res = await thresholdSaveGuard(
      { operationKind: 'ghost_op', operationArgs: {} },
      'single',
    );
    expect(res.ok).toBe(false);
  });
});
