/**
 * @fileoverview Hooks for the join-link distribution surfaces.
 *
 * - useTeamJoinToken: a team's current join token (captain "Invite my team").
 * - useRotateTeamJoinToken: regenerate it on a leak; refreshes the token query.
 * - useLeagueTeamsForOnboarding: the LO's per-team captain + link list, scoped
 *   to one league and limited to captains not yet registered.
 *
 * See docs/plans/2026-06-06-002-fix-onboard-captains-league-scope-plan.md.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getTeamJoinToken,
  rotateTeamJoinToken,
  getLeagueTeamsForOnboarding,
  type LeagueOnboardingTeam,
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

export function useLeagueTeamsForOnboarding(leagueId: string | undefined) {
  return useQuery<LeagueOnboardingTeam[]>({
    queryKey: queryKeys.teamJoin.leagueTeams(leagueId ?? ''),
    queryFn: () => getLeagueTeamsForOnboarding(leagueId!),
    enabled: !!leagueId,
    staleTime: 60 * 1000,
  });
}
