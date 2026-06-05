/**
 * @fileoverview TanStack Query hooks for captain re-up sheet
 * submit + dismiss mutations.
 *
 * Both hooks invalidate the captain-reup-prompt cache so the modal
 * disappears immediately after the action — no flash of stale UI.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  submitCaptainReup,
  dismissCaptainReup,
  type SubmitCaptainReupParams,
  type DismissCaptainReupParams,
} from '../mutations/captainReup';

export function useSubmitCaptainReup() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, SubmitCaptainReupParams>({
    mutationFn: submitCaptainReup,
    onSuccess: async (_data, vars) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['captainReupPrompt', vars.captainId],
          refetchType: 'all',
        }),
        queryClient.invalidateQueries({
          queryKey: ['leagueReupStatus'],
          refetchType: 'all',
        }),
      ]);
    },
  });
}

export function useDismissCaptainReup() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, DismissCaptainReupParams>({
    mutationFn: dismissCaptainReup,
    onSuccess: async (_data, vars) => {
      await queryClient.invalidateQueries({
        queryKey: ['captainReupPrompt', vars.captainId],
        refetchType: 'all',
      });
    },
  });
}
