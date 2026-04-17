/**
 * @fileoverview Calculate Handicap Thresholds
 *
 * Helper function to calculate and lookup handicap thresholds for a match
 * based on team lineups and league settings.
 * Supports both 3v3 and 5v5 formats with configurable team bonus.
 */

import { getHandicapThresholds } from '@/api/queries/handicaps';
import { getTeamHandicapBonus } from './getTeamHandicapBonus';
import type { Lineup } from '@/types/match';
import type { HandicapThresholds } from '@/types';

/**
 * Determine if team bonus should be used based on handicap type.
 * Points system uses team bonus. Others don't.
 */
export function shouldUseTeamBonus(handicapType: string): boolean {
  return handicapType === 'points';
}

export const calculateHandicapThresholds = async (
  homeLineup: Lineup,
  awayLineup: Lineup,
  homeTeamId: string,
  awayTeamId: string,
  seasonId: string,
  handicapType: string
): Promise<{
  homeThresholds: HandicapThresholds;
  awayThresholds: HandicapThresholds;
}> => {
  // Get team handicap bonus (only applies to points system, only to home team)
  let teamBonus = 0;
  if (shouldUseTeamBonus(handicapType)) {
    teamBonus = await getTeamHandicapBonus(homeTeamId, awayTeamId, seasonId, handicapType);
  }

  // Sum all non-null player handicaps from the lineup
  const sumLineupHandicaps = (lineup: Lineup): number =>
    [lineup.player1_handicap, lineup.player2_handicap, lineup.player3_handicap,
     lineup.player4_handicap, lineup.player5_handicap]
      .reduce<number>((sum, h) => sum + (h ?? 0), 0);

  const homeHandicapTotal = sumLineupHandicaps(homeLineup) + teamBonus;
  const awayHandicapTotal = sumLineupHandicaps(awayLineup);

  // Look up thresholds
  const homeThresholds = getHandicapThresholds(homeHandicapTotal - awayHandicapTotal, handicapType);
  const awayThresholds = getHandicapThresholds(awayHandicapTotal - homeHandicapTotal, handicapType);

   return {
    homeThresholds,
    awayThresholds
   };
};
