/**
 * @fileoverview TanStack Query hook for a team's claimable placeholders.
 *
 * Lazily loads the Replace picker's options (Unit 5) — only fetched when a
 * `teamId` is provided (i.e. when the picker opens). Captain/org-staff gating
 * lives in the RPC.
 *
 * See docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md (Unit 5).
 */

import { useQuery } from '@tanstack/react-query';
import {
  getTeamPlaceholdersForClaim,
  type ClaimablePlaceholder,
} from '../queries/teamJoin';
import { queryKeys } from '../queryKeys';

export function useTeamPlaceholders(teamId: string | undefined) {
  return useQuery<ClaimablePlaceholder[]>({
    queryKey: queryKeys.teamJoin.placeholders(teamId ?? ''),
    queryFn: () => getTeamPlaceholdersForClaim(teamId!),
    enabled: !!teamId,
    staleTime: 30 * 1000,
  });
}
