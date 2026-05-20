/**
 * @fileoverview Points 3-Man Scoring System — Points System composition.
 *
 * Per the locked Points System README, Points 3-Man's composition is:
 *  - 6 thresholds (per-side win/tie/lose targets, derived from the 3v3 chart).
 *    Thresholds are state setters — the runtime writes each resolved value into
 *    the state bag under its name at match start (no copy-trigger needed).
 *  - 1 end-of-match aggregate (data-driven `linear_above_threshold` operation)
 *    with the locked 3v3 9-9 tie-band absorption rule baked into the operation
 *
 * Thresholds + aggregate are both data-driven: each names a registered
 * operation kind + args. No inline `compute` functions — everything is data
 * that could load from a future DB row without code change.
 *
 * @see ../runtime.ts — the runtime that consumes this composition
 * @see ../aggregate-operations/linear-above-threshold.ts — the aggregate operation
 * @see ../operations/chart-lookup-3v3.ts — the registered chart operation
 */

// Importing these auto-registers the operations into their registries.
import '../operations/chart-lookup-3v3';
import '../aggregate-operations/linear-above-threshold';

import { validatePointsSystem } from '../composition-validator';
import { buildThresholdRow } from '../threshold-resolver';
import type { PointsSystem } from '../types';

/**
 * Build the Points 3-Man Scoring System's Points System composition.
 *
 * @param params Optional multiplier (default 1) for the linear bands.
 */
export function buildPoints3ManComposition(
  params: { multiplier?: number } = {},
): PointsSystem {
  const composition: PointsSystem = {
    name: 'points_3man',
    thresholds: {
      homeWinTarget: buildThresholdRow({
        name: 'homeWinTarget',
        operationKind: 'chart_lookup_3v3',
        operationArgs: { side: 'home', output_field: 'games_to_win' },
      }),
      awayWinTarget: buildThresholdRow({
        name: 'awayWinTarget',
        operationKind: 'chart_lookup_3v3',
        operationArgs: { side: 'away', output_field: 'games_to_win' },
      }),
      homeTieTarget: buildThresholdRow({
        name: 'homeTieTarget',
        operationKind: 'chart_lookup_3v3',
        operationArgs: { side: 'home', output_field: 'games_to_tie' },
      }),
      awayTieTarget: buildThresholdRow({
        name: 'awayTieTarget',
        operationKind: 'chart_lookup_3v3',
        operationArgs: { side: 'away', output_field: 'games_to_tie' },
      }),
      homeLoseTarget: buildThresholdRow({
        name: 'homeLoseTarget',
        operationKind: 'chart_lookup_3v3',
        operationArgs: { side: 'home', output_field: 'games_to_lose' },
      }),
      awayLoseTarget: buildThresholdRow({
        name: 'awayLoseTarget',
        operationKind: 'chart_lookup_3v3',
        operationArgs: { side: 'away', output_field: 'games_to_lose' },
      }),
    },
    // No triggers: thresholds write themselves into the state bag (state
    // setters), and the end-of-match scoring reads those state vars directly.
    triggers: [],
    endOfMatchAggregate: {
      operationKind: 'linear_above_threshold',
      operationArgs: { multiplier: params.multiplier ?? 1 },
    },
  };

  validatePointsSystem(composition);
  return composition;
}
