/**
 * @fileoverview Threshold operation: FargoRate start-points value for a specific side.
 *
 * Implements the `'fargo_start_points_for_side'` operation kind. Runs the
 * full FargoRate start-points formula against the league's home + away
 * lineup ratings; returns the start-points value if THIS SIDE is the
 * weaker team, otherwise 0.
 *
 * **Fixes Finding 2 from the architectural audit:** the previous prefs-based
 * thresholds (`initialHome`, `initialAway`) required the caller to
 * pre-compute the value and pass it through `inputs.prefs.initial_home` /
 * `initial_away`. That violated the "threshold is a pure function of match
 * inputs" principle — the threshold was just reading a pre-computed value
 * rather than doing the math itself. This operation does the math properly,
 * delegating to the FargoFormulaChart for the calibrated computation.
 *
 * **Arg shape:**
 *  - `side: 'home' | 'away'` — which side this threshold applies to. Returns
 *    the start-points value only if THIS SIDE is the weaker team in the
 *    Fargo computation; returns 0 otherwise.
 *
 * **Registered declarations:**
 *  - consumesHandicapType: `'fargo'` (consumes FargoRate ratings)
 *  - consumesSize: `{ lineup_sizes: 'any' }` (formula works for any roster size)
 *  - producesOutputType: `'points_headstart'` (start-points category)
 *
 * The dial values (`winner_points`, etc.) flow through `inputs.prefs` via
 * the FargoFormulaChart's `SystemOverrides` argument. Empty prefs uses the
 * chart's calibrated defaults (winner_points=10, AVG_LOSER_POINTS=4.2).
 *
 * @see src/systems/threshold-charts/fargo-formula.ts — the chart this delegates to
 */

import { fargoFormulaChart } from '@/systems/threshold-charts';
import { registerThresholdOperation } from '../threshold-registry';
import type { ThresholdOperation } from '../types';
import type { SystemOverrides } from '@/types/systemOverrides';

export const fargoStartPointsForSideOperation: ThresholdOperation = {
  name: 'fargo_start_points_for_side',
  consumesHandicapType: 'fargo',
  consumesSize: { kind: 'lineup_sizes', sizes: 'any' },
  producesOutputType: 'points_headstart',
  // Output side comes from args.side — this row produces the value FOR that
  // side specifically (0 if that side isn't the weaker team).
  producesOutputSide: (args) => {
    const side = args.side;
    if (side === 'home' || side === 'away') return side;
    throw new Error(
      `fargo_start_points_for_side: producesOutputSide expects args.side='home'|'away', got ${JSON.stringify(side)}`,
    );
  },
  // Start-points are nonneg; no calibrated upper bound short of theoretical caps.
  producesOutputRange: { min: 0, max: 'unbounded' },
  compute: (args, inputs) => {
    const side = args.side;
    if (side !== 'home' && side !== 'away') {
      throw new Error(
        `fargo_start_points_for_side: expected args.side to be 'home' or 'away', got ${JSON.stringify(side)}`,
      );
    }
    if (inputs.homeRatings.length === 0 || inputs.awayRatings.length === 0) {
      // Caller didn't supply rosters — can't compute start-points. Return 0
      // (no head-start applied) rather than throwing, to keep the operation
      // defensive at edge cases.
      return 0;
    }
    // Delegate to the FargoFormulaChart for the calibrated calculation.
    // Dial overrides come from prefs; chart's defaults apply if missing.
    const overrides: SystemOverrides = inputs.prefs as SystemOverrides;
    const result = fargoFormulaChart.compute(
      [...inputs.homeRatings],
      [...inputs.awayRatings],
      overrides,
    );
    // Return start-points only if this side IS the weaker team.
    return result.weakerTeam === side ? result.startPointsForWeakerTeam : 0;
  },
};

export function registerFargoStartPointsForSide(): void {
  registerThresholdOperation(fargoStartPointsForSideOperation);
}

registerFargoStartPointsForSide();
