/**
 * @fileoverview Race Percentage Chart — RESERVED (Percentage-encoded per-pairing race lengths).
 *
 * Per the locked Race Percentage variant page
 * (`docs/league-system/modules/threshold-charts/race-percentage.md`), this is
 * a 2D gap × tier discrete-table Chart consuming Percentage-encoded handicaps
 * for both players in a pairing and producing per-side race lengths (output
 * shape coupled to the `race_length_adjustment` Mechanism).
 *
 * RESERVED — no shipping Scoring System uses this Chart today. Shipped as a
 * stub for catalog completeness; same rationale as `racePointsChart`.
 *
 * @see docs/league-system/modules/threshold-charts/race-percentage.md
 */

import type { RaceLengthChart } from './types';

export const racePercentageChart: RaceLengthChart = {
  kind: 'race_percentage',
  compute: () => {
    throw new Error(
      'racePercentageChart.compute is RESERVED — no shipping Scoring System uses Race Percentage today',
    );
  },
};
