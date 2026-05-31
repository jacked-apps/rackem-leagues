/**
 * @fileoverview Hooks for the season payout lock-in snapshot.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSeasonLockedPayouts, type SeasonLockedPayoutsRow } from '../queries/seasonLockedPayouts';
import {
  lockSeasonPayouts,
  unlockSeasonPayouts,
  type LockSeasonPayoutsParams,
} from '../mutations/seasonLockedPayouts';

export function useSeasonLockedPayouts(seasonId: string | undefined) {
  return useQuery<SeasonLockedPayoutsRow | null>({
    queryKey: ['seasonLockedPayouts', seasonId],
    queryFn: () => getSeasonLockedPayouts(seasonId!),
    enabled: !!seasonId,
    staleTime: 30 * 1000,
  });
}

export function useLockSeasonPayouts() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, LockSeasonPayoutsParams>({
    mutationFn: lockSeasonPayouts,
    onSuccess: async (_data, vars) => {
      await queryClient.invalidateQueries({
        queryKey: ['seasonLockedPayouts', vars.seasonId],
        refetchType: 'all',
      });
    },
  });
}

export function useUnlockSeasonPayouts() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { seasonId: string }>({
    mutationFn: ({ seasonId }) => unlockSeasonPayouts(seasonId),
    onSuccess: async (_data, vars) => {
      await queryClient.invalidateQueries({
        queryKey: ['seasonLockedPayouts', vars.seasonId],
        refetchType: 'all',
      });
    },
  });
}
