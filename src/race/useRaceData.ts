/**
 * @fileoverview Fetches the three tables a race is made of, and keeps them
 * fresh while two people are scoring against each other.
 *
 * Live-scoring config mirrors the league's (`useMatchGames` /
 * `useGameConfirmations`): staleTime 0 plus refetch on mount and reconnect, so
 * a remount or a dropped connection never serves a stale score to the phone
 * that is about to confirm it.
 *
 * Realtime is an ACCELERANT, not the source of truth. Every screen re-derives
 * from the fetched rows, so a missed message delays agreement rather than
 * losing it. Bad bar wifi is the ambient condition here, not an edge case.
 */

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { queryKeys } from '@/api/queryKeys';
import { STALE_TIME } from '@/api/client';
import { logger } from '@/utils/logger';
import type { Race, RaceGame, RaceConfirmation } from './types';

const LIVE = {
  staleTime: STALE_TIME.MATCH_LIVE,
  refetchOnMount: true as const,
  refetchOnReconnect: true as const,
};

/** The race row itself — players, goals, break rule, status. */
export function useRace(raceId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.races.detail(raceId || ''),
    queryFn: async (): Promise<Race> => {
      const { data, error } = await supabase
        .from('races')
        .select('*')
        .eq('id', raceId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!raceId,
    ...LIVE,
  });
}

/** The games played so far, in order. Game order is the race's spine. */
export function useRaceGames(raceId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.races.games(raceId || ''),
    queryFn: async (): Promise<RaceGame[]> => {
      const { data, error } = await supabase
        .from('race_games')
        .select('*')
        .eq('race_id', raceId!)
        .order('game_number', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!raceId,
    ...LIVE,
  });
}

/** Every vouch and vacate marker, oldest first — the order dissent reasons in. */
export function useRaceConfirmations(raceId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.races.confirmations(raceId || ''),
    queryFn: async (): Promise<RaceConfirmation[]> => {
      const { data, error } = await supabase
        .from('race_confirmations')
        .select('*')
        .eq('race_id', raceId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!raceId,
    ...LIVE,
  });
}

/**
 * Subscribe to the three race tables and refetch on any change.
 *
 * Deliberately blunt: any event on this race invalidates all three queries.
 * The payload is never trusted or merged, because a merged payload is how two
 * phones end up believing different things — the whole failure this layer
 * exists to prevent. Refetching costs one round trip and is always right.
 */
export function useRaceRealtime(raceId: string | null | undefined): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!raceId) return;

    const refetch = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.races.detail(raceId) });
    };

    const channel = supabase
      .channel(`race:${raceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'races', filter: `id=eq.${raceId}` }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'race_games', filter: `race_id=eq.${raceId}` }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'race_confirmations', filter: `race_id=eq.${raceId}` }, refetch)
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Not fatal: the queries refetch on mount and reconnect anyway, so a
          // dead channel degrades to "slower", never to "wrong".
          logger.warn('[race] realtime channel unhealthy', { raceId, status });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [raceId, queryClient]);
}
