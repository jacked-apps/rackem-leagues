/**
 * @fileoverview Player Query Functions
 *
 * Pure data fetching functions for player-specific queries.
 * Used by operator tools for player management and statistics.
 */

import { supabase } from '@/supabaseClient';
import { fetchPlayerGameHistory } from './matchGames';
import { calculatePlayerHandicap } from '@/utils/calculatePlayerHandicap';
import { logger } from '@/utils/logger';

/**
 * Fetch count of all players in operator's leagues
 *
 * Returns total count of unique players who are on teams in any of the operator's leagues.
 * If activeOnly is true, only counts players on teams in active or upcoming seasons.
 *
 * @param operatorId - The operator ID to fetch player count for
 * @param activeOnly - Whether to filter for only active players (default: false)
 * @returns Promise with player count
 */
export async function fetchOperatorPlayerCount(
  operatorId: string,
  activeOnly: boolean = false
): Promise<number> {
  // Get all teams from organization's leagues
  let teamsQuery = supabase
    .from('teams')
    .select('id, league:leagues!inner(organization_id), season:seasons!inner(status)')
    .eq('league.organization_id', operatorId);

  // Filter by active/upcoming seasons if activeOnly
  if (activeOnly) {
    teamsQuery = teamsQuery.in('season.status', ['active', 'upcoming']);
  }

  const { data: teams, error: teamsError } = await teamsQuery;

  if (teamsError || !teams) {
    logger.error('Error fetching operator teams', { error: teamsError?.message || 'Unknown error' });
    return 0;
  }

  const teamIds = teams.map((t: any) => t.id);

  if (teamIds.length === 0) {
    return 0;
  }

  // Count unique players in those teams
  let playersQuery = supabase
    .from('team_players')
    .select('member_id', { count: 'exact', head: true })
    .in('team_id', teamIds);

  // Filter by active status if activeOnly
  if (activeOnly) {
    playersQuery = playersQuery.eq('status', 'active');
  }

  const { count, error } = await playersQuery;

  if (error) {
    logger.error('Error fetching operator player count', { error: error.message });
    return 0;
  }

  return count || 0;
}

/**
 * Filter options for fetching operator players
 */
export interface OperatorPlayersFilter {
  /** Only include players on active/upcoming season teams */
  activeOnly?: boolean;
  /** Only include players with NULL starting handicaps (unauthorized) */
  unauthorizedOnly?: boolean;
}

/**
 * Fetch all players in operator's leagues (for dropdown selection)
 *
 * Returns list of unique players with basic info (id, name, player number).
 * Supports flexible filtering via options object.
 *
 * @param operatorId - The operator ID to fetch players for
 * @param options - Filter options (activeOnly, unauthorizedOnly)
 * @returns Promise with array of players
 */
export async function fetchOperatorPlayers(
  operatorId: string,
  options: OperatorPlayersFilter | boolean = false
) {
  // Support legacy boolean parameter for backwards compatibility
  const filters: OperatorPlayersFilter = typeof options === 'boolean'
    ? { activeOnly: options }
    : options;
  // Get all unique member IDs from teams in organization's leagues
  let teamPlayersQuery = supabase
    .from('team_players')
    .select(`
      member_id,
      status,
      team:teams!inner(
        league:leagues!inner(
          organization_id
        ),
        season:seasons!inner(
          status
        )
      )
    `)
    .eq('team.league.organization_id', operatorId);

  // Filter by active status if activeOnly
  if (filters.activeOnly) {
    teamPlayersQuery = teamPlayersQuery
      .eq('status', 'active')
      .in('team.season.status', ['active', 'upcoming']);
  }

  const { data: teamPlayers, error: teamPlayersError } = await teamPlayersQuery;

  if (teamPlayersError) {
    return { data: null, error: teamPlayersError };
  }

  // Extract unique member IDs
  const uniqueMemberIds = [...new Set(teamPlayers.map((tp: any) => tp.member_id))];

  if (uniqueMemberIds.length === 0) {
    return { data: [], error: null };
  }

  // Fetch member details - include starting handicaps for unauthorized filter
  let membersQuery = supabase
    .from('members')
    .select('id, first_name, last_name, system_player_number, bca_member_number, starting_handicap_3v3, starting_handicap_5v5')
    .in('id', uniqueMemberIds);

  // Filter for unauthorized players (both starting handicaps are NULL)
  if (filters.unauthorizedOnly) {
    membersQuery = membersQuery
      .is('starting_handicap_3v3', null)
      .is('starting_handicap_5v5', null);
  }

  const { data: members, error: membersError } = await membersQuery.order('last_name');

  if (membersError) {
    return { data: null, error: membersError };
  }

  return { data: members, error: null };
}

