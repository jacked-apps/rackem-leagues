/**
 * @fileoverview Live updates for a tiebreak record — Unit 3 of
 * docs/plans/2026-10-28-001-feat-tiebreaker-record-plan.md.
 *
 * One side's tiebreak picks and lock must reach the other side's phone, the
 * same way match_lineups changes do. This is its OWN channel rather than more
 * bindings on useMatchRealtime's `match_${id}` channel, because:
 * - match_tiebreaker_lineups carries no match_id, so it can only be filtered
 *   by tiebreaker_id — known only once the record exists. Adding that to the
 *   main channel would tear down and rebuild the scoring page's live
 *   connection when the record appears.
 * - The tiebreak flow is short-lived; keeping it separate leaves the main
 *   channel (and its reconnect/catch-up logic) exactly as it was.
 *
 * Every event just invalidates the record query; the query refetches.
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { queryKeys } from '@/api/queryKeys';
import { logger } from '@/utils/logger';

/**
 * Subscribe to changes on one tiebreak record and its lineups.
 *
 * @param matchId - The match (for the cache key)
 * @param tiebreakerId - The record; nothing is subscribed until it is known
 */
export function useTiebreakerRealtime(
  matchId: string | null | undefined,
  tiebreakerId: string | null | undefined,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!matchId || !tiebreakerId) return;
    const refresh = () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.tiebreaker(matchId) });

    const channel = supabase
      .channel(`tiebreaker_${tiebreakerId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_tiebreaker_lineups', filter: `tiebreaker_id=eq.${tiebreakerId}` },
        refresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_tiebreakers', filter: `id=eq.${tiebreakerId}` },
        refresh,
      )
      .subscribe((status) => {
        // Realtime does not replay rows missed while disconnected, so refetch
        // whenever the channel (re)connects.
        if (status === 'SUBSCRIBED') void refresh();
        else logger.debug('[useTiebreakerRealtime] channel status', { tiebreakerId, status });
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, tiebreakerId, queryClient]);
}
