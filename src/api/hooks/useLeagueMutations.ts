/**
 * @fileoverview League Mutation Hooks
 *
 * TanStack Query mutation hooks for league operations.
 * Automatically invalidates relevant queries on success.
 *
 * @see api/mutations/leagues.ts - Raw mutation functions
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createLeague,
  updateLeague,
  deleteLeague,
  updateLeagueDayOfWeek,
} from '../mutations/leagues';
import { queryKeys } from '../queryKeys';

/**
 * Hook to create a new league
 *
 * Automatically invalidates league queries on success.
 *
 * @returns TanStack Query mutation result
 *
 * @example
 * const createLeagueMutation = useCreateLeague();
 *
 * const handleSubmit = async () => {
 *   try {
 *     const league = await createLeagueMutation.mutateAsync({
 *       operatorId: 'op-123',
 *       gameType: 'eight_ball',
 *       dayOfWeek: 'monday',
 *       handicapVariant: 'standard',
 *       teamHandicapVariant: 'standard',
 *       leagueStartDate: '2025-01-15',
 *       division: 'East'
 *     });
 *     console.log('Created league:', league);
 *   } catch (error) {
 *     console.error('Failed to create league:', error);
 *   }
 * };
 */
export function useCreateLeague() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createLeague,
    onSuccess: (newLeague, variables) => {
      // Invalidate league lists for this operator
      queryClient.invalidateQueries({
        queryKey: queryKeys.leagues.byOperator(variables.operatorId),
      });

      // Set the new league in cache
      queryClient.setQueryData(
        queryKeys.leagues.detail(newLeague.id),
        newLeague
      );
    },
  });
}

/**
 * Hook to update an existing league
 *
 * Automatically invalidates league queries on success.
 *
 * @returns TanStack Query mutation result
 *
 * @example
 * const updateLeagueMutation = useUpdateLeague();
 *
 * const handleSave = async () => {
 *   try {
 *     const league = await updateLeagueMutation.mutateAsync({
 *       leagueId: 'league-123',
 *       gameType: 'nine_ball',
 *       status: 'completed'
 *     });
 *     console.log('Updated league:', league);
 *   } catch (error) {
 *     console.error('Failed to update league:', error);
 *   }
 * };
 */
export function useUpdateLeague() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateLeague,
    onSuccess: (updatedLeague) => {
      // Invalidate all league queries to refresh lists
      queryClient.invalidateQueries({
        queryKey: queryKeys.leagues.all,
      });

      // Update the specific league in cache
      queryClient.setQueryData(
        queryKeys.leagues.detail(updatedLeague.id),
        updatedLeague
      );
    },
  });
}

/**
 * Hook to delete a league (hard delete with cascade)
 *
 * Automatically invalidates league queries on success.
 *
 * @returns TanStack Query mutation result
 *
 * @example
 * const deleteLeagueMutation = useDeleteLeague();
 *
 * const handleDelete = async (leagueId: string) => {
 *   const confirmed = window.confirm('Delete this league? This cannot be undone.');
 *   if (!confirmed) return;
 *
 *   try {
 *     await deleteLeagueMutation.mutateAsync({ leagueId });
 *     console.log('League deleted');
 *   } catch (error) {
 *     console.error('Failed to delete league:', error);
 *   }
 * };
 */
export function useDeleteLeague() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteLeague,
    onSuccess: (_, variables) => {
      // Invalidate all league queries to refresh lists
      queryClient.invalidateQueries({
        queryKey: queryKeys.leagues.all,
      });

      // Remove the deleted league from cache
      queryClient.removeQueries({
        queryKey: queryKeys.leagues.detail(variables.leagueId),
      });
    },
  });
}

/**
 * Hook to update league day of week
 *
 * Automatically invalidates league queries on success to refresh UI.
 *
 * @returns Mutation hook with mutate function and state
 *
 * @example
 * function LeagueEditor({ leagueId }) {
 *   const updateDay = useUpdateLeagueDayOfWeek();
 *
 *   const handleSave = () => {
 *     updateDay.mutate({
 *       leagueId,
 *       newDay: 'Wednesday'
 *     });
 *   };
 *
 *   return (
 *     <button onClick={handleSave} disabled={updateDay.isPending}>
 *       {updateDay.isPending ? 'Saving...' : 'Save'}
 *     </button>
 *   );
 * }
 */
export function useUpdateLeagueDayOfWeek() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateLeagueDayOfWeek,
    onSuccess: (_, variables) => {
      // Invalidate all league queries to refresh data
      queryClient.invalidateQueries({
        queryKey: queryKeys.leagues.all,
      });

      // Also invalidate seasons for this league (day change affects schedule)
      queryClient.invalidateQueries({
        queryKey: queryKeys.seasons.byLeague(variables.leagueId),
      });
    },
  });
}
