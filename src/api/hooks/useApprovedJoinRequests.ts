/**
 * @fileoverview Notify-on-approval hooks for the onboarding cascade.
 *
 * `useApprovedJoinRequests` polls for the signed-in user's approved-but-
 * unacknowledged join requests (the "you're in" feed) the same way pending
 * invites are surfaced. `useAcknowledgeJoinRequest` stamps one acknowledged so
 * the popup shows once, then routes the joiner to their team.
 *
 * See docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md (Unit 3).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMyApprovedJoinRequests,
  acknowledgeJoinRequest,
  type ApprovedJoinRequest,
} from '../queries/teamJoin';
import { queryKeys } from '../queryKeys';
import { useUser } from '@/context/useUser';

/** The caller's approved-but-unacknowledged joins; enabled only when signed in. */
export function useApprovedJoinRequests() {
  const { user } = useUser();
  return useQuery<ApprovedJoinRequest[]>({
    queryKey: queryKeys.teamJoin.approved(),
    queryFn: getMyApprovedJoinRequests,
    enabled: !!user,
    staleTime: 60 * 1000,
  });
}

/** Acknowledge one approved join so the popup won't show it again. */
export function useAcknowledgeJoinRequest() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (requestId) => acknowledgeJoinRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teamJoin.approved() });
    },
  });
}
