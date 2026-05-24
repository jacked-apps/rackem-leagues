/**
 * @fileoverview Race Points Chart — RESERVED (Points-encoded per-pairing race lengths).
 *
 * Per the locked Race Points variant page
 * (`docs/league-system/modules/threshold-charts/race-points.md`), this is a
 * 2D pairwise discrete-table Chart consuming Points-encoded handicaps for
 * both players in a pairing and producing per-side race lengths (output shape
 * coupled to the `race_length_adjustment` Mechanism).
 *
 * RESERVED — no shipping Scoring System uses this Chart today. Shipped as a
 * stub so the Module's catalog surface is complete and the registry can route
 * `chart_kind='race_points'` cleanly when a Points-encoded race-format
 * Scoring System eventually lands.
 *
 * The stub's `compute` throws — calling it is a contract violation that the
 * resolver should have prevented by routing `race_length_adjustment` matches
 * to a different Mechanism implementation today.
 *
 * @see docs/league-system/modules/threshold-charts/race-points.md
 */

import type { RaceLengthChart } from './types';

export const racePointsChart: RaceLengthChart = {
  kind: 'race_points',
  compute: () => {
    throw new Error(
      'racePointsChart.compute is RESERVED — no shipping Scoring System uses Race Points today',
    );
  },
};
