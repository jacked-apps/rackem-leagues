/**
 * @fileoverview Threshold-chart read query for resolution.
 *
 * Unit 3 of the Threshold Workshop plan
 * (`docs/plans/2026-06-07-001-feat-threshold-workshop-plan.md`).
 *
 * `fetchResolvedChart(id)` pulls a chart's metadata + all its rows into the
 * in-memory `ResolvedChart` shape the synchronous `chart_lookup` operation
 * reads. The threshold loader calls this so the chart rides INSIDE the loaded
 * threshold (one DB load), keeping the compute path synchronous.
 *
 * Never throws — a missing chart, a supabase error, or an unexpected failure
 * logs a `console.warn` and returns `null` (the threshold then resolves to
 * `null`, the room's never-break contract).
 *
 * The chart WRITE layer (create / copy-global-to-league / replace-rows) is
 * built with the Phase B chart editor that consumes it (plan Unit 6); this
 * file is read-only resolution support.
 *
 * @see src/systems/threshold-charts/lookupChartRows.ts — ResolvedChart shape
 * @see src/api/queries/thresholdLookup.ts — the existing async RPC read path
 */

import { supabase } from '@/supabaseClient';
import type {
  ChartLookupMode,
  ChartRow,
  ChartType,
  ResolvedChart,
} from '@/systems/threshold-charts/lookupChartRows';

const CHART_TYPES: readonly ChartType[] = [
  'team_points',
  'team_percentage',
  'race_points',
  'race_percentage',
];

/**
 * Load a chart + its rows into memory. Returns `null` on any failure (chart
 * not found, supabase error, unexpected throw, or a malformed chart_type /
 * lookup_mode). Never throws.
 */
export async function fetchResolvedChart(
  chartId: string,
): Promise<ResolvedChart | null> {
  try {
    const { data: chart, error: chartErr } = await supabase
      .from('threshold_charts')
      .select('chart_type, lookup_mode')
      .eq('id', chartId)
      .maybeSingle();
    if (chartErr) {
      console.warn(`[fetchResolvedChart] supabase error for id=${chartId}: ${chartErr.message}`);
      return null;
    }
    if (!chart) {
      console.warn(`[fetchResolvedChart] no chart found for id=${chartId}`);
      return null;
    }

    const chartType = chart.chart_type as ChartType;
    const lookupMode = chart.lookup_mode as ChartLookupMode;
    if (!(CHART_TYPES as readonly string[]).includes(chartType)) {
      console.warn(`[fetchResolvedChart] unknown chart_type "${chartType}" for id=${chartId}`);
      return null;
    }
    if (lookupMode !== 'exact' && lookupMode !== 'range') {
      console.warn(`[fetchResolvedChart] unknown lookup_mode "${lookupMode}" for id=${chartId}`);
      return null;
    }

    const { data: rows, error: rowsErr } = await supabase
      .from('threshold_chart_rows')
      .select('comp_1, comp_2, result_1, result_2, result_3, sort_order')
      .eq('chart_id', chartId)
      .order('sort_order', { ascending: true });
    if (rowsErr) {
      console.warn(`[fetchResolvedChart] supabase error loading rows for id=${chartId}: ${rowsErr.message}`);
      return null;
    }

    return {
      chartType,
      lookupMode,
      rows: ((rows ?? []) as ChartRow[]).map((r) => ({
        comp_1: Number(r.comp_1),
        comp_2: r.comp_2 === null || r.comp_2 === undefined ? null : Number(r.comp_2),
        result_1: Number(r.result_1),
        result_2: r.result_2 === null || r.result_2 === undefined ? null : Number(r.result_2),
        result_3: Number(r.result_3),
        sort_order: r.sort_order,
      })),
    };
  } catch (err) {
    console.warn(
      `[fetchResolvedChart] unexpected error for id=${chartId}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}
