/**
 * @fileoverview Race Length Adjustment Mechanism — extended-finish on the
 * games axis, per-pairing scope.
 *
 * Per the locked race-length-adjustment.md variant page, each individual
 * pairing plays a race-to-N where N differs by skill diff — the higher-rated
 * player has a longer race. Per-pairing scope; race termination.
 *
 * RESERVED today — no shipping Scoring System uses this Mechanism, and both
 * Race Charts (`racePointsChart`, `racePercentageChart`) ship as RESERVED
 * stubs. The factory exists so the Module catalog surface is complete and
 * when a real Race Chart lands the Mechanism wires through automatically.
 *
 * @see docs/league-system/modules/handicap-mechanisms/race-length-adjustment.md
 */

import type { RaceLengthChart } from '../threshold-charts/types';
import type { RaceLengthAdjustmentMechanism } from './types';

/**
 * Build a Race Length Adjustment Mechanism instance bound to a specific
 * Race Length Chart. Both shipping Race Charts are RESERVED stubs today,
 * so calling `compute` will throw with the chart's RESERVED error.
 *
 * @param chart A RaceLengthChart variant (race_points or race_percentage).
 * @returns A RaceLengthAdjustmentMechanism instance.
 */
export function createRaceLengthAdjustmentMechanism(
  chart: RaceLengthChart,
): RaceLengthAdjustmentMechanism {
  return {
    kind: 'race_length_adjustment',
    compute: (homeRatings, awayRatings, overrides) => {
      // Race charts take per-pairing handicaps (a single home + single away
      // value). The current Mechanism signature passes whole roster arrays
      // for consistency with start_points; future per-pairing iteration logic
      // belongs in the consumer (Pairings Generator extraction), not here.
      // For now: pass through the first element of each side as a stand-in
      // so the chart receives the typed shape it expects. Since both Race
      // Charts ship as RESERVED stubs, this call throws regardless.
      if (homeRatings.length === 0 || awayRatings.length === 0) {
        throw new Error(
          'createRaceLengthAdjustmentMechanism: ratings arrays must be non-empty',
        );
      }
      return chart.compute(homeRatings[0]!, awayRatings[0]!, overrides);
    },
  };
}