/**
 * Player details for management page
 */
export interface PlayerDetails {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  nickname: string | null;
  system_player_number: number;
  bca_member_number: string | null;
  role: string;
  phone: string;
  email: string;
  membership_paid_date: string | null;
  starting_handicap_3v3: number;
  starting_handicap_5v5: number;
  teams: Array<{
    id: string;
    team_name: string;
    season_name: string;
    status: string;
    league_name: string;
    game_type: string;
    team_format: '5_man' | '8_man';
  }>;
  gameCounts: {
    total: number;
    eight_ball: number;
    nine_ball: number;
    ten_ball: number;
  };
  handicaps: {
    eight_ball_points: number | null;
    eight_ball_percentage: number | null;
    nine_ball_points: number | null;
    nine_ball_percentage: number | null;
    ten_ball_points: number | null;
    ten_ball_percentage: number | null;
  };
}

/**
 * Fetch detailed player information for operator management
 *
 * Returns comprehensive player data including:
 * - Basic player info
 * - Current starting handicaps
 * - All leagues player is in (from operator's leagues)
 * - All teams player is on
 * - Game counts by game type
 *
 * @param playerId - The player's member ID
 * @param operatorId - The operator ID (to filter leagues/teams)
 * @returns Promise with player details
 */
export async function fetchPlayerDetails(
  playerId: string,
  operatorId: string
): Promise<{ data: PlayerDetails | null; error: any }> {
  // Fetch player basic info and starting handicaps
  const { data: player, error: playerError } = await supabase
    .from('members')
    .select('id, user_id, first_name, last_name, nickname, system_player_number, bca_member_number, role, phone, email, membership_paid_date, starting_handicap_3v3, starting_handicap_5v5')
    .eq('id', playerId)
    .single();

  if (playerError) {
    return { data: null, error: playerError };
  }

  // Fetch all leagues player is in (from organization's leagues)
  const { data: teamPlayers, error: teamPlayersError } = await supabase
    .from('team_players')
    .select(`
      team:teams!inner(
        id,
        team_name,
        league:leagues!inner(
          id,
          game_type,
          day_of_week,
          division,
          team_format,
          organization_id
        ),
        season:seasons!inner(
          id,
          season_name,
          status
        )
      )
    `)
    .eq('member_id', playerId)
    .eq('team.league.organization_id', operatorId);

  if (teamPlayersError) {
    return { data: null, error: teamPlayersError };
  }

  // Extract teams with league/season info
  const teamsArray: any[] = [];

  teamPlayers?.forEach((tp: any) => {
    const team = tp.team;
    if (!team || Array.isArray(team)) return;

    const league = team.league;
    const season = team.season;

    if (!league || Array.isArray(league) || !season || Array.isArray(season)) return;

    // Add to teams array with league and season info
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = typeof league.day_of_week === 'number' ? dayNames[league.day_of_week] : '';
    const gameTypeFormatted = league.game_type ? league.game_type.replace('_', '-').charAt(0).toUpperCase() + league.game_type.replace('_', '-').slice(1) : '';
    const division = league.division || '';

    teamsArray.push({
      id: team.id,
      team_name: team.team_name,
      season_name: season.season_name,
      status: season.status,
      league_name: `${dayName} ${gameTypeFormatted}${division ? ' - ' + division : ''}`,
      game_type: league.game_type,
      team_format: league.team_format,
    });
  });

  // Fetch game counts by game type using existing fetchPlayerGameHistory
  // This uses the same logic as handicap calculations
  const eightBallGames = await fetchPlayerGameHistory(playerId, 'eight_ball', undefined, 10000);
  const nineBallGames = await fetchPlayerGameHistory(playerId, 'nine_ball', undefined, 10000);
  const tenBallGames = await fetchPlayerGameHistory(playerId, 'ten_ball', undefined, 10000);

  const gameCounts = {
    eight_ball: eightBallGames.length,
    nine_ball: nineBallGames.length,
    ten_ball: tenBallGames.length,
    total: eightBallGames.length + nineBallGames.length + tenBallGames.length,
  };

  // Calculate handicaps for both systems (points and percentage) and all game types.
  // Uses handicapType ('points' / 'percentage') instead of the old teamFormat ('5_man' / '8_man').
  const handicaps = {
    eight_ball_points: (await calculatePlayerHandicap(playerId, 'points', 'standard', 'eight_ball')).value,
    eight_ball_percentage: (await calculatePlayerHandicap(playerId, 'percentage', 'standard', 'eight_ball')).value,
    nine_ball_points: (await calculatePlayerHandicap(playerId, 'points', 'standard', 'nine_ball')).value,
    nine_ball_percentage: (await calculatePlayerHandicap(playerId, 'percentage', 'standard', 'nine_ball')).value,
    ten_ball_points: (await calculatePlayerHandicap(playerId, 'points', 'standard', 'ten_ball')).value,
    ten_ball_percentage: (await calculatePlayerHandicap(playerId, 'percentage', 'standard', 'ten_ball')).value,
  };

  return {
    data: {
      ...player,
      teams: teamsArray,
      gameCounts,
      handicaps,
    },
    error: null,
  };
}

