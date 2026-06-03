/**
 * @fileoverview TanStack Query hook for the public team join view.
 *
 * Backs the `/join/:token` page (Unit 3): given the token from a shared link
 * or QR, it loads the team + roster spots + the caller's existing-request
 * state via the `get_team_join_view` RPC. Readable pre-auth, so the page can
 * show the team before the joiner signs in.
 *
 * See docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md (Unit 2).
 */

import { useQuery } from '@tanstack/react-query';
import { getTeamJoinView, type TeamJoinView } from '../queries/teamJoin';
import { queryKeys } from '../queryKeys';

/**
 * Load the join view for a team token.
 *
 * @param token - the team's `join_token`; the query is disabled when absent.
 */
export function useTeamJoinView(token: string | undefined) {
  return useQuery<TeamJoinView>({
    queryKey: queryKeys.teamJoin.view(token ?? ''),
    queryFn: () => getTeamJoinView(token!),
    enabled: !!token,
    // The roster changes only when the captain edits it or a join is approved;
    // a short stale window keeps the join page responsive without hammering.
    staleTime: 30 * 1000,
  });
}
