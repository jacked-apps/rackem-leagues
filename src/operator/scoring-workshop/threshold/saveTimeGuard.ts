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
// Side-effect: ensure every threshold operation is registered so the dry-run's
// buildThresholdRow can resolve whichever operation the threshold references.
import '@/systems/points-system/operations/register-all';
import type {
  ThresholdExpansionMode,
  ThresholdInputs,
} from '@/systems/points-system/types';
import type { ThresholdDefinition } from './useThresholdRoom';

export type GuardResult = { ok: true } | { ok: false; reason: string };

/** Representative inputs the dry-run resolves against (covers every op type). */
const SYNTHETIC_INPUTS: ThresholdInputs = {
  homeRatings: [500, 500, 500],
  awayRatings: [450, 450, 450],
  homeHandicapDiff: 0,
  awayHandicapDiff: 0,
  gameCount: 18,
  // Prefs the built-in read-a-setting / milestone thresholds reference.
  prefs: { games_to_win: 10, milestone_percent: 0.7 },
  homeTeamHandicap: 10,
  awayTeamHandicap: 10,
};

export async function thresholdSaveGuard(
  definition: ThresholdDefinition,
  expansionMode: ThresholdExpansionMode,
): Promise<GuardResult> {
  let baseArgs: Record<string, unknown> = definition.operationArgs;

  // Chart-view: resolve the same way the loader will at match time. A user-
  // owned threshold embeds its chart's rows inline; an unembedded one references
  // a chart by id and we load it.
  if (definition.operationKind === 'chart_lookup') {
    const embedded = baseArgs.chart;
    const hasEmbedded =
      embedded && typeof embedded === 'object' && Array.isArray((embedded as { rows?: unknown }).rows);
    if (!hasEmbedded) {
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
