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
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database.types';

/**
 * Generic match update parameters
 */
export interface UpdateMatchParams {
  matchId: string;
  updates: TablesUpdate<'matches'>; // Any match field(s) to update
}

/**
 * Match database record (the generated `matches` row).
 */
export type Match = Tables<'matches'>;

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
 *     home_to_win: 8,
 *     away_to_win: 7,
 *     home_to_tie: 7,
 *     away_to_tie: 8
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
  games: TablesInsert<'match_games'>[]; // Game rows to create
}

/**
 * Match game database record (the generated `match_games` row).
 */
export type MatchGame = Tables<'match_games'>;

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
  updates: TablesUpdate<'match_games'>;
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
