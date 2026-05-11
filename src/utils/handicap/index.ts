/**
 * @fileoverview Handicap Threshold Lookup (thin adapter)
 *
 * Delegates to the SystemModule resolver introduced in Phase 1 of the modular
 * handicap/scoring refactor. Callers continue to call getGamesNeeded() exactly
 * as before — no signature changes — but the routing now flows through
 * SystemModule.threshold.compute() so future systems can be added by writing
 * a single module without touching this file or its callers.
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
 * Routes through the SystemModule resolver. BCA presets ('points', 'percentage')
 * use their respective charts. Fargo and unmapped values fall through to the
 * resolver's default (bca5v5), preserving the legacy routing behavior.
 */
export function getGamesNeeded(handicapDiff: number, handicapType: string): HandicapThresholds {
  const { threshold } = pickModule(handicapType);

  // BCA modules have extra_games threshold mode — the contract this adapter serves.
  // (Renamed from 'games_to_win' in Phase 1 Unit 1.3 — the discriminator now
  // describes the mechanism rather than the output field name.)
  if (threshold.mode === 'extra_games') {
    return threshold.compute(handicapDiff, {});
  }

  // Unreachable in practice: Fargo (start_points mode) and BCAPL SL (race_length_adjustment)
  // never call getGamesNeeded(). Defensive fallback preserves the legacy
  // "everything non-points routes to 5v5" behavior.
  console.warn(
    `[handicap] getGamesNeeded reached a non-extra_games threshold module (mode="${threshold.mode}") for handicap_type="${handicapType}" — falling back to 5v5 chart directly`,
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
