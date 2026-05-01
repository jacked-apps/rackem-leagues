/**
 * @fileoverview Match Mutation Hooks (TanStack Query)
 *
 * React hooks for match mutations with automatic cache invalidation.
 * Wraps pure mutation functions with TanStack Query for state management.
 *
 * @see api/mutations/matches.ts - Pure mutation functions
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import {
  updateMatch,
  createMatchGames,
  updateMatchGame,
  convertMatchToMakeup,
  forfeitPastByeMatches,
} from '../mutations/matches';

/**
 * Options for controlling cache invalidation
 */
export interface MatchMutationOptions {
  /** Whether to invalidate and refetch queries after mutation (default: true) */
  invalidate?: boolean;
}

/**
 * Hook to update any field(s) on a match
 *
 * Generic mutation that can update any match field(s).
 * Optionally invalidates queries after success.
 *
 * @param options - Options to control refetching behavior
 * @returns TanStack Query mutation result
 *
 * @example
 * // Update lineup ID with automatic refetch
 * const updateMatchMutation = useUpdateMatch();
 * await updateMatchMutation.mutateAsync({
 *   matchId: 'match-123',
 *   updates: { home_lineup_id: 'lineup-456' }
 * });
 *
 * @example
 * // Update multiple fields with automatic refetch
 * const updateMatchMutation = useUpdateMatch();
 * await updateMatchMutation.mutateAsync({
 *   matchId: 'match-123',
 *   updates: {
 *     home_lineup_id: 'lineup-456',
 *     started_at: new Date().toISOString()
 *   }
 * });
 *
 * @example
 * // Update without refetch (for bulk operations)
 * const updateMatchMutation = useUpdateMatch({ invalidate: false });
 * await updateMatchMutation.mutateAsync({
 *   matchId: 'match-123',
 *   updates: { home_games_to_win: 8 }
 * });
 */
export function useUpdateMatch(options: MatchMutationOptions = {}) {
  const { invalidate = true } = options;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMatch,
    onSuccess: (_, variables) => {
      if (!invalidate) return;

      // Invalidate match detail query
      queryClient.invalidateQueries({
        queryKey: queryKeys.matches.detail(variables.matchId),
      });

      // Invalidate match list queries (in case status changed)
      queryClient.invalidateQueries({
        queryKey: queryKeys.matches.all,
      });
    },
  });
}

/**
 * Hook to create match game records
 *
 * Generic mutation that can create any number of games with any data.
 * Optionally invalidates queries after success.
 *
 * @param options - Options to control refetching behavior
 * @returns TanStack Query mutation result
 *
 * @example
 * // Create tiebreaker games
 * const createGamesMutation = useCreateMatchGames();
 * await createGamesMutation.mutateAsync({
 *   games: [
 *     {
 *       match_id: 'match-123',
 *       game_number: 19,
 *       home_action: 'breaks',
 *       away_action: 'racks',
 *       is_tiebreaker: true,
 *       game_type: 'nine_ball'
 *     }
 *   ]
 * });
 */
export function useCreateMatchGames(options: MatchMutationOptions = {}) {
  const { invalidate = true } = options;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createMatchGames,
    onSuccess: (createdGames) => {
      if (!invalidate || !createdGames.length) return;

      const matchId = createdGames[0].match_id;

      // Invalidate match games query
      queryClient.invalidateQueries({
        queryKey: queryKeys.matches.games(matchId),
      });

      // Invalidate match detail query
      queryClient.invalidateQueries({
        queryKey: queryKeys.matches.detail(matchId),
      });
    },
  });
}

/**
 * Hook to update a match game record
 *
 * Generic mutation that can update any fields on a game record.
 * Used for updating player assignments, scores, confirmations, etc.
 * Optionally invalidates queries after success.
 *
 * @param matchId - Match ID for cache invalidation
 * @param options - Options to control refetching behavior
 * @returns TanStack Query mutation result
 *
 * @example
 * // Assign player to tiebreaker game
 * const updateGameMutation = useUpdateMatchGame(matchId);
 * await updateGameMutation.mutateAsync({
 *   gameId: 'game-123',
 *   updates: { home_player_id: 'player-456' }
 * });
 */
export function useUpdateMatchGame(matchId: string, options: MatchMutationOptions = {}) {
  const { invalidate = true } = options;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMatchGame,
    onSuccess: () => {
      if (!invalidate) return;

      // Invalidate match games query
      queryClient.invalidateQueries({
        queryKey: queryKeys.matches.games(matchId),
      });

      // Invalidate match detail query
      queryClient.invalidateQueries({
        queryKey: queryKeys.matches.detail(matchId),
      });
    },
  });
}

/**
 * Hook for converting a forfeited / unplayed bye match into a makeup.
 *
 * Affects matches, schedules, and standings — invalidate broadly.
 */
export function useConvertMatchToMakeup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: convertMatchToMakeup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
    },
  });
}

/**
 * Hook for sweeping past-due bye/withdrawn matches into forfeit wins.
 * Used by the operator's "Close Past Byes" button.
 */
export function useForfeitPastByeMatches() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: forfeitPastByeMatches,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
    },
  });
}
