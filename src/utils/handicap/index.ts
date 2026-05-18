/**
 * @fileoverview Handicap Threshold Lookup (thin adapter)
 *
 * Delegates to the SystemModule resolver. Callers continue to call
 * getGamesNeeded() exactly as before — no signature changes — but the routing
 * now flows through SystemModule.handicapMechanism.compute() (per Phase C of
 * the Handicap Mechanisms extraction Unit). The Mechanism's compute
 * internally delegates to its bound Threshold Chart.
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
 * Routes through the SystemModule resolver's `handicapMechanism` field.
 * The extra_games Mechanism (BCA presets) returns the per-side asymmetric
 * targets directly; Fargo (start_points Mechanism) and unmapped types fall
 * back to the 5v5 chart directly, preserving the legacy routing behavior.
 */
export function getGamesNeeded(handicapDiff: number, handicapType: string): HandicapThresholds {
  const { handicapMechanism } = pickModule(handicapType);

  // The extra_games Mechanism carries the contract this adapter serves:
  // a (handicapDiff) → HandicapThresholds lookup.
  if (handicapMechanism?.kind === 'extra_games') {
    return handicapMechanism.compute(handicapDiff, {});
  }

  // Unreachable in practice: Fargo (start_points Mechanism) and BCAPL SL
  // (race_length_adjustment, RESERVED) never call getGamesNeeded(), and
  // 'none' produces noneMechanism (zero-handicap extra_games shape).
  // Defensive fallback preserves the legacy "everything else routes to 5v5" behavior.
  console.warn(
    `[handicap] getGamesNeeded reached a non-extra_games Mechanism (kind="${handicapMechanism?.kind ?? 'null'}") for handicap_type="${handicapType}" — falling back to 5v5 chart directly`,
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
