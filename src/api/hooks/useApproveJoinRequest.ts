/**
 * @fileoverview Mutation hook for the approver's Add / Replace / Decline.
 *
 * Backs the approve surface (Unit 5). On settling a request it invalidates the
 * join-cascade queries (request lists + doorbell count) and team rosters so the
 * handled request leaves the queue and any roster change shows without a manual
 * refresh.
 *
 * See docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md (Unit 4).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  approveJoinRequest,
  type ApproveAction,
  type ApproveResult,
} from '../mutations/teamJoin';
import { queryKeys } from '../queryKeys';

interface ApproveVars {
  requestId: string;
  action: ApproveAction;
  /** Placeholder to merge for the Replace action. */
  claimedMemberId?: string | null;
}

export function useApproveJoinRequest() {
  const queryClient = useQueryClient();

  return useMutation<ApproveResult, Error, ApproveVars>({
    mutationFn: ({ requestId, action, claimedMemberId }) =>
      approveJoinRequest(requestId, action, claimedMemberId),
    onSuccess: () => {
      // Request lists + doorbell count both read under teamJoin; rosters change
      // on Add/Replace.
      queryClient.invalidateQueries({ queryKey: queryKeys.teamJoin.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.all });
    },
  });
}
