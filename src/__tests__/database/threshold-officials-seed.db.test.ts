/**
 * @vitest-environment node
 *
 * @fileoverview Seeded threshold officials (Unit 8 — formula officials).
 * Each seeded official must load via buildThresholdRow and resolve to a finite
 * number through the real evaluate_expression operation.
 */

import { afterAll, describe, expect, it } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';
import { buildThresholdRow, resolveThreshold } from '@/systems/points-system/threshold-resolver';
// Side-effect import: registers the 'evaluate_expression' threshold operation.
import '@/systems/points-system/operations/evaluate-threshold-expression';
import type { ThresholdInputs } from '@/systems/points-system/types';

const inputs: ThresholdInputs = {
  homeRatings: [],
  awayRatings: [],
  homeHandicapDiff: 0,
  awayHandicapDiff: 0,
  gameCount: 18,
  prefs: {},
  homeTeamHandicap: 12,
  awayTeamHandicap: 9,
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

describe('threshold officials — seeded formula templates', () => {
  afterAll(async () => {
    await closePostgresPool();
  });

  it('seeds the three formula officials, all author-less', async () => {
    const rows = await officials();
    const labels = rows.map((r) => r.label).sort();
    expect(labels).toEqual(
      ['Empty Starter', 'Head start by handicap gap', 'Three-quarter mark'].sort(),
    );
  });

  it('every official builds a valid ThresholdRow and resolves to a finite number', async () => {
    const rows = await officials();
    for (const row of rows) {
      const built = buildThresholdRow({
        name: row.name,
        operationKind: row.definition.operationKind,
        operationArgs: row.definition.operationArgs,
      });
      const value = resolveThreshold(built, inputs);
      expect(Number.isFinite(value as number)).toBe(true);
    }
  });

  it('resolves the known values (empty=0, three-quarter=13.5, head-start=3)', async () => {
    const rows = await officials();
    const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
    const resolve = (r: SeedRow) =>
      resolveThreshold(
        buildThresholdRow({
          name: r.name,
          operationKind: r.definition.operationKind,
          operationArgs: r.definition.operationArgs,
        }),
        inputs,
      );
    expect(resolve(byName.threshold_official_empty)).toBe(0);
    expect(resolve(byName.threshold_official_three_quarter)).toBe(13.5);
    // home perspective: this_side(home)=12 − other_side(away)=9 = 3
    expect(resolve(byName.threshold_official_head_start)).toBe(3);
  });
});
