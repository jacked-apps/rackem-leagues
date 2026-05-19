/**
 * @fileoverview Points 3-Man Scoring System — Points System composition.
 *
 * Per the locked Points System README, Points 3-Man's composition is:
 *  - 6 thresholds (per-side win/tie/lose targets, derived from the 3v3 chart)
 *  - 6 receipt triggers (one per threshold → assigns to a same-named variable)
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
import type { PointsSystem, Trigger } from '../types';

/**
 * Build a receipt trigger that assigns the trigger's bound input value (the
 * named threshold's resolved value, `n`) to a state variable of the same
 * name. Common pattern for surfacing chart values into the state bag so the
 * end-of-match aggregate (and future display code) can read them.
 *
 * `side` is the threshold's output side — matches the side prefix in the
 * threshold name (e.g., `homeWinTarget` → 'home'). The inputSpec ensures
 * the trigger only binds to a side-compatible threshold at build time.
 */
function assignThresholdToSelf(name: string, side: 'home' | 'away'): Trigger {
  return {
    name: `assign_${name}`,
    input: { thresholdRef: name },
    inputSpec: { outputType: 'game_target', outputSide: side },
    when: { kind: 'receipt' },
    action: {
      target: { kind: 'concrete', variableName: name },
      op: 'assign',
      value: { kind: 'input_ref' },
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
    triggers: [
      assignThresholdToSelf('homeWinTarget', 'home'),
      assignThresholdToSelf('awayWinTarget', 'away'),
      assignThresholdToSelf('homeTieTarget', 'home'),
      assignThresholdToSelf('awayTieTarget', 'away'),
      assignThresholdToSelf('homeLoseTarget', 'home'),
      assignThresholdToSelf('awayLoseTarget', 'away'),
    ],
    endOfMatchAggregate: {
      operationKind: 'linear_above_threshold',
      operationArgs: { multiplier: params.multiplier ?? 1 },
    },
  };

  validatePointsSystem(composition);
  return composition;
}
