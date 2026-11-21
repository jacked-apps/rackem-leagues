/**
 * @fileoverview One place that says "this season's schedule changed" to the
 * TanStack Query cache.
 *
 * Why: the app's default staleTime is 5 minutes with refetchOnMount off
 * (src/api/client.ts), so a page shows cached data until it is invalidated.
 * Schedule writes made outside a mutation hook (clearSchedule, generateSchedule,
 * team drops, the pre-season rebuild) never told the cache, so the Matchups
 * page kept showing the OLD schedule after a rebuild (Ed, 2026-11-21).
 *
 * Every schedule-changing action calls this afterwards. It refreshes the
 * season's schedule, every match list, the team lists (a drop/add changes
 * them, and a rebuild creates or removes the BYE) and the standings.
 */

import { useCallback } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

/**
 * Invalidate everything a schedule change can make stale.
 *
 * @param queryClient - The app's query client
 * @param seasonId - The season whose schedule changed
 */
export function invalidateSeasonSchedule(queryClient: QueryClient, seasonId: string): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.schedules.bySeason(seasonId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.matches.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.teams.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.stats.standings(seasonId) }),
  ]).then(() => undefined);
}

/**
 * Hook form of invalidateSeasonSchedule for components and hooks.
 *
 * @example
 * const scheduleChanged = useInvalidateSeasonSchedule();
 * await clearSchedule(seasonId);
 * await scheduleChanged(seasonId);
 */
export function useInvalidateSeasonSchedule(): (seasonId: string) => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback((seasonId: string) => invalidateSeasonSchedule(queryClient, seasonId), [queryClient]);
}
