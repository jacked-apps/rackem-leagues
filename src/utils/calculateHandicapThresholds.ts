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

/**
 * Games-needed thresholds for both teams from their lineups.
 *
 * @param homeLineup - Home lineup (frozen per-slot handicaps)
 * @param awayLineup - Away lineup (frozen per-slot handicaps)
 * @param matchId - The match; the team bonus reads its week (no bonus in playoffs)
 * @param handicapType - League handicap type; only points uses the team bonus
 */
export const calculateHandicapThresholds = async (
  homeLineup: Lineup,
  awayLineup: Lineup,
  matchId: string,
  handicapType: string
): Promise<{
  homeThresholds: HandicapThresholds;
  awayThresholds: HandicapThresholds;
}> => {
  // Team bonus: points system only, home team only, never in playoffs. The
  // shared helper owns every rule so the lineup screen shows the same number.
  const teamBonus = shouldUseTeamBonus(handicapType)
    ? await getTeamHandicapBonus(matchId, handicapType)
    : 0;

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
