/**
 * @fileoverview Start Points Mechanism — head-start on the points axis.
 *
 * Per the locked start-points.md variant page, the weaker team starts the
 * match with bonus points already on the board. The Mechanism declares the
 * shape; the actual start-points figure (plus the weakerTeam direction
 * discriminator) comes from a Fargo Formula Threshold Chart.
 *
 * Factory pattern: `createStartPointsMechanism(chart)` binds an instance of
 * this Mechanism to the FargoRate Formula Chart (the only chart that
 * currently produces start_points output; Charts for other encodings would
 * extend this).
 *
 * @see docs/league-system/modules/handicap-mechanisms/start-points.md
 */

import type { FargoFormulaChart } from '../threshold-charts/types';
import type { StartPointsMechanism } from './types';

/**
 * Build a Start Points Mechanism instance bound to a specific Fargo Formula
 * Chart. The Mechanism's `compute` delegates to the Chart's `compute`,
 * passing both teams' rating lists plus overrides through.
 *
 * @param chart A FargoFormulaChart variant.
 * @returns A StartPointsMechanism instance ready to feed into SystemModule.
 */
export function createStartPointsMechanism(
  chart: FargoFormulaChart,
): StartPointsMechanism {
  return {
    kind: 'start_points',
    compute: (homeRatings, awayRatings, overrides) =>
      chart.compute(homeRatings, awayRatings, overrides),
  };
}
