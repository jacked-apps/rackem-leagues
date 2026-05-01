/**
 * @fileoverview Team Mutation Hooks (TanStack Query)
 *
 * React hooks for team mutations with automatic cache invalidation.
 * Wraps pure mutation functions with TanStack Query for state management.
 *
 * @see api/mutations/teams.ts - Pure mutation functions
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import {
  createTeam,
  updateTeam,
  deleteTeam,
  dropTeam,
  replaceTeam,
} from '../mutations/teams';

/**
 * Hook to create a new team
 *
 * Automatically invalidates team queries on success.
 *
 * @returns TanStack Query mutation result
 *
 * @example
 * const createTeamMutation = useCreateTeam();
 *
 * const handleSubmit = async () => {
 *   try {
 *     const team = await createTeamMutation.mutateAsync({
 *       seasonId: 'season-123',
 *       leagueId: 'league-456',
 *       captainId: 'member-789',
 *       teamName: 'The Sharks',
 *       rosterSize: 8,
 *       homeVenueId: 'venue-111',
 *       rosterPlayerIds: ['member-789', 'member-222', 'member-333']
 *     });
 *     console.log('Created team:', team);
 *   } catch (error) {
 *     console.error('Failed to create team:', error);
 *   }
 * };
 */
export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTeam,
    onSuccess: (newTeam, variables) => {
      // Invalidate team lists for this season
      queryClient.invalidateQueries({
        queryKey: queryKeys.teams.bySeason(variables.seasonId),
      });

      // Invalidate team lists for this league
      queryClient.invalidateQueries({
        queryKey: queryKeys.teams.byLeague(variables.leagueId),
      });

      // Set the new team in cache
      queryClient.setQueryData(
        queryKeys.teams.detail(newTeam.id),
        newTeam
      );
    },
  });
}

/**
 * Hook to update an existing team
 *
 * Automatically invalidates team queries on success.
 *
 * @returns TanStack Query mutation result
 *
 * @example
 * const updateTeamMutation = useUpdateTeam();
 *
 * const handleSave = async () => {
 *   try {
 *     const team = await updateTeamMutation.mutateAsync({
 *       teamId: 'team-123',
 *       seasonId: 'season-456',
 *       captainId: 'member-789',
 *       teamName: 'The Sharks (Updated)',
 *       homeVenueId: 'venue-222',
 *       rosterPlayerIds: ['member-789', 'member-111', 'member-333', 'member-444'],
 *       isCaptainVariant: false
 *     });
 *     console.log('Updated team:', team);
 *   } catch (error) {
 *     console.error('Failed to update team:', error);
 *   }
 * };
 */
export function useUpdateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTeam,
    onSuccess: (updatedTeam) => {
      // Invalidate all team queries to refresh lists
      queryClient.invalidateQueries({
        queryKey: queryKeys.teams.all,
      });

      // Update the specific team in cache
      queryClient.setQueryData(
        queryKeys.teams.detail(updatedTeam.id),
        updatedTeam
      );
    },
  });
}

/**
 * Hook to delete a team (soft delete - withdraws team)
 *
 * Automatically invalidates team queries on success.
 *
 * @returns TanStack Query mutation result
 *
 * @example
 * const deleteTeamMutation = useDeleteTeam();
 *
 * const handleDelete = async (teamId: string) => {
 *   const confirmed = window.confirm('Withdraw this team?');
 *   if (!confirmed) return;
 *
 *   try {
 *     await deleteTeamMutation.mutateAsync({ teamId });
 *     console.log('Team withdrawn');
 *   } catch (error) {
 *     console.error('Failed to withdraw team:', error);
 *   }
 * };
 */
export function useDeleteTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTeam,
    onSuccess: (withdrawnTeam) => {
      // Invalidate all team queries to refresh lists
      queryClient.invalidateQueries({
        queryKey: queryKeys.teams.all,
      });

      // Update the withdrawn team in cache
      queryClient.setQueryData(
        queryKeys.teams.detail(withdrawnTeam.id),
        withdrawnTeam
      );
    },
  });
}

/**
 * Hook for the drop_team operator action.
 *
 * After a successful drop the team list, schedule, standings, and
 * captain-status caches all need to refresh — broad invalidation is
 * cheaper than fine-grained tracking and matches the placeholder-wizard
 * cache pattern used elsewhere in the codebase.
 */
export function useDropTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: dropTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.members.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.invites.all });
    },
  });
}

/**
 * Hook for replacing a bye / withdrawn slot with a brand-new active team.
 */
export function useReplaceTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: replaceTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
    },
  });
}
