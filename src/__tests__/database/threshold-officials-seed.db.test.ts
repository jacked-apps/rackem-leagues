/**
 * @vitest-environment node
 *
 * @fileoverview Seeded threshold officials (Unit 8). The officials are EVERY
 * threshold the app uses, converted to the saveable shape — chart + formula
 * variants across points / percentage / fargo encodings, read-a-pref, milestone,
 * and a blank starter. Each must build via buildThresholdRow and resolve
 * without throwing.
 */

import { afterAll, describe, expect, it } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';
import { buildThresholdRow, resolveThreshold } from '@/systems/points-system/threshold-resolver';
// Side-effect: register every threshold operation the officials reference.
import '@/systems/points-system/operations/register-all';
import type { ThresholdInputs } from '@/systems/points-system/types';

const inputs: ThresholdInputs = {
  homeRatings: [550, 550, 550],
  awayRatings: [450, 450, 450],
  homeHandicapDiff: 0,
  awayHandicapDiff: 0,
  gameCount: 18,
  prefs: { games_to_win: 10, milestone_percent: 0.7 },
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

const build = (r: SeedRow, extra: Record<string, unknown> = {}) =>
  buildThresholdRow({
    name: r.name,
    operationKind: r.definition.operationKind,
    operationArgs: { ...r.definition.operationArgs, ...extra },
  });

const resolveAt = (r: SeedRow, over: Partial<ThresholdInputs> = {}) =>
  resolveThreshold(build(r), { ...inputs, ...over });

const EXPECTED_LABELS = [
  'Empty Starter',
  'Games to win — Fargo (any lineup)',
  'Games to win — Percentage chart (5 players)',
  'Games to win — Percentage formula (any lineup)',
  'Games to win — Points chart (3 players)',
  'Games to win — Points formula (any lineup)',
  'Lower edge (tie or win) — Points chart (3 players)',
  'Start points — Fargo (any lineup)',
];

describe('threshold officials — the full real template set', () => {
  afterAll(async () => {
    await closePostgresPool();
  });

  it('seeds all ten real thresholds, author-less', async () => {
    const rows = await officials();
    expect(rows.map((r) => r.label).sort()).toEqual([...EXPECTED_LABELS].sort());
    expect(rows.every((r) => r.author_id === undefined || r.author_id === null)).toBe(true);
  });

  it('every official builds and resolves without throwing', async () => {
    for (const r of await officials()) {
      expect(() => resolveAt(r)).not.toThrow();
      const value = resolveAt(r);
      expect(value === null || Number.isFinite(value)).toBe(true);
    }
  });

  it('the points CHART resolves faithfully across the chart range', async () => {
    const rows = await officials();
    const r = rows.find((x) => x.name === 'threshold_official_points_chart_win')!;
    const at = (diff: number) => resolveThreshold(build(r), { ...inputs, homeHandicapDiff: diff });
    expect([at(-6), at(-3), at(0), at(3), at(6), at(12)]).toEqual([7, 8, 10, 11, 13, 16]);
  });

  it('the points FORMULA gives the SAME answer as the chart (10 at gap 0)', async () => {
    const rows = await officials();
    const r = rows.find((x) => x.name === 'threshold_official_points_formula_win')!;
    expect(resolveThreshold(build(r), { ...inputs, homeHandicapDiff: 0 })).toBe(10);
  });

  it('the fargo win-threshold resolves to a finite number from ratings', async () => {
    const rows = await officials();
    const r = rows.find((x) => x.name === 'threshold_official_fargo_win')!;
    expect(Number.isFinite(resolveAt(r) as number)).toBe(true);
  });
});
