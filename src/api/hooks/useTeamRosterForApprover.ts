/**
 * @fileoverview TanStack Query hook for a team's full roster, for the expanded
 * approve card.
 *
 * Lazily loads the roster (registered members + claimable placeholders, each
 * marked) — only fetched when a `teamId` is provided, i.e. when a request card
 * is expanded. Collapsed cards never fetch, so the list stays light at the LO's
 * scale. Captain/org-staff gating lives in the RPC.
 *
 * See docs/plans/2026-06-11-003-feat-onboarding-approve-surface-plan.md (Unit 1).
 */

import { useQuery } from '@tanstack/react-query';
import {
  getTeamRosterForApprover,
  type TeamRosterMember,
} from '../queries/teamJoin';
import { queryKeys } from '../queryKeys';

export function useTeamRosterForApprover(teamId: string | undefined) {
  return useQuery<TeamRosterMember[]>({
    queryKey: queryKeys.teamJoin.roster(teamId ?? ''),
    queryFn: () => getTeamRosterForApprover(teamId!),
    enabled: !!teamId,
    staleTime: 30 * 1000,
  });
}
