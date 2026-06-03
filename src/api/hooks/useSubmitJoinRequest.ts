/**
 * @fileoverview Mutation hook for filing a team join request.
 *
 * Backs the /join/:token page's submit (Unit 3). On success it invalidates the
 * team's join view so the page re-reads and flips to the "waiting" state. The
 * mutation variable is the optional placeholder spot to claim (omit for a
 * plain self-add).
 *
 * See docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md (Unit 3).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submitJoinRequest, type JoinRequestResult } from '../mutations/teamJoin';
import { queryKeys } from '../queryKeys';

/**
 * @param token - the team join token the page is showing.
 */
export function useSubmitJoinRequest(token: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<JoinRequestResult, Error, string | null | undefined>({
    mutationFn: (claimedMemberId) => submitJoinRequest(token!, claimedMemberId),
    onSuccess: () => {
      if (token) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.teamJoin.view(token),
        });
      }
    },
  });
}
