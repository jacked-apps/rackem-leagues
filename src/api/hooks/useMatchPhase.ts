/**
 * @fileoverview Match-phase status query (route guard's data source).
 *
 * Returns a minimal `{ id, status, started_at }` slice of the matches row,
 * used exclusively by `MatchPhaseGuard` to dispatch lineup vs scoring vs
 * recovery rendering on every match-scoped page.
 *
 * ## Why this is separate from `useMatchById`
 *
 * `useMatchById` is consumed by dashboard cards and similar list-shaped
 * surfaces that benefit from caching: it uses
 * `staleTime: STALE_TIME.SCHEDULES` (10 minutes) so navigating between
 * cards doesn't re-hit the server constantly. That's correct for those
 * consumers.
 *
 * The route guard has the OPPOSITE need — it must read the freshest
 * possible status on every mount and on every poll tick, because its job
 * is to detect status transitions (scheduled → in_progress) and redirect.
 * If it shared the cache slot with `useMatchById`, TanStack would use
 * whichever set of options was registered first — surprising and brittle.
 *
 * The fix is to give this hook its own cache key (the `'phase'` suffix on
 * `queryKeys.matches.detail(matchId)`), with its own staleTime/refetch
 * config. Realtime invalidation on `queryKeys.matches.detail(matchId)`
 * still cascades to BOTH `useMatchById` AND `useMatchPhase` via TanStack
 * v5 partial-key matching, so they both stay in sync when the matches
 * row actually changes.
 *
 * Do NOT consolidate this with `useMatchById`. The cache-key separation
 * is intentional. See the lineup → scoring transition stability plan
 * (Defense 1) for full context.
 *
 * ## Defense 7 — foreground polling
 *
 * The function-form `refetchInterval` polls every 7 seconds while
 * `status === 'scheduled'` and stops automatically when status flips
 * to anything else. This is the realtime-drop backstop: a captain whose
 * websocket missed the prep_match notification still discovers the
 * status flip within ~10 seconds and follows the redirect. No retry
 * counter, no failure surface — just a backstop refetch loop.
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import { STALE_TIME } from '@/api/client';
import { getMatchPhase, type MatchPhase } from '@/api/queries/matches';

export type { MatchPhase };

/**
 * Hook to read the match's phase (status + started_at + id).
 *
 * @param matchId - Match's primary key. Hook is disabled if null/undefined.
 * @returns TanStack query result for `MatchPhase`.
 */
export function useMatchPhase(matchId: string | null | undefined) {
  return useQuery({
    // Distinct cache key from useMatchById — see file header for why.
    queryKey: [...queryKeys.matches.detail(matchId || ''), 'phase'],
    queryFn: () => getMatchPhase(matchId!),
    enabled: !!matchId,
    staleTime: STALE_TIME.MATCH_LIVE,
    refetchOnMount: 'always',
    retry: 1,
    // Defense 7 — foreground polling backstop for dropped realtime ticks.
    // While status='scheduled' (lineup phase, waiting for prep_match), poll
    // every 7s. The moment status flips, the function returns false and
    // polling stops automatically.
    refetchInterval: (query) =>
      query.state.data?.status === 'scheduled' ? 7000 : false,
  });
}
