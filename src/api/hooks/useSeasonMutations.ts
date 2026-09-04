/**
 * @fileoverview Season Mutation Hooks (TanStack Query)
 *
 * React hooks for season mutations with automatic cache invalidation.
 * Wraps pure mutation functions with TanStack Query for state management.
 *
 * @see api/mutations/seasons.ts - Pure mutation functions
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import {
  createSeason,
  updateSeason,
  activateSeason,
  deleteSeason,
  removeSeason,
} from '../mutations/seasons';

/**
 * Hook to create a new season
 *
 * Automatically invalidates season queries on success.
 *
 * @returns TanStack Query mutation result
 *
 * @example
 * const createSeasonMutation = useCreateSeason();
 *
 * const handleSubmit = async () => {
 *   try {
 *     const season = await createSeasonMutation.mutateAsync({
 *       leagueId: 'league-123',
 *       league: leagueData,
 *       startDate: '2025-01-15',
 *       seasonLength: 12,
 *       schedule: weekEntries,
 *       operatorId: 'op-123',
 *       bcaChoice: 'ignore',
 *       apaChoice: 'ignore',
 *       onSavePreference: async (org, choice, id) => { ... }
 *     });
 *     console.log('Created season:', season);
 *   } catch (error) {
 *     console.error('Failed to create season:', error);
 *   }
 * };
 */
export function useCreateSeason() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSeason,
    onSuccess: (newSeason, variables) => {
      // Invalidate season lists for this league
      queryClient.invalidateQueries({
        queryKey: queryKeys.seasons.byLeague(variables.leagueId),
      });

      // Set the new season in cache
      queryClient.setQueryData(
        queryKeys.seasons.detail(newSeason.id),
        newSeason
      );
    },
  });
}

/**
 * Hook to update an existing season
 *
 * Automatically invalidates season queries on success.
 *
 * @returns TanStack Query mutation result
 *
 * @example
 * const updateSeasonMutation = useUpdateSeason();
 *
 * const handleSave = async () => {
 *   try {
 *     const season = await updateSeasonMutation.mutateAsync({
 *       seasonId: 'season-123',
 *       seasonName: 'Fall 2025 Updated',
 *       status: 'active'
 *     });
 *     console.log('Updated season:', season);
 *   } catch (error) {
 *     console.error('Failed to update season:', error);
 *   }
 * };
 */
export function useUpdateSeason() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSeason,
    onSuccess: (updatedSeason) => {
      // Invalidate all season queries to refresh lists
      queryClient.invalidateQueries({
        queryKey: queryKeys.seasons.all,
      });

      // Update the specific season in cache
      queryClient.setQueryData(
        queryKeys.seasons.detail(updatedSeason.id),
        updatedSeason
      );
    },
  });
}

/**
 * Hook to activate a season
 *
 * Sets season status to 'active' and deactivates other active seasons
 * for the same league. Only one active season per league is allowed.
 *
 * Automatically invalidates season queries on success.
 *
 * @returns TanStack Query mutation result
 *
 * @example
 * const activateSeasonMutation = useActivateSeason();
 *
 * const handleActivate = async (seasonId: string, leagueId: string) => {
 *   const confirmed = window.confirm('Activate this season?');
 *   if (!confirmed) return;
 *
 *   try {
 *     await activateSeasonMutation.mutateAsync({ seasonId, leagueId });
 *     console.log('Season activated');
 *   } catch (error) {
 *     console.error('Failed to activate season:', error);
 *   }
 * };
 */
export function useActivateSeason() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: activateSeason,
    onSuccess: (activatedSeason, variables) => {
      // Invalidate all seasons for this league (to update old active season)
      queryClient.invalidateQueries({
        queryKey: queryKeys.seasons.byLeague(variables.leagueId),
      });

      // Invalidate active season query
      queryClient.invalidateQueries({
        queryKey: queryKeys.seasons.active(),
      });

      // Update the activated season in cache
      queryClient.setQueryData(
        queryKeys.seasons.detail(activatedSeason.id),
        activatedSeason
      );
    },
  });
}

/**
 * Hook to delete a season (soft delete - cancels season)
 *
 * Automatically invalidates season queries on success.
 *
 * @returns TanStack Query mutation result
 *
 * @example
 * const deleteSeasonMutation = useDeleteSeason();
 *
 * const handleDelete = async (seasonId: string) => {
 *   const confirmed = window.confirm('Cancel this season?');
 *   if (!confirmed) return;
 *
 *   try {
 *     await deleteSeasonMutation.mutateAsync({ seasonId });
 *     console.log('Season cancelled');
 *   } catch (error) {
 *     console.error('Failed to cancel season:', error);
 *   }
 * };
 */
export function useDeleteSeason() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSeason,
    onSuccess: (cancelledSeason) => {
      // Invalidate all season queries to refresh lists
      queryClient.invalidateQueries({
        queryKey: queryKeys.seasons.all,
      });

      // Update the cancelled season in cache
      queryClient.setQueryData(
        queryKeys.seasons.detail(cancelledSeason.id),
        cancelledSeason
      );
    },
  });
}

/**
 * Hook to remove a season the operator wants gone — hard-deletes it when nothing
 * has been played, or archives it (preserving data) when it has played matches.
 * See `removeSeason` for the guard rationale. Invalidates season queries so the
 * league page's cards refresh.
 *
 * @returns TanStack mutation whose result is `{ action: 'deleted' | 'archived', completedMatches }`.
 */
export function useRemoveSeason() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeSeason,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seasons.all });
    },
  });
}
