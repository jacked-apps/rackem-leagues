/**
 * @fileoverview Match Game Query Functions
 *
 * Pure data fetching functions for match_games table queries.
 * These functions return plain data and throw errors (no loading states).
 * Used by handicap calculations and game history tracking.
 */

import { supabase } from '@/supabaseClient';
import type { Tables } from '@/types/database.types';

/**
 * Match game record with winner information
 */
export interface MatchGame {
  id: string;
  match_id: string;
  game_number: number;
  home_position: number; // Which position (1-5) from home lineup plays
  away_position: number; // Which position (1-5) from away lineup plays
  home_player_id: string | null;
  away_player_id: string | null;
  winner_team_id: string | null;
  winner_player_id: string | null;
  home_action: 'breaks' | 'racks';
  away_action: 'breaks' | 'racks';
  break_and_run: boolean;
  golden_break: boolean;
  confirmed_by_home: string | null; // member id of the confirmer, not a flag
  confirmed_by_away: string | null;
  confirmed_at: string | null;
  is_tiebreaker: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch last N games for a player (for handicap calculation)
 *
 * NEW LEAGUE-BASED LOOKUP LOGIC:
 * 1. If leagueId provided, get all games from ALL SEASONS in that league
 * 2. If < 50 games (or < 25% of limit), expand to ALL games of that game type (all leagues)
 * 3. Ordered by created_at (newest first)
 * 4. Only returns games with a winner (completed games)
 * 5. TIEBREAKER RULE: Excludes tiebreaker games where player lost
 *
 * IMPORTANT: 8-ball stats don't count for 9-ball handicaps and vice versa.
 * Players need separate handicaps for each game type.
 *
 * TIEBREAKER HANDICAP RULE:
 * - Tiebreaker wins ARE included in handicap calculation
 * - Tiebreaker losses are EXCLUDED from handicap calculation
 * - This prevents unfair penalty from anti-sandbagging rule
 *
 * PERFORMANCE: Uses denormalized game_type field for fast filtering without joins.
 * Composite indexes (player + game_type + created_at) enable optimal query performance.
 *
 * @param playerId - The player's member ID
 * @param gameType - Game type to filter ('eight_ball', 'nine_ball', 'ten_ball')
 * @param leagueId - Optional league ID to prioritize games from this league's seasons
 * @param limit - Maximum number of games to return (default: 200)
 * @returns Array of completed games where the player participated (tiebreaker losses excluded)
 * @throws Error if query fails
 *
 * @example
 * // Get 9-ball games from specific league (all seasons)
 * const games = await fetchPlayerGameHistory('player-123', 'nine_ball', 'league-456', 200);
 * const wins = games.filter(g => g.winner_player_id === 'player-123').length;
 */
export async function fetchPlayerGameHistory(
  playerId: string,
  gameType: 'eight_ball' | 'nine_ball' | 'ten_ball',
  leagueId?: string,
  limit: number = 200
): Promise<MatchGame[]> {
  // Fetch extra games (25% buffer) to account for tiebreaker losses that will be filtered out
  // Tiebreakers are rare, so 250 games ensures we have 200+ after filtering
  const fetchLimit = Math.ceil(limit * 1.25);

  let leagueGames: Tables<'match_games'>[] = [];

  // Step 1: If leagueId provided, get all games from ALL SEASONS in that league
  if (leagueId) {
    const { data: leagueData, error: leagueError } = await supabase
      .from('match_games')
      .select('*, match:matches!inner(season:seasons!inner(league_id))')
      .or(`home_player_id.eq.${playerId},away_player_id.eq.${playerId}`)
      .not('winner_player_id', 'is', null) // Only completed games
      .eq('game_type', gameType)
      .eq('match.season.league_id', leagueId)
      .order('created_at', { ascending: false })
      .limit(fetchLimit);

    if (leagueError) {
      throw new Error(`Failed to fetch league game history: ${leagueError.message}`);
    }

    leagueGames = leagueData || [];
  }

  // Step 2: If < 50 games (or < 25% of limit), expand to ALL games of this game type
  const threshold = Math.ceil(limit * 0.25); // 25% threshold (50 games for limit=200)
  const needsExpansion = leagueGames.length < threshold;

  let allGames: Tables<'match_games'>[] = leagueGames;

  if (needsExpansion) {
    // Fetch all games of this game type (across all leagues)
    const { data, error } = await supabase
      .from('match_games')
      .select('*')
      .or(`home_player_id.eq.${playerId},away_player_id.eq.${playerId}`)
      .not('winner_player_id', 'is', null) // Only completed games
      .eq('game_type', gameType)
      .order('created_at', { ascending: false })
      .limit(fetchLimit);

    if (error) {
      throw new Error(`Failed to fetch player game history: ${error.message}`);
    }

    allGames = data || [];
  }

  if (!allGames || allGames.length === 0) {
    return [];
  }

  // TIEBREAKER HANDICAP RULE: Filter out tiebreaker games where player lost
  // - Keep all non-tiebreaker games
  // - Keep tiebreaker games where player WON (counts toward handicap)
  // - Exclude tiebreaker games where player LOST (prevents anti-sandbagging penalty)
  const filteredData = allGames.filter((game) => {
    const isTiebreaker = game.is_tiebreaker === true;
    const playerWon = game.winner_player_id === playerId;

    // Keep all non-tiebreaker games
    if (!isTiebreaker) return true;

    // For tiebreaker games, only keep if player won
    return playerWon;
  });

  // Return up to 'limit' games after filtering. MatchGame narrows a few
  // nullable columns (e.g. home_position) that are always set on a completed
  // league game, which is all these filters return.
  return filteredData.slice(0, limit) as MatchGame[];
}
