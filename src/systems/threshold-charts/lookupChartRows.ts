/**
 * @fileoverview Synchronous in-memory threshold-chart lookup.
 *
 * Unit 3 of the Threshold Workshop plan
 * (`docs/plans/2026-06-07-001-feat-threshold-workshop-plan.md`).
 *
 * A pure TS port of the `lookup_threshold(chart_id, comp_1, comp_2)` SQL
 * function (`supabase/migrations/20260410000002_threshold_charts.sql`). The DB
 * function can't run on a threshold operation's **synchronous** compute path,
 * so once a chart has been loaded (the threshold loader pulls its rows along
 * with the threshold row), resolution happens here in memory.
 *
 * Handles both lookup modes and the 2D race-chart upper-triangle optimization:
 *   - `exact`  — direct match on comp_1 (and comp_2 when present).
 *   - `range`  — VLOOKUP-style: the highest row whose comp_1 (and comp_2) are
 *     ≤ the inputs.
 *   - Race charts store only `comp_1 >= comp_2`; when the input pair is
 *     reversed we swap the comps and swap `result_1`/`result_3` back.
 *
 * Returns `null` when no row matches (caller treats as "no value applies").
 */

/** One row of a threshold chart (mirrors `threshold_chart_rows`). */
export interface ChartRow {
  readonly comp_1: number;
  readonly comp_2: number | null;
  readonly result_1: number;
  readonly result_2: number | null;
  readonly result_3: number;
  readonly sort_order?: number;
}

export type ChartType =
  | 'team_points'
  | 'team_percentage'
  | 'race_points'
  | 'race_percentage';

export type ChartLookupMode = 'exact' | 'range';

/** A chart resolved into memory: its metadata + all its rows. */
export interface ResolvedChart {
  readonly chartType: ChartType;
  readonly lookupMode: ChartLookupMode;
  readonly rows: readonly ChartRow[];
}

/** Result of a lookup — the three result columns + whether comps were swapped. */
export interface ChartLookupResult {
  readonly result_1: number;
  readonly result_2: number | null;
  readonly result_3: number;
  readonly was_swapped: boolean;
}

function isRaceChart(chartType: ChartType): boolean {
  return chartType === 'race_points' || chartType === 'race_percentage';
}

/**
 * Look up a comp value (or comp pair for 2D race charts) against an in-memory
 * chart. Mirrors the `lookup_threshold` SQL exactly. Returns `null` if no row
 * matches.
 */
export function lookupChartRows(
  chart: ResolvedChart,
  comp1: number,
  comp2: number | null = null,
): ChartLookupResult | null {
  // Race charts store only the upper triangle (comp_1 >= comp_2); normalize.
  let actual1 = comp1;
  let actual2 = comp2;
  let swapped = false;
  if (isRaceChart(chart.chartType) && comp2 !== null && comp1 < comp2) {
    actual1 = comp2;
    actual2 = comp1;
    swapped = true;
  }

  const match =
    chart.lookupMode === 'exact'
      ? findExact(chart.rows, actual1, actual2)
      : findRange(chart.rows, actual1, actual2);

  if (!match) return null;

  // When swapped, result_1 and result_3 swap back (player-1 / player-2 flip).
  if (swapped) {
    return {
      result_1: match.result_3,
      result_2: match.result_2,
      result_3: match.result_1,
      was_swapped: true,
    };
  }
  return {
    result_1: match.result_1,
    result_2: match.result_2,
    result_3: match.result_3,
    was_swapped: false,
  };
}

function compEquals(rowComp: number | null, input: number | null): boolean {
  if (rowComp === null && input === null) return true;
  return rowComp === input;
}

function findExact(
  rows: readonly ChartRow[],
  comp1: number,
  comp2: number | null,
): ChartRow | undefined {
  return rows.find(
    (r) => r.comp_1 === comp1 && compEquals(r.comp_2, comp2),
  );
}

/**
 * VLOOKUP-style: of all rows whose comp_1 (and comp_2, when relevant) are at
 * or below the input, take the highest comp_1 (then highest comp_2, NULLs
 * last) — matching the SQL's `ORDER BY comp_1 DESC, comp_2 DESC NULLS LAST`.
 */
function findRange(
  rows: readonly ChartRow[],
  comp1: number,
  comp2: number | null,
): ChartRow | undefined {
  const eligible = rows.filter(
    (r) =>
      r.comp_1 <= comp1 &&
      (comp2 === null || r.comp_2 === null || r.comp_2 <= comp2),
  );
  if (eligible.length === 0) return undefined;
  return [...eligible].sort((a, b) => {
    if (a.comp_1 !== b.comp_1) return b.comp_1 - a.comp_1; // comp_1 DESC
    // comp_2 DESC NULLS LAST
    const av = a.comp_2 ?? Number.NEGATIVE_INFINITY;
    const bv = b.comp_2 ?? Number.NEGATIVE_INFINITY;
    return bv - av;
  })[0];
}
