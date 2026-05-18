/**
 * @fileoverview TanStack Query mutation hook for
 * `create_season_from_previous`.
 *
 * On success, invalidates the league/season-related caches so the
 * operator sees the new season immediately when they navigate back
 * to the league page.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createSeasonFromPrevious,
  type CreateSeasonFromPreviousParams,
  type CreateSeasonFromPreviousResult,
} from '../mutations/newSeason';
import { queryKeys } from '../queryKeys';

export function useCreateSeasonFromPrevious() {
  const queryClient = useQueryClient();

  return useMutation<
    CreateSeasonFromPreviousResult,
    Error,
    CreateSeasonFromPreviousParams
  >({
    mutationFn: createSeasonFromPrevious,
    onSuccess: async (_data, variables) => {
      // Same refetchType: 'all' pattern as PR #115's #7 fix —
      // ensures inactive queries get fresh data so the destination
      // page renders the new season immediately on navigation.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.leagues.detail(variables.leagueId),
          refetchType: 'all',
        }),
        queryClient.invalidateQueries({
          queryKey: ['newSeasonPrefill', variables.leagueId],
          refetchType: 'all',
        }),
        // Org-level league list shows per-league season counts; refresh
        queryClient.invalidateQueries({
          queryKey: ['leaguesWithProgress'],
          refetchType: 'all',
        }),
      ]);
    },
  });
}
