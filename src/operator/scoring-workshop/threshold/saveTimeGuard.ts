/**
 * @fileoverview Save-time guard for the threshold room. Before a threshold is
 * persisted, this validates the authored definition and runs a synthetic
 * dry-run through the real resolver — mirroring the allocator/trigger guards.
 *
 * A formula dry-runs straight through `resolveThreshold`. A chart_lookup first
 * loads its chart (so the dry-run resolves the same way the loader will at
 * match time). `home_away` thresholds dry-run both bindings; `single` runs
 * once. A finite number OR an intentional `null` is fine — the guard catches
 * config errors (unregistered op, unloadable chart, malformed row), not "no
 * value applies".
 */

import {
  buildThresholdRow,
  resolveThreshold,
} from '@/systems/points-system/threshold-resolver';
import { fetchResolvedChart } from '@/api/queries/thresholdCharts';
// Side-effect imports: ensure the threshold operations are registered so
// buildThresholdRow can resolve them during the dry-run.
import '@/systems/points-system/operations/evaluate-threshold-expression';
import '@/systems/points-system/operations/chart-lookup';
import type {
  ThresholdExpansionMode,
  ThresholdInputs,
} from '@/systems/points-system/types';
import type { ThresholdDefinition } from './useThresholdRoom';

export type GuardResult = { ok: true } | { ok: false; reason: string };

/** Representative inputs the dry-run resolves against. */
const SYNTHETIC_INPUTS: ThresholdInputs = {
  homeRatings: [400, 450, 500],
  awayRatings: [400, 450, 500],
  homeHandicapDiff: 0,
  awayHandicapDiff: 0,
  gameCount: 18,
  prefs: {},
  homeTeamHandicap: 10,
  awayTeamHandicap: 10,
};

export async function thresholdSaveGuard(
  definition: ThresholdDefinition,
  expansionMode: ThresholdExpansionMode,
): Promise<GuardResult> {
  let baseArgs: Record<string, unknown> = definition.operationArgs;

  // Chart-view: load the referenced chart so the dry-run resolves it the way
  // the loader will at match time.
  if (definition.operationKind === 'chart_lookup') {
    const chartId = baseArgs.chart_id;
    if (typeof chartId !== 'string' || chartId.length === 0) {
      return { ok: false, reason: 'Pick a chart for this threshold.' };
    }
    const chart = await fetchResolvedChart(chartId);
    if (!chart) {
      return { ok: false, reason: 'That chart could not be loaded.' };
    }
    baseArgs = { ...baseArgs, chart };
  }

  const sides: Array<'home' | 'away' | undefined> =
    expansionMode === 'home_away' ? ['home', 'away'] : [undefined];

  for (const side of sides) {
    const args = side ? { ...baseArgs, side } : baseArgs;
    try {
      const row = buildThresholdRow({
        name: '__dryrun__',
        operationKind: definition.operationKind,
        operationArgs: args,
      });
      resolveThreshold(row, SYNTHETIC_INPUTS);
    } catch (err) {
      return {
        ok: false,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  }
  return { ok: true };
}
