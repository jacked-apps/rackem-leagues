/**
 * @fileoverview Handicap Threshold Lookup (thin adapter)
 *
 * Delegates to the SystemModule resolver introduced in Phase 1 of the modular
 * handicap/scoring refactor. Callers continue to call getGamesNeeded() exactly
 * as before — no signature changes — but the routing now flows through
 * SystemModule.thresholdChart.compute() so future systems can be added by
 * writing a single Chart variant without touching this file or its callers.
 *
 * Characterization tests in
 *   src/utils/handicap/__tests__/getGamesNeeded.characterization.test.ts
 * guarantee the post-refactor output matches the pre-refactor behavior exactly.
 */

import { pickModule } from '@/systems/resolver';
import type { HandicapThresholds } from './get3v3GamesNeeded';
import { get5v5GamesNeeded as get5v5GamesNeededChart } from './get5v5GamesNeeded';

export type { HandicapThresholds } from './get3v3GamesNeeded';
export { get3v3GamesNeeded } from './get3v3GamesNeeded';
export { get5v5GamesNeeded } from './get5v5GamesNeeded';

/**
 * Get handicap thresholds based on the league's handicap type.
 *
 * Routes through the SystemModule resolver's `thresholdChart` field (per
 * Phase C of the Threshold Charts extraction Unit). BCA presets pick the
 * matching Games-Needed Chart variant; Fargo / unmapped types fall back to
 * the 5v5 chart directly, preserving the legacy routing behavior.
 */
export function getGamesNeeded(handicapDiff: number, handicapType: string): HandicapThresholds {
  const { thresholdChart } = pickModule(handicapType);

  // The Games-Needed Chart variants (3v3 + 5v5) carry the contract this
  // adapter serves: a (handicapDiff) → HandicapThresholds lookup.
  if (
    thresholdChart &&
    (thresholdChart.kind === 'games_needed_3v3' ||
      thresholdChart.kind === 'games_needed_5v5')
  ) {
    return thresholdChart.compute(handicapDiff);
  }

  // Unreachable in practice: Fargo (fargo_formula Chart) and BCAPL SL
  // (race_length_adjustment, RESERVED stubs) never call getGamesNeeded(),
  // and 'none' produces a null thresholdChart. Defensive fallback preserves
  // the legacy "everything else routes to 5v5" behavior.
  console.warn(
    `[handicap] getGamesNeeded reached a non-GamesNeeded thresholdChart (kind="${thresholdChart?.kind ?? 'null'}") for handicap_type="${handicapType}" — falling back to 5v5 chart directly`,
  );
  return get5v5GamesNeededChart(handicapDiff);
}

/**
 * Get handicap thresholds for BOTH teams in a match.
 * Unchanged contract — computes each team's thresholds from their perspective.
 */
export function getGamesNeededForBothTeams(
  homeHandicap: number,
  awayHandicap: number,
  handicapType: string,
) {
  return {
    homeThresholds: getGamesNeeded(homeHandicap - awayHandicap, handicapType),
    awayThresholds: getGamesNeeded(awayHandicap - homeHandicap, handicapType),
  };
}
