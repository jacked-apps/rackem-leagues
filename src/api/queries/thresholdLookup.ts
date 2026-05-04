/**
 * @fileoverview Threshold-chart RPC wrapper (Phase 3 Unit 3.1 of the
 * modular-league-system v2 plan).
 *
 * Async wrapper around the `lookup_threshold(chart_id, comp_1, comp_2)`
 * SQL function. The function lives in
 * `supabase/migrations/20260410000002_threshold_charts.sql` and reads
 * from the `threshold_charts` + `threshold_chart_rows` tables seeded
 * by `20260410000003_seed_threshold_charts.sql`.
 *
 * **Today's hot path stays synchronous.** The BCA preset modules
 * (`bca3v3`, `bca5v5`) read from hard-coded TS chart files
 * (`get3v3GamesNeeded`, `get5v5GamesNeeded`) — those values match the
 * seeded DB rows row-for-row, locked by characterization tests.
 *
 * **This wrapper is the entry point for:**
 *   - Layer 3 LO custom-chart overrides (Unit 3.4 — chart editor UI):
 *     when an LO sets `preferences.threshold_chart_id`, threshold
 *     compute routes through this async path against the LO's chart.
 *   - The BCAPL Skill Level chart (Unit 3.3 — parked, but the lookup
 *     primitive lives here).
 *   - On-demand chart preview / debugging in the wizard.
 *
 * The wrapper does NOT modify the existing synchronous threshold
 * compute path — that refactor (move BCA presets off TS into pure
 * RPC reads) is a follow-up that can wait until charts other than
 * the seeded presets actually need to be queryable from runtime
 * scoring code.
 *
 * @see docs/plans/2026-05-01-001-feat-modular-league-system-v2-plan.md (Unit 3.1)
 * @see supabase/migrations/20260410000002_threshold_charts.sql (function definition)
 */

import { supabase } from '@/supabaseClient';
import type { HandicapThresholds } from '@/types';

/**
 * Names of the seeded "global" Rackem League standard charts. Useful
 * for callers that want to look up the canonical preset chart by name
 * (the chart UUID is generated at migration time and isn't stable
 * across `db reset` runs).
 */
export const SEEDED_CHART_NAMES = {
  /** BCA 3v3 points handicap chart — 18-game DRR. */
  bca3v3Points: 'Rackem League 3v3 Points Chart',
  /** BCA 5v5 percentage handicap chart — 25-game SRR. */
  bca5v5Percentage: 'Rackem League 5v5 Percentage Chart',
  /** Per-player race chart driven by points handicap. */
  racePoints: 'Rackem League Race Points Chart',
  /** Per-player race chart driven by percentage handicap. */
  racePercentage: 'Rackem League Race Percentage Chart',
} as const;

/**
 * Raw result of a threshold-chart lookup. The three integer columns
 * carry whatever the chart's `chart_type` defines:
 *   - `team_points` / `team_percentage` charts: result_1=games_to_win,
 *     result_2=games_to_tie (nullable when the diff doesn't allow a
 *     tie), result_3=games_to_lose.
 *   - `race_points` / `race_percentage` charts: result_1=race for
 *     comp_1's side, result_2 unused (typically null), result_3=race
 *     for comp_2's side. `was_swapped=true` when comp_1 < comp_2 and
 *     the function swapped the result columns.
 */
export interface RawLookupThresholdResult {
  result_1: number | null;
  result_2: number | null;
  result_3: number | null;
  was_swapped: boolean;
}

/**
 * Find the seeded chart UUID by its global name.
 *
 * Returns `null` when no chart with that name exists (e.g. fresh DB
 * before seeds run, or a typo). Callers should fall back to the TS
 * chart hot-path on null.
 */
export async function getGlobalChartIdByName(
  name: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('threshold_charts')
    .select('id')
    .eq('entity_type', 'global')
    .eq('name', name)
    .maybeSingle();

  if (error) {
    console.warn(
      `[thresholdLookup] failed to look up chart "${name}":`,
      error.message,
    );
    return null;
  }
  return data?.id ?? null;
}

/**
 * Call the `lookup_threshold` SQL function for the given chart and
 * comparison values. Returns `null` when no row matches (range-mode
 * chart input below the lowest band, or exact-mode lookup with no
 * row at the requested coordinates).
 *
 * Caller decides what to do on `null` — typically falls back to the
 * TS chart hot-path or surfaces "no calibrated values" in the UI.
 */
export async function lookupThresholdRaw(
  chartId: string,
  comp1: number,
  comp2: number | null = null,
): Promise<RawLookupThresholdResult | null> {
  const { data, error } = await supabase.rpc('lookup_threshold', {
    p_chart_id: chartId,
    p_comp_1: comp1,
    p_comp_2: comp2,
  });

  if (error) {
    console.warn(
      `[thresholdLookup] RPC error for chart ${chartId} (comp1=${comp1}, comp2=${comp2}):`,
      error.message,
    );
    return null;
  }
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return null;
  }
  // The function returns TABLE (...), so Supabase serializes a single-row
  // result as either an object or a one-element array depending on driver
  // version. Normalize.
  const row = Array.isArray(data) ? data[0] : data;
  return {
    result_1: (row as any).result_1 ?? null,
    result_2: (row as any).result_2 ?? null,
    result_3: (row as any).result_3 ?? null,
    was_swapped: (row as any).was_swapped ?? false,
  };
}

/**
 * Convenience wrapper for the BCA-style team-points / team-percentage
 * charts: returns the result in the shape the rest of the codebase
 * uses (`HandicapThresholds`). For race charts use
 * `lookupThresholdRaw` directly — the result columns mean different
 * things there.
 *
 * Behavior on a missing row: returns `null` so the caller can fall
 * back to the TS chart hot-path or report "no calibrated values."
 */
export async function lookupTeamThresholds(
  chartId: string,
  handicapDiff: number,
): Promise<HandicapThresholds | null> {
  const raw = await lookupThresholdRaw(chartId, handicapDiff);
  if (!raw) return null;
  if (raw.result_1 == null) return null;
  return {
    games_to_win: raw.result_1,
    games_to_tie: raw.result_2,
    games_to_lose: raw.result_3,
  };
}
