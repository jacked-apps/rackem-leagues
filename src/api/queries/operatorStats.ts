/**
 * @fileoverview Operator Stats Query Functions
 *
 * Pure data fetching functions for operator dashboard statistics.
 * Uses a single Postgres RPC function to efficiently fetch all stats in one call.
 * Used by TanStack Query hooks for caching and state management.
 */

import { supabase } from '@/supabaseClient';

/**
 * Operator statistics data structure
 * Returned from the get_operator_stats RPC function
 */
export interface OperatorStats {
  leagues: number;
  teams: number;
  players: number;
  venues: number;
  seasons_completed: number;
  matches_completed: number;
  games_played: number;
}

/**
 * Fetch all operator statistics in a single database call
 *
 * Uses Postgres RPC function to efficiently count all stats server-side.
 * This consolidates 7 separate count queries into 1 optimized call.
 *
 * Stats returned:
 * - leagues: Active leagues count
 * - teams: Total teams across all leagues
 * - players: Total players across all teams
 * - venues: Active venues count
 * - seasons_completed: Completed seasons count
 * - matches_completed: Completed matches count
 * - games_played: Total games with winner determined
 *
 * @param operatorId - Operator's primary key ID
 * @returns Object with all operator statistics
 * @throws Error if database query fails
 *
 * @example
 * const stats = await getOperatorStats('operator-uuid');
 * console.log(`Managing ${stats.leagues} leagues with ${stats.teams} teams`);
 */
export async function getOperatorStats(operatorId: string): Promise<OperatorStats> {
  const { data, error } = await supabase
    .rpc('get_operator_stats', { operator_id_param: operatorId });

  if (error) {
    throw new Error(`Failed to fetch operator stats: ${error.message}`);
  }

  if (!data) {
    throw new Error('No data returned from operator stats query');
  }

  // The RPC returns jsonb, typed as plain Json; the SQL function builds this shape.
  return data as unknown as OperatorStats;
}
