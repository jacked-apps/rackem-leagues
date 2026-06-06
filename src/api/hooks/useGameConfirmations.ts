/**
 * @fileoverview Game confirmations query hook (many-eyes Layer-2).
 *
 * Fetches the append-only `game_confirmations` rows for a match — the
 * who-vouched-for-what witness records. This hook OWNS the confirmations fetch;
 * `useMatchScoring` consumes it and wires the realtime invalidation, rather than
 * defining a parallel query (single source of truth for this data).
 *
 * Live-scoring fresh-data config mirrors `useMatchGames`: staleTime 0 +
 * refetchOnMount/Reconnect so a churn remount or a reconnect never serves stale
 * witness data to the (Phase 2) per-person prompt / dissent flag.
 *
 * Phase 1 wires the fetch + realtime catch-up; Phase 2 (per-person prompt,
 * dissent flag) and Phase 3 (tap-to-peek) consume the returned rows.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { queryKeys } from '@/api/queryKeys';
import { STALE_TIME } from '@/api/client';
import type { Database } from '@/types/database.types';

/** A single witness record (a vouch or a vacate marker) for a game. */
export type GameConfirmation =
  Database['public']['Tables']['game_confirmations']['Row'];

/**
 * Fetch all confirmations for a match, oldest first (chronological — the order
 * the dissent/history derivation reasons about).
 */
async function getGameConfirmations(
  matchId: string
): Promise<GameConfirmation[]> {
  const { data, error } = await supabase
    .from('game_confirmations')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Hook to fetch the many-eyes confirmations for a match.
 *
 * @param matchId - Match's primary key ID
 * @returns TanStack Query result with the array of confirmation rows
 */
export function useGameConfirmations(matchId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.matches.confirmations(matchId || ''),
    queryFn: () => getGameConfirmations(matchId!),
    enabled: !!matchId,
    staleTime: STALE_TIME.MATCH_LIVE, // 0ms — live witness data
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    retry: 1,
  });
}
