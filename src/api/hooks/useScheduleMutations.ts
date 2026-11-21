/**
 * @fileoverview Schedule Mutation Hooks (TanStack Query)
 *
 * React hooks for schedule mutations with automatic cache invalidation.
 * Wraps pure mutation functions with TanStack Query for state management.
 *
 * @see api/mutations/schedules.ts - Pure mutation functions
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateSeasonSchedule } from './useInvalidateSeasonSchedule';
import {
  generateScheduleMutation,
  deleteSchedule,
} from '../mutations/schedules';

/**
 * Hook to generate a season schedule
 *
 * Automatically invalidates match/schedule queries on success.
 *
 * @returns TanStack Query mutation result
 *
 * @example
 * const generateScheduleMutation = useGenerateSchedule();
 *
 * const handleGenerate = async () => {
 *   try {
 *     const result = await generateScheduleMutation.mutateAsync({
 *       seasonId: 'season-123',
 *       teams: teamPositions,
 *       skipExistingCheck: false
 *     });
 *
 *     if (result.success) {
 *       console.log(`Created ${result.matchesCreated} matches`);
 *     } else {
 *       console.error(result.error);
 *     }
 *   } catch (error) {
 *     console.error('Failed to generate schedule:', error);
 *   }
 * };
 */
export function useGenerateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generateScheduleMutation,
    onSuccess: (result, variables) => {
      // Shared list of what a schedule change makes stale (incl. teams: BYE).
      if (result.success) return invalidateSeasonSchedule(queryClient, variables.seasonId);
    },
  });
}

/**
 * Hook to delete a season schedule
 *
 * Automatically invalidates match/schedule queries on success.
 *
 * @returns TanStack Query mutation result
 *
 * @example
 * const deleteScheduleMutation = useDeleteSchedule();
 *
 * const handleDelete = async (seasonId: string) => {
 *   const confirmed = window.confirm('Delete entire schedule? This cannot be undone.');
 *   if (!confirmed) return;
 *
 *   try {
 *     const result = await deleteScheduleMutation.mutateAsync({ seasonId });
 *
 *     if (result.success) {
 *       console.log(`Deleted ${result.matchesDeleted} matches`);
 *     } else {
 *       console.error(result.error);
 *     }
 *   } catch (error) {
 *     console.error('Failed to delete schedule:', error);
 *   }
 * };
 */
export function useDeleteSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSchedule,
    onSuccess: (result, variables) => {
      // Shared list of what a schedule change makes stale (incl. teams: BYE).
      if (result.success) return invalidateSeasonSchedule(queryClient, variables.seasonId);
    },
  });
}
