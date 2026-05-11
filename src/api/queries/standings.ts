/**
 * @fileoverview Standings Query Functions
 *
 * Pure data fetching functions for team standings queries.
 * These functions return plain data and throw errors (no loading states).
 * Used by TanStack Query hooks for caching and state management.
 */

import { supabase } from '@/supabaseClient';

/**
 * Team standing record for a season
 */
export interface TeamStanding {
  teamId: string;
  teamName: string;
  matchWins: number;
  matchLosses: number;
  points: number;
  gamesWon: number;
}

/**
 * Fetch season team standings
 *
 * Gets team performance data for all teams in a season.
 * Only includes completed matches.
 *
 * Data aggregated per team:
 * - Match wins (count where winner_team_id = team)
 * - Match losses (count where team participated but didn't win)
 * - Points earned (sum of home_points_earned + away_points_earned)
 * - Games won (sum of home_games_won + away_games_won)
 *
 * @param seasonId - Season's primary key ID
 * @returns Array of team standings for the season
 * @throws Error if database query fails
 *
 * @example
 * const standings = await fetchSeasonStandings('season-123');
 * standings.forEach(team => {
 *   console.log(`${team.teamName}: ${team.matchWins}W-${team.matchLosses}L`);
 * });
 */
export async function fetchSeasonStandings(seasonId: string): Promise<TeamStanding[]> {
  // Fetch all completed matches for this season
  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select(`
      id,
      home_team_id,
      away_team_id,
      winner_team_id,
      home_points_earned,
      away_points_earned,
      home_games_won,
      away_games_won
    `)
    .eq('season_id', seasonId)
    .eq('status', 'completed');

  if (matchesError) {
    throw new Error(`Failed to fetch matches: ${matchesError.message}`);
  }

  if (!matches || matches.length === 0) {
    return [];
  }

  // Extract unique team IDs from matches
  const teamIds = new Set<string>();
  matches.forEach((match) => {
    if (match.home_team_id) teamIds.add(match.home_team_id);
    if (match.away_team_id) teamIds.add(match.away_team_id);
  });

  // Fetch team names — exclude bye / withdrawn / forfeited rows so they
  // don't appear as standings entries (their matches still get counted
  // toward the active opponent's record).
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, team_name')
    .eq('status', 'active')
    .in('id', Array.from(teamIds));

  if (teamsError) {
    throw new Error(`Failed to fetch team names: ${teamsError.message}`);
  }

  // Create team name map
  const teamNames = new Map<string, string>();
  teams?.forEach((team) => {
    teamNames.set(team.id, team.team_name);
  });

  // Calculate stats per team
  const teamStatsMap = new Map<string, {
    wins: number;
    losses: number;
    points: number;
    games: number;
  }>();

  matches.forEach((match) => {
    const homeTeamId = match.home_team_id;
    const awayTeamId = match.away_team_id;
    const winnerTeamId = match.winner_team_id;

    // Process home team
    if (homeTeamId) {
      const stats = teamStatsMap.get(homeTeamId) || { wins: 0, losses: 0, points: 0, games: 0 };

      // Match win/loss
      if (winnerTeamId === homeTeamId) {
        stats.wins++;
      } else {
        stats.losses++;
      }

      // Points and games
      stats.points += match.home_points_earned || 0;
      stats.games += match.home_games_won || 0;

      teamStatsMap.set(homeTeamId, stats);
    }

    // Process away team
    if (awayTeamId) {
      const stats = teamStatsMap.get(awayTeamId) || { wins: 0, losses: 0, points: 0, games: 0 };

      // Match win/loss
      if (winnerTeamId === awayTeamId) {
        stats.wins++;
      } else {
        stats.losses++;
      }

      // Points and games
      stats.points += match.away_points_earned || 0;
      stats.games += match.away_games_won || 0;

      teamStatsMap.set(awayTeamId, stats);
    }
  });

  // Convert to array and add team names
  const standings: TeamStanding[] = [];
  teamStatsMap.forEach((stats, teamId) => {
    standings.push({
      teamId,
      teamName: teamNames.get(teamId) || 'Unknown Team',
      matchWins: stats.wins,
      matchLosses: stats.losses,
      points: stats.points,
      gamesWon: stats.games,
    });
  });

  return standings;
}
