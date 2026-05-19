/**
 * @fileoverview Points 3-Man Scoring System — Points System composition.
 *
 * Per the locked Points System README, Points 3-Man's composition is:
 *  - 6 thresholds (per-side win/tie/lose targets, derived from the 3v3 chart)
 *  - 6 receipt triggers (one per threshold → assigns to a same-named variable)
 *  - 1 end-of-match aggregate (linearAboveThresholdAggregate) with the
 *    locked 3v3 9-9 tie-band absorption rule baked into its formula
 *
 * **Slice 2 of the Threshold refactor (2026-05-19):** migrated to the
 * data-driven `ThresholdRow` shape per the Ed-walked architecture. Each
 * threshold names an operation kind in the registry (`'chart_lookup_3v3'`)
 * and supplies args (which side's diff, which chart output field). No
 * inline `compute` functions — everything is data that could load from a
 * future DB row without code change.
 *
 * @see ../runtime.ts — the runtime that consumes this composition
 * @see ../aggregate.ts — the linearAboveThresholdAggregate primitive
 * @see ../operations/chart-lookup-3v3.ts — the registered chart operation
 */

import { linearAboveThresholdAggregate } from '../aggregate';
// Importing this file auto-registers the chart_lookup_3v3 operation into
// the threshold registry — see the module's bottom-of-file side effect.
import '../operations/chart-lookup-3v3';
import { buildThresholdRow } from '../threshold-resolver';
import type { PointsSystem, Trigger } from '../types';

/**
 * Build a receipt trigger that assigns the named threshold's value to a
 * variable of the same name. Common pattern for the chart-value assignments.
 */
function assignThresholdToSelf(name: string): Trigger {
  return {
    name: `assign_${name}`,
    when: { kind: 'receipt', thresholdRef: name },
    action: {
      target: { kind: 'concrete', variableName: name },
      op: 'assign',
      value: { kind: 'threshold_ref', thresholdRef: name },
    },
  };
}

/**
 * Build the Points 3-Man Scoring System's Points System composition.
 *
 * @param params Optional multiplier (default 1) for the linear bands.
 */
export function buildPoints3ManComposition(
  params: { multiplier?: number } = {},
): PointsSystem {
  return {
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
    triggers: [
      assignThresholdToSelf('homeWinTarget'),
      assignThresholdToSelf('awayWinTarget'),
      assignThresholdToSelf('homeTieTarget'),
      assignThresholdToSelf('awayTieTarget'),
      assignThresholdToSelf('homeLoseTarget'),
      assignThresholdToSelf('awayLoseTarget'),
    ],
    endOfMatchAggregate: linearAboveThresholdAggregate(params),
  };
}
