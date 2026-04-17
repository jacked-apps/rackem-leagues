/**
 * @fileoverview Unified Handicap Chart Interface
 *
 * Routes threshold lookups to the correct chart based on handicapType.
 *   - 'points': 3v3-style exact-lookup chart
 *   - 'percentage': 5v5-style range-lookup chart
 *   - 'fargo': TODO — manual entry for now, no chart lookup
 */

import { get3v3GamesNeeded } from './get3v3GamesNeeded';
import { get5v5GamesNeeded } from './get5v5GamesNeeded';

export type { HandicapThresholds } from './get3v3GamesNeeded';
export { get3v3GamesNeeded } from './get3v3GamesNeeded';
export { get5v5GamesNeeded } from './get5v5GamesNeeded';

/**
 * Get handicap thresholds based on the league's handicap type.
 */
export function getGamesNeeded(handicapDiff: number, handicapType: string) {
  if (handicapType === 'points') {
    return get3v3GamesNeeded(handicapDiff);
  }
  // percentage, fargo, and others use the 5v5 range chart as default
  return get5v5GamesNeeded(handicapDiff);
}

/**
 * Get handicap thresholds for BOTH teams in a match.
 */
export function getGamesNeededForBothTeams(
  homeHandicap: number,
  awayHandicap: number,
  handicapType: string
) {
  return {
    homeThresholds: getGamesNeeded(homeHandicap - awayHandicap, handicapType),
    awayThresholds: getGamesNeeded(awayHandicap - homeHandicap, handicapType),
  };
}
