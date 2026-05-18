/**
 * @fileoverview Points 3-Man Scoring System — Points System composition.
 *
 * Per the locked Points System README, Points 3-Man's composition is just
 * **(D) end-of-match aggregate**: `points = games_won − threshold` with the
 * locked 3v3 9-9 tie-band absorption rule.
 *
 * The composition declares:
 * - 6 thresholds (per-side win/tie/lose targets, derived from the chart)
 * - 6 receipt triggers (one per threshold → assigns to a same-named variable)
 * - 1 end-of-match aggregate (linearAboveThresholdAggregate)
 *
 * Phase A: this is built as a factory so the cross-audit and future
 * consumers can instantiate with different params (multiplier, etc.).
 *
 * @see ../runtime.ts — the runtime that consumes this composition
 * @see ../aggregate.ts — the linearAboveThresholdAggregate primitive
 */

import { get3v3GamesNeeded } from '@/utils/handicap/get3v3GamesNeeded';
import { linearAboveThresholdAggregate } from '../aggregate';
import { computedThreshold } from '../threshold-helpers';
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
      homeWinTarget: computedThreshold('homeWinTarget', (inputs) =>
        get3v3GamesNeeded(inputs.homeHandicapDiff).games_to_win,
      ),
      awayWinTarget: computedThreshold('awayWinTarget', (inputs) =>
        get3v3GamesNeeded(inputs.awayHandicapDiff).games_to_win,
      ),
      // games_to_tie on the chart is nullable (null at odd handicap diffs
      // where ties aren't possible). The Threshold type allows null directly;
      // the aggregate's nullableNumber reader accepts null and treats it as
      // "no tie band" in its formula.
      homeTieTarget: computedThreshold(
        'homeTieTarget',
        (inputs) => get3v3GamesNeeded(inputs.homeHandicapDiff).games_to_tie,
      ),
      awayTieTarget: computedThreshold(
        'awayTieTarget',
        (inputs) => get3v3GamesNeeded(inputs.awayHandicapDiff).games_to_tie,
      ),
      homeLoseTarget: computedThreshold('homeLoseTarget', (inputs) =>
        get3v3GamesNeeded(inputs.homeHandicapDiff).games_to_lose,
      ),
      awayLoseTarget: computedThreshold('awayLoseTarget', (inputs) =>
        get3v3GamesNeeded(inputs.awayHandicapDiff).games_to_lose,
      ),
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
