/**
 * @fileoverview Threshold Charts registry + public exports.
 *
 * `getThresholdChart(chartKind)` is the runtime entry point for selecting which
 * Chart variant a league uses. Today's three prepackaged Scoring Systems each
 * use exactly one Chart; future LO-customized leagues will swap Charts at the
 * cascade scope (global → org → league) via the `threshold_charts` DB table.
 *
 * Phase A of the Threshold Charts extraction (following the Team Geometry /
 * Match Format / Handicap Systems extraction pattern): create the Module's
 * interface + 5 variant implementations in isolation, no consumer changes.
 * Phase B wires `thresholdChart: ThresholdChart | null` into SystemModule
 * alongside the existing `threshold` capability. Phase C swaps the active
 * consumers (`fargo5v5.threshold.compute`, the BCA chart pointers in
 * `buildSystemFromPreferences`); Phase D removes the legacy `threshold` field.
 *
 * @see ./types.ts — the type definitions
 * @see docs/league-system/modules/threshold-charts/README.md — the locked blueprint
 */

import type { ChartKind, ThresholdChart } from './types';
import { gamesNeeded3v3Chart } from './games-needed-3v3';
import { gamesNeeded5v5Chart } from './games-needed-5v5';
import { fargoFormulaChart } from './fargo-formula';
import { racePointsChart } from './race-points';
import { racePercentageChart } from './race-percentage';

/**
 * Look up a Threshold Chart Module by chart kind.
 *
 * @param chartKind One of the 5 catalog variants.
 * @returns The corresponding Chart Module.
 *
 * Strict: throws on unknown values via the exhaustive switch. Callers should
 * have validated the kind at write-time; an unknown value here is a contract
 * violation (DB CHECK constraint should have caught it).
 */
export function getThresholdChart(chartKind: ChartKind): ThresholdChart {
  switch (chartKind) {
    case 'games_needed_3v3':
      return gamesNeeded3v3Chart;
    case 'games_needed_5v5':
      return gamesNeeded5v5Chart;
    case 'fargo_formula':
      return fargoFormulaChart;
    case 'race_points':
      return racePointsChart;
    case 'race_percentage':
      return racePercentageChart;
  }
}

// Re-exports for convenience: `import { ... } from '@/systems/threshold-charts'`.
export type {
  ChartKind,
  ThresholdChart,
  GamesNeededChart,
  FargoFormulaChart,
  RaceLengthChart,
} from './types';
export { gamesNeeded3v3Chart } from './games-needed-3v3';
export { gamesNeeded5v5Chart } from './games-needed-5v5';
export { fargoFormulaChart } from './fargo-formula';
export { racePointsChart } from './race-points';
export { racePercentageChart } from './race-percentage';
