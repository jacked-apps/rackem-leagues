/**
 * @fileoverview Threshold operation: `chart_lookup` (chart view, generalized).
 *
 * Unit 3 of the Threshold Workshop plan
 * (`docs/plans/2026-06-07-001-feat-threshold-workshop-plan.md`).
 *
 * The chart half of the threshold lookup-side fork. Unlike `chart_lookup_3v3`
 * (hardcoded to the BCA 3v3 TS chart), this operation resolves against ANY
 * chart — the threshold loader pulls the chart's rows along with the threshold
 * row and embeds them in `operationArgs.chart`, so this synchronous compute
 * just reads them (no DB at resolve time).
 *
 * **The comps come from the perspective pair the expansion binds**, not a
 * separate arg: `comp_1 = this_side`, `comp_2 = other_side`. A 1D team chart
 * reads one comp (the side's handicap diff); a 2D race chart reads both. The
 * same operation serves 1D and 2D charts with no branching on chart identity.
 *
 * **Arg shape:**
 *   - `chart: ResolvedChart` — embedded by the loader (rows + lookup mode).
 *   - `output_field: 'result_1' | 'result_2' | 'result_3'` — which column to
 *     return (the editor maps chart-type-specific labels onto these).
 *   - `side?: 'home' | 'away'` — the active binding's perspective.
 *
 * **Phase A scope:** 1D team charts resolve now (comp_1 = the side's handicap
 * diff). 2D per-pairing race charts need the per-matchup handicaps that
 * `ThresholdInputs` doesn't carry yet — that pairing feed is a future
 * assembly-room/runtime task, so a 2D chart resolves to `null` + warn here.
 *
 * **Never throws.** Missing/invalid chart, no matching row, or a deferred 2D
 * case returns `null` + console.warn.
 *
 * @see src/systems/threshold-charts/lookupChartRows.ts — the sync lookup
 * @see ./chart-lookup-3v3.ts — the registration pattern this mirrors
 */

import {
  lookupChartRows,
  type ChartLookupResult,
  type ResolvedChart,
} from '@/systems/threshold-charts/lookupChartRows';
import { registerThresholdOperation } from '../threshold-registry';
import type { ThresholdOperation, ThresholdOutputSide } from '../types';

function isResolvedChart(value: unknown): value is ResolvedChart {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ResolvedChart>;
  return (
    typeof v.chartType === 'string' &&
    (v.lookupMode === 'exact' || v.lookupMode === 'range') &&
    Array.isArray(v.rows)
  );
}

function isRaceChart(chart: ResolvedChart): boolean {
  return chart.chartType === 'race_points' || chart.chartType === 'race_percentage';
}

export const chartLookupOperation: ThresholdOperation = {
  name: 'chart_lookup',
  // Generic across chart encodings; the workshop validates that the chosen
  // chart matches the league's handicap encoding.
  consumesHandicapType: 'none',
  consumesSize: { kind: 'lineup_sizes', sizes: 'any' },
  producesOutputType: 'game_target',
  producesOutputSide: (args): ThresholdOutputSide => {
    const side = args.side;
    if (side === 'home' || side === 'away') return side;
    return 'shared';
  },
  producesOutputRange: { min: 0, max: 'games_in_match' },
  compute: (args, inputs) => {
    const chart = args.chart;
    if (!isResolvedChart(chart)) {
      console.warn(
        `chart_lookup: args.chart is not a ResolvedChart (loader did not embed it?); returning null`,
      );
      return null;
    }
    const field = args.output_field;
    if (field !== 'result_1' && field !== 'result_2' && field !== 'result_3') {
      console.warn(
        `chart_lookup: args.output_field must be result_1|result_2|result_3, got ${JSON.stringify(field)}; returning null`,
      );
      return null;
    }

    // 2D per-pairing charts need the per-matchup handicaps ThresholdInputs
    // doesn't carry yet — deferred to the assembly-room/runtime pairing feed.
    if (isRaceChart(chart)) {
      console.warn(
        `chart_lookup: 2D per-pairing chart resolution is deferred (no pairing feed in ThresholdInputs yet); returning null`,
      );
      return null;
    }

    // 1D team chart: comp_1 = the bound side's handicap diff.
    const comp1 =
      args.side === 'away' ? inputs.awayHandicapDiff : inputs.homeHandicapDiff;
    const result: ChartLookupResult | null = lookupChartRows(chart, comp1);
    if (!result) {
      console.warn(
        `chart_lookup: no chart row matched comp_1=${comp1}; returning null`,
      );
      return null;
    }
    return result[field as keyof ChartLookupResult] as number | null;
  },
};

/**
 * Side-effect: register the operation in the threshold registry at module load
 * time. Importing this file makes `'chart_lookup'` available for
 * `ThresholdRow.operationKind` references.
 */
export function registerChartLookup(): void {
  registerThresholdOperation(chartLookupOperation);
}

registerChartLookup();
