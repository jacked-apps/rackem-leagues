/**
 * @vitest-environment node
 *
 * @fileoverview End-to-end resolution against the REAL seeded 3v3 Points chart
 * (Unit 3). Pulls the chart rows from the local DB, builds a ResolvedChart, and
 * runs both the sync lookup and the `chart_lookup` operation — proving the
 * resolution path produces correct values against actual seed data (not just
 * hand-made fixtures).
 */

import { afterAll, describe, expect, it } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';
import {
  lookupChartRows,
  type ChartType,
  type ChartLookupMode,
  type ResolvedChart,
  type ChartRow,
} from '@/systems/threshold-charts/lookupChartRows';
import { chartLookupOperation } from '@/systems/points-system/operations/chart-lookup';
import type { ThresholdInputs } from '@/systems/points-system/types';

const CHART_NAME = 'Rackem League 3v3 Points Chart';

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

async function loadSeededChart(): Promise<ResolvedChart> {
  const meta = await executeSql(
    `SELECT id, chart_type, lookup_mode FROM threshold_charts
     WHERE name = '${CHART_NAME}' AND entity_type = 'global'`,
  );
  expect(meta).toHaveLength(1);
  const { id, chart_type, lookup_mode } = meta[0];
  const rows = await executeSql(
    `SELECT comp_1, comp_2, result_1, result_2, result_3, sort_order
     FROM threshold_chart_rows WHERE chart_id = '${id}' ORDER BY sort_order`,
  );
  return {
    chartType: chart_type as ChartType,
    lookupMode: lookup_mode as ChartLookupMode,
    rows: rows.map(
      (r: Record<string, unknown>): ChartRow => ({
        comp_1: Number(r.comp_1),
        comp_2: r.comp_2 === null ? null : Number(r.comp_2),
        result_1: Number(r.result_1),
        result_2: r.result_2 === null ? null : Number(r.result_2),
        result_3: Number(r.result_3),
        sort_order: Number(r.sort_order),
      }),
    ),
  };
}

describe('threshold chart resolution — real seeded 3v3 Points chart', () => {
  afterAll(async () => {
    await closePostgresPool();
  });

  it('loads as an exact team_points chart with 25 rows', async () => {
    const chart = await loadSeededChart();
    expect(chart.chartType).toBe('team_points');
    expect(chart.lookupMode).toBe('exact');
    expect(chart.rows).toHaveLength(25);
  });

  it('sync lookup at diff 0 returns 10 / 9 / 8', async () => {
    const chart = await loadSeededChart();
    expect(lookupChartRows(chart, 0)).toMatchObject({ result_1: 10, result_2: 9, result_3: 8 });
  });

  it('chart_lookup operation resolves the home win target at diff 0', async () => {
    const chart = await loadSeededChart();
    const value = chartLookupOperation.compute(
      { chart, output_field: 'result_1', side: 'home' },
      inputs({ homeHandicapDiff: 0 }),
    );
    expect(value).toBe(10);
  });

  it('chart_lookup operation resolves the away mirror at diff +3', async () => {
    const chart = await loadSeededChart();
    const value = chartLookupOperation.compute(
      { chart, output_field: 'result_1', side: 'away' },
      inputs({ awayHandicapDiff: 3 }),
    );
    expect(value).toBe(11);
  });
});
