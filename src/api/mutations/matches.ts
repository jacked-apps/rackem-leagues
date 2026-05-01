/**
 * @fileoverview Match Mutation Functions
 *
 * Generic, reusable functions for match operations.
 * These functions are wrapped by TanStack Query mutation hooks.
 *
 * Philosophy: Keep mutations generic and flexible.
 * Instead of specific functions like updateMatchLineupId(), create
 * a generic updateMatch() that can update any field(s).
 *
 * @see api/hooks/useMatchMutations.ts - Mutation hooks that wrap these functions
 */

import { supabase } from '@/supabaseClient';

/**
 * Generic match update parameters
 */
export interface UpdateMatchParams {
  matchId: string;
  updates: Record<string, any>; // Any match field(s) to update
}

/**
 * Match database record (partial - only commonly used fields)
 */
export interface Match {
  id: string;
  season_id: string;
  home_team_id: string;
  away_team_id: string;
  home_lineup_id?: string | null;
  away_lineup_id?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  status?: string;
  home_games_to_win?: number;
  away_games_to_win?: number;
  home_games_to_tie?: number;
  away_games_to_tie?: number;
  home_games_to_lose?: number;
  away_games_to_lose?: number;
  [key: string]: any; // Allow any other match fields
}

/**
 * Update any field(s) on a match
 *
 * Generic mutation that can update any match field(s).
 * Use this for all match updates instead of creating specific mutations.
 *
 * @param params - Match ID and fields to update
 * @returns The updated match
 * @throws Error if database operation fails
 *
 * @example
 * // Update lineup ID
 * await updateMatch({
 *   matchId: '123',
 *   updates: { home_lineup_id: 'lineup-456' }
 * });
 *
 * @example
 * // Update multiple fields
 * await updateMatch({
 *   matchId: '123',
 *   updates: {
 *     home_lineup_id: 'lineup-456',
 *     started_at: new Date().toISOString()
 *   }
 * });
 *
 * @example
 * // Update match thresholds
 * await updateMatch({
 *   matchId: '123',
 *   updates: {
 *     home_games_to_win: 8,
 *     away_games_to_win: 7,
 *     home_games_to_tie: 7,
 *     away_games_to_tie: 8
 *   }
 * });
 */
export async function updateMatch(params: UpdateMatchParams): Promise<Match> {
  const { matchId, updates } = params;

  // First try with SELECT to return updated data
  const { data, error } = await supabase
    .from('matches')
    .update(updates)
    .eq('id', matchId)
    .select('*')
    .maybeSingle();

  // If we get data back, return it
  if (data && !error) {
    return data;
  }

  // If SELECT is blocked by RLS (406 error or PGRST116), try update without SELECT
  if (error?.code === 'PGRST116' || error?.code === '406' || error?.message?.includes('406') || error?.message?.includes('Not Acceptable')) {
    const { error: updateError } = await supabase
      .from('matches')
      .update(updates)
      .eq('id', matchId);

    if (updateError) {
      throw new Error(`Failed to update match: ${updateError.message}`);
    }

    // Return a partial match object (real-time will trigger refetch)
    return { id: matchId, ...updates } as Match;
  }

  // Other errors
  if (error) {
    throw new Error(`Failed to update match: ${error.message}`);
  }

  throw new Error(`Match ${matchId} not found or update failed`);
}

/**
 * Generic match game creation parameters
 */
export interface CreateMatchGamesParams {
  games: Array<Record<string, any>>; // Array of game objects with any fields
}

/**
 * Match game database record
 */
export interface MatchGame {
  id: string;
  match_id: string;
  game_number: number;
  home_player_id?: string | null;
  away_player_id?: string | null;
  winner_team_id?: string | null;
  winner_player_id?: string | null;
  home_action: string;
  away_action: string;
  break_and_run: boolean;
  golden_break: boolean;
  confirmed_by_home: boolean;
  confirmed_by_away: boolean;
  confirmed_at?: string | null;
  is_tiebreaker: boolean;
  game_type: string;
  vacate_requested_by?: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: any; // Allow any other fields
}

