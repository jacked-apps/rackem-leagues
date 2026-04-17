/**
 * @fileoverview Team Handicap Bonus Calculator
 *
 * Self-contained helper to calculate team handicap bonus based on standings.
 * The team handicap bonus is only applied to the HOME team.
 *
 * Uses team match wins from completed matches to calculate handicap differential.
 */

import { supabase } from '@/supabaseClient';
import { logger } from '@/utils/logger';

/**
 * Calculate team handicap bonus for the home team.
 *
 * Only the points handicap system uses team bonus.
 * All other systems (percentage, fargo, none) return 0.
 *
 * Formula: (home_wins - away_wins) / 2 (rounded down)
 */
export async function getTeamHandicapBonus(
  homeTeamId: string,
  awayTeamId: string,
  seasonId: string,
  handicapType: string
): Promise<number> {
  // Only points system uses team handicap
  if (handicapType !== 'points') {
    return 0;
  }

  // Points system: team handicap based on match win differential
  // Formula: (home_wins - away_wins) / 2 (rounded down)

  try {
    // Fetch all completed matches for this season
    const { data: matches, error } = await supabase
      .from('matches')
      .select('winner_team_id')
      .eq('season_id', seasonId)
      .eq('status', 'completed');

    if (error) {
      logger.error('Error fetching matches for team handicap', { error: error.message });
      return 0; // Return 0 on error (neutral handicap)
    }

    if (!matches || matches.length === 0) {
      return 0; // No completed matches yet, no handicap
    }

    // Count wins for each team
    let homeWins = 0;
    let awayWins = 0;

    matches.forEach((match) => {
      if (match.winner_team_id === homeTeamId) {
        homeWins++;
      } else if (match.winner_team_id === awayTeamId) {
        awayWins++;
      }
    });

    // Calculate win differential and team handicap bonus
    const winDifference = homeWins - awayWins;
    const bonus = Math.floor(winDifference / 2);

    return bonus;

    // Example: Home has 8 wins, Away has 3 wins
    //   winDifference = 8 - 3 = 5
    //   bonus = floor(5 / 2) = 2
    //   Home team gets +2 team handicap bonus
    //
    // Example: Home has 3 wins, Away has 7 wins
    //   winDifference = 3 - 7 = -4
    //   bonus = floor(-4 / 2) = -2
    //   Home team gets -2 team handicap penalty
  } catch (error) {
    logger.error('Exception in getTeamHandicapBonus', { error: error instanceof Error ? error.message : String(error) });
    return 0; // Return 0 on exception (neutral handicap)
  }
}
