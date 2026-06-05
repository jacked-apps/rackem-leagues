/**
 * @fileoverview Hooks for the join-link distribution surfaces (Unit 7).
 *
 * - useTeamJoinToken: a team's current join token (captain "Invite my team").
 * - useRotateTeamJoinToken: regenerate it on a leak; refreshes the token query.
 * - useOrgTeamsForOnboarding: the LO's per-team captain + link list.
 *
 * See docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md (Unit 7).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getTeamJoinToken,
  rotateTeamJoinToken,
  getOrgTeamsForOnboarding,
  type OrgOnboardingTeam,
} from '../queries/teamJoin';
import { queryKeys } from '../queryKeys';

export function useTeamJoinToken(teamId: string | undefined) {
  return useQuery<string | null>({
    queryKey: queryKeys.teamJoin.token(teamId ?? ''),
    queryFn: () => getTeamJoinToken(teamId!),
    enabled: !!teamId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRotateTeamJoinToken(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation<string | null, Error, void>({
    mutationFn: () => rotateTeamJoinToken(teamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teamJoin.token(teamId) });
    },
  });
}

export function useOrgTeamsForOnboarding(orgId: string | undefined) {
  return useQuery<OrgOnboardingTeam[]>({
    queryKey: queryKeys.teamJoin.orgTeams(orgId ?? ''),
    queryFn: () => getOrgTeamsForOnboarding(orgId!),
    enabled: !!orgId,
    staleTime: 60 * 1000,
  });
}