/**
 * Update player's starting handicaps
 *
 * @param playerId - The player's member ID
 * @param startingHandicap3v3 - Starting handicap for 3v3 format
 * @param startingHandicap5v5 - Starting handicap for 5v5 format
 * @returns Promise with update result
 */
export async function updatePlayerStartingHandicaps(
  playerId: string,
  startingHandicap3v3: number,
  startingHandicap5v5: number
) {
  return supabase
    .from('members')
    .update({
      starting_handicap_3v3: startingHandicap3v3,
      starting_handicap_5v5: startingHandicap5v5,
    })
    .eq('id', playerId);
}

/**
 * Mark player's membership as paid with a specific date
 *
 * @param playerId - The player's member ID
 * @param date - The date to set (YYYY-MM-DD format), or null to clear
 * @returns Promise with update result
 */
export async function updateMembershipPaidDate(playerId: string, date: string | null) {
  return supabase
    .from('members')
    .update({
      membership_paid_date: date,
    })
    .eq('id', playerId);
}

/**
 * Mark player's membership as paid with today's date
 *
 * @param playerId - The player's member ID
 * @returns Promise with update result
 */
export async function markMembershipPaid(playerId: string) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  return updateMembershipPaidDate(playerId, today);
}

/**
 * Result of auto-authorization attempt
 */
export interface AutoAuthorizeResult {
  /** Whether the player was auto-authorized */
  authorized: boolean;
  /** Total game count across all game types */
  totalGames: number;
  /** The 3v3 handicap that was set (if authorized) */
  handicap3v3?: number;
  /** The 5v5 handicap that was set (if authorized) */
  handicap5v5?: number;
  /** Error message if authorization failed */
  error?: string;
}

/**
 * Fast count of total completed games for a player (across all game types)
 *
 * Uses Supabase count query instead of fetching all game records.
 * Much faster than fetchPlayerGameHistory when you only need the count.
 *
 * @param playerId - The player's member ID
 * @returns Promise with total game count
 */
