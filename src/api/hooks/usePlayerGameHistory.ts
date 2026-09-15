/**
 * @fileoverview Load the signed-in player's full rack-by-rack history.
 *
 * One fetch per visit, cached. Everything the stats page does afterwards —
 * every filter, every recount — happens over the array this returns, with no
 * further requests. That is deliberate: asking the server on each filter change
 * would put a spinner on every click, and the page is supposed to feel instant.
 *
 * @see src/stats/gameHistorySource.ts
 * @see docs/plans/2026-09-06-001-feat-my-stats-page-plan.md
 */

import { useQuery } from '@tanstack/react-query';
import { getPlayerHistory, playerHistoryKey } from '@/stats/gameHistorySource';
import type { PlayerGameRow } from '@/stats/playerGameRow';
import { useCurrentMember } from './useCurrentMember';

/**
 * How long the history stays fresh.
 *
 * Long, on purpose. A player's completed games do not change while they read
 * the page — a match finished last week cannot un-finish — so refetching on
 * every focus would spend a request to return identical rows. New results land
 * on the next visit, which is soon enough for a history page.
 */
const HISTORY_STALE_MS = 5 * 60 * 1000;

/**
 * The current player's games, newest first.
 *
 * @returns Standard query result. `data` is undefined while loading and an
 *          empty array for a player who has not played yet — the page treats
 *          those differently, so they must stay distinguishable.
 */
export function usePlayerGameHistory() {
  const { data: member } = useCurrentMember();
  const memberId = member?.id;

  return useQuery<PlayerGameRow[]>({
    queryKey: playerHistoryKey(memberId ?? 'anonymous'),
    queryFn: () => getPlayerHistory(memberId as string),
    enabled: !!memberId,
    staleTime: HISTORY_STALE_MS,
  });
}
