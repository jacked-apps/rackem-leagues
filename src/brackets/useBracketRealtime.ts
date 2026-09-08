/**
 * @fileoverview Realtime subscription for a live bracket (Unit 5).
 *
 * Subscribes to changes on this bracket's matches (and the bracket row itself)
 * and invalidates the corresponding TanStack Query cache, so a winner tapped on
 * one device shows up live on every viewer. Filtered by bracket_id — the tables
 * carry REPLICA IDENTITY FULL (migration 20260904160417) so filtered UPDATE
 * events include bracket_id. Mirrors useMessagingRealtime.
 *
 * State is data-derived (the renderer recomputes from the fetched rows), so a
 * missed event only delays an update; it never corrupts the view.
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';

/**
 * Keep a bracket's cached detail fresh via realtime.
 *
 * @param bracketId the bracket to watch
 * @param invalidateKey the query key to invalidate on any change (organizer
 *   detail key, or the public share key for the read-only view)
 * @param watchHopper also watch the candidate/official list. Off by default
 *   because a live bracket's matches are the only thing that moves; ON for the
 *   setup screen and the player's view, where the whole point is watching
 *   players arrive one at a time.
 */
export function useBracketRealtime(
  bracketId: string | undefined,
  invalidateKey: readonly unknown[],
  watchHopper = false
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!bracketId) return;

    const invalidate = () =>
      queryClient.invalidateQueries({ queryKey: invalidateKey });

    const channel = supabase
      .channel(`bracket:${bracketId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bracket_matches',
          filter: `bracket_id=eq.${bracketId}`,
        },
        invalidate
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'brackets',
          filter: `id=eq.${bracketId}`,
        },
        invalidate
      );

    if (watchHopper) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bracket_hopper',
          filter: `bracket_id=eq.${bracketId}`,
        },
        invalidate
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // invalidateKey is a stable tuple from queryKeys.*; stringify to compare.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bracketId, queryClient, watchHopper, JSON.stringify(invalidateKey)]);
}