export async function fetchPlayerTotalGameCount(playerId: string): Promise<number> {
  const { count, error } = await supabase
    .from('match_games')
    .select('*', { count: 'exact', head: true })
    .or(`home_player_id.eq.${playerId},away_player_id.eq.${playerId}`)
    .not('winner_player_id', 'is', null);

  if (error) {
    logger.error('Error fetching player game count', { error: error.message, playerId });
    return 0;
  }

  return count || 0;
}

/**
 * Attempt to auto-authorize an established player
 *
 * Players with 15+ total games (across all game types) are considered "established"
 * and can be auto-authorized by calculating their handicaps from game history.
 *
 * OPTIMIZED: Uses count query instead of fetching all games, and runs
 * handicap calculations in parallel.
 *
 * @param playerId - The player's member ID
 * @returns Promise with authorization result
 */
export async function autoAuthorizeEstablishedPlayer(
  playerId: string
): Promise<AutoAuthorizeResult> {
  try {
    // Fast count query - single DB call instead of fetching all game records
    const totalGames = await fetchPlayerTotalGameCount(playerId);

    // Need 15+ games to auto-authorize
    if (totalGames < 15) {
      return {
        authorized: false,
        totalGames,
      };
    }

    // Calculate handicaps in parallel (was sequential before)
    // Use 8-ball as the primary game type for handicap calculation
    // (most common game type, provides best baseline)
    const [pointsResult, percentageResult] = await Promise.all([
      calculatePlayerHandicap(playerId, 'points', 'standard', 'eight_ball'),
      calculatePlayerHandicap(playerId, 'percentage', 'standard', 'eight_ball'),
    ]);

    // Update the player's starting handicaps
    const { error } = await updatePlayerStartingHandicaps(playerId, pointsResult.value ?? 0, percentageResult.value ?? 40);

    if (error) {
      return {
        authorized: false,
        totalGames,
        error: error.message,
      };
    }

    return {
      authorized: true,
      totalGames,
      handicap3v3: pointsResult.value ?? 0,
      handicap5v5: percentageResult.value ?? 40,
    };
  } catch (error) {
    logger.error('Error auto-authorizing player', { error: error instanceof Error ? error.message : String(error) });
    return {
      authorized: false,
      totalGames: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Batch auto-authorize multiple players in parallel
 *
 * Runs all player checks concurrently for much faster processing.
 * Returns results for all players, including which ones were authorized.
 *
 * @param playerIds - Array of player member IDs to check
 * @returns Promise with array of authorization results
 */
export async function batchAutoAuthorizeEstablishedPlayers(
  playerIds: string[]
): Promise<{ playerId: string; result: AutoAuthorizeResult }[]> {
  const results = await Promise.all(
    playerIds.map(async (playerId) => ({
      playerId,
      result: await autoAuthorizeEstablishedPlayer(playerId),
    }))
  );

  return results;
}

/**
 * Check if a player has starting handicaps set (manual authorization)
 *
 * IMPORTANT: Authorization vs Established distinction:
 * - AUTHORIZED: Player has starting handicaps set by an operator (for restricted leagues)
 * - ESTABLISHED: Player has 15+ games played (system calculates handicap automatically)
 * - If a player is ESTABLISHED (15+ games), they are automatically AUTHORIZED
 *
 * This function only checks for manual authorization (starting handicaps set).
 * The calling code should also check if player is established (gameCounts.total >= 15)
 * and treat established players as authorized.
 *
 * @param player - Player object with starting_handicap_3v3 and starting_handicap_5v5
 * @returns true if player has starting handicaps set (manually authorized)
 */
export function isPlayerAuthorized(player: {
  starting_handicap_3v3: number | null;
  starting_handicap_5v5: number | null;
}): boolean {
  return player.starting_handicap_3v3 !== null && player.starting_handicap_5v5 !== null;
}
