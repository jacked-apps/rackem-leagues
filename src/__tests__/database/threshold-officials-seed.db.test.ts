/**
 * @vitest-environment node
 *
 * @fileoverview Seeded threshold officials (Unit 8). The officials are the REAL
 * thresholds converted to the saveable shape — a blank formula starter plus the
 * 3v3 and 5v5 chart-based finish lines (chart rows embedded, clone-to-own).
 * Each must build via buildThresholdRow and resolve to a finite number.
 */

import { afterAll, describe, expect, it } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';
import { buildThresholdRow, resolveThreshold } from '@/systems/points-system/threshold-resolver';
// Side-effect imports: register the threshold operations the officials use.
import '@/systems/points-system/operations/evaluate-threshold-expression';
import '@/systems/points-system/operations/chart-lookup';
import type { ThresholdInputs } from '@/systems/points-system/types';

const inputs: ThresholdInputs = {
  homeRatings: [],
  awayRatings: [],
  homeHandicapDiff: 0,
  awayHandicapDiff: 0,
  gameCount: 18,
  prefs: {},
  homeTeamHandicap: 10,
  awayTeamHandicap: 10,
};

interface SeedRow {
  name: string;
  label: string;
  expansion_mode: string;
  definition: { operationKind: string; operationArgs: Record<string, unknown> };
}

async function officials(): Promise<SeedRow[]> {
  return executeSql(
    `SELECT name, label, expansion_mode, definition FROM thresholds WHERE scope = 'official' ORDER BY name`,
  );
}

const resolve = (r: SeedRow) =>
  resolveThreshold(
    buildThresholdRow({
      name: r.name,
      operationKind: r.definition.operationKind,
      operationArgs: r.definition.operationArgs,
    }),
    inputs,
  );

describe('threshold officials — real seeded templates', () => {
  afterAll(async () => {
    await closePostgresPool();
  });

  it('seeds the three real officials, all author-less', async () => {
    const rows = await officials();
    const labels = rows.map((r) => r.label).sort();
    expect(labels).toEqual(
      [
        '3v3 — Games to win (finish line)',
        '5v5 — Games to win (finish line)',
        'Empty Starter',
      ].sort(),
    );
    expect(rows.every((r) => r.definition.operationKind)).toBe(true);
  });

  it('the chart-based officials embed their chart rows (clone-to-own shape)', async () => {
    const rows = await officials();
    const threeV3 = rows.find((r) => r.name === 'threshold_official_3v3_finish')!;
    const chart = threeV3.definition.operationArgs.chart as { rows: unknown[]; chartType: string };
    expect(chart.chartType).toBe('team_points');
    expect(chart.rows.length).toBe(25);
  });

  it('every official builds and resolves to a finite number', async () => {
    for (const row of await officials()) {
      expect(Number.isFinite(resolve(row) as number)).toBe(true);
    }
  });

  it('the 3v3 finish line resolves to 10 at handicap gap 0 (faithful to the chart)', async () => {
    const rows = await officials();
    const threeV3 = rows.find((r) => r.name === 'threshold_official_3v3_finish')!;
    expect(resolve(threeV3)).toBe(10);
  });

  it('the empty starter resolves to 0', async () => {
    const rows = await officials();
    const empty = rows.find((r) => r.name === 'threshold_official_empty')!;
    expect(resolve(empty)).toBe(0);
  });
});
