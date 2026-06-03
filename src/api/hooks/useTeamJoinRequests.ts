/**
 * @fileoverview TanStack Query hook for the approver's pending-request feed.
 *
 * Backs the approve surface (Unit 5) — the captain sees his team's requests, an
 * LO sees every team in his org, from one de-duplicated server read. Enabled
 * only for a signed-in user.
 *
 * See docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md (Unit 5).
 */

import { useQuery } from '@tanstack/react-query';
import {
  getJoinRequestsForApprover,
  type ApproverJoinRequest,
} from '../queries/teamJoin';
import { queryKeys } from '../queryKeys';
import { useUser } from '@/context/useUser';

export function useTeamJoinRequests() {
  const { user } = useUser();

  return useQuery<ApproverJoinRequest[]>({
    queryKey: queryKeys.teamJoin.requests(),
    queryFn: getJoinRequestsForApprover,
    enabled: !!user,
    staleTime: 30 * 1000,
  });
}