/**
 * Create match game records
 *
 * Generic mutation that can create any number of games with any data.
 * Use this for creating normal games, tiebreaker games, or any game records.
 *
 * @param params - Array of game objects to create
 * @returns Array of created games
 * @throws Error if database operation fails
 *
 * @example
 * // Create 3 tiebreaker games
 * await createMatchGames({
 *   games: [
 *     {
 *       match_id: 'match-123',
 *       game_number: 19,
 *       home_action: 'breaks',
 *       away_action: 'racks',
 *       is_tiebreaker: true,
 *       game_type: 'nine_ball'
 *     },
 *     {
 *       match_id: 'match-123',
 *       game_number: 20,
 *       home_action: 'racks',
 *       away_action: 'breaks',
 *       is_tiebreaker: true,
 *       game_type: 'nine_ball'
 *     },
 *     // ... etc
 *   ]
 * });
 */
export async function createMatchGames(params: CreateMatchGamesParams): Promise<MatchGame[]> {
  const { data, error } = await supabase
    .from('match_games')
    .insert(params.games)
    .select();

  if (error) {
    throw new Error(`Failed to create match games: ${error.message}`);
  }

  return data;
}

/**
 * Generic match game update parameters
 */
export interface UpdateMatchGameParams {
  gameId: string;
  updates: Record<string, any>;
}

/**
 * Update a match game record
 *
 * Generic mutation that can update any fields on a game record.
 * Use this for updating player assignments, scores, confirmations, etc.
 *
 * @param params - Game ID and fields to update
 * @returns Updated game record
 * @throws Error if database operation fails
 *
 * @example
 * // Assign player to tiebreaker game
 * await updateMatchGame({
 *   gameId: 'game-123',
 *   updates: {
 *     home_player_id: 'player-456'
 *   }
 * });
 */
export async function updateMatchGame(params: UpdateMatchGameParams): Promise<MatchGame> {
  const { data, error } = await supabase
    .from('match_games')
    .update(params.updates)
    .eq('id', params.gameId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update match game: ${error.message}`);
  }

  return data;
}

/**
 * Parameters for converting a forfeited / unplayed bye match into a makeup.
 */
export interface ConvertMatchToMakeupParams {
  matchId: string;
  /** New active team that takes over the bye/withdrawn side. */
  newTeamId: string;
  /** Which side the bye/withdrawn team is on. */
  side: 'home' | 'away';
}

/**
 * Convert a forfeited / unplayed bye match into a playable makeup.
 *
 * Calls the convert_match_to_makeup RPC, which validates the match
 * state (rejects results-bearing matches), reassigns the side's team,
 * and resets all forfeit-write fields so the standings query no
 * longer credits a forfeit win.
 *
 * @throws Error from the RPC's RAISE EXCEPTION on validation failure.
 */
export async function convertMatchToMakeup(
  params: ConvertMatchToMakeupParams
): Promise<void> {
  const { error } = await supabase.rpc('convert_match_to_makeup', {
    p_match_id: params.matchId,
    p_new_team_id: params.newTeamId,
    p_side: params.side,
  });

  if (error) {
    throw new Error(`convert_match_to_makeup failed: ${error.message}`);
  }
}

/**
 * Parameters for sweeping past-due bye matches into forfeits.
 */
export interface ForfeitPastByeMatchesParams {
  seasonId: string;
  /**
   * Optional. When set, only matches involving this team get forfeited
   * (drop-scoped). Omit to sweep all season-wide past byes (used by the
   * operator's "Close Past Byes" button).
   */
  teamFilter?: string;
}

/**
 * Forfeit past-due bye/withdrawn matches in a season.
 *
 * Wraps forfeit_past_bye_matches RPC. Returns the number of matches
 * actually forfeited.
 */
export async function forfeitPastByeMatches(
  params: ForfeitPastByeMatchesParams
): Promise<number> {
  const { data, error } = await supabase.rpc('forfeit_past_bye_matches', {
    p_season_id: params.seasonId,
    p_team_filter: params.teamFilter ?? null,
  });

  if (error) {
    throw new Error(`forfeit_past_bye_matches failed: ${error.message}`);
  }

  return typeof data === 'number' ? data : 0;
}
