/**
 * @fileoverview Hook for the tiebreak record of a match.
 *
 * The record's existence — and its lineups' own lock flags — are what the
 * tiebreak flow now keys off, instead of the match lineups being unlocked
 * (docs/plans/2026-10-28-001-feat-tiebreaker-record-plan.md, Unit 2).
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { STALE_TIME } from '../client';
import { getMatchTiebreaker } from '../queries/tiebreakers';

/**
 * Fetch a match's tiebreak record (null when the match has none).
 *
 * Live data, like the match lineups: always fresh on mount and reconnect, so a
 * screen never decides tiebreak mode from a stale cache.
 *
 * @param matchId - The match
 * @returns TanStack Query result; `data` is the record or null
 *
 * @example
 * const { data: tiebreaker } = useMatchTiebreaker(matchId);
 * const tiebreakUnderWay = !!tiebreaker && !tiebreaker.resolved_at;
 */
export function useMatchTiebreaker(matchId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.matches.tiebreaker(matchId || ''),
    queryFn: () => getMatchTiebreaker(matchId!),
    enabled: !!matchId,
    staleTime: STALE_TIME.MATCH_LIVE,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    retry: 1,
  });
}
