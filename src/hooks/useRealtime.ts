/**
 * @fileoverview useRealtime Hook
 *
 * Generic hook for Supabase real-time subscriptions.
 * Handles subscription lifecycle and cleanup automatically.
 *
 * Usage:
 * ```tsx
 * // Subscribe to INSERT events on messages table
 * useRealtime({
 *   channelName: 'messages-channel',
 *   table: 'messages',
 *   event: 'INSERT',
 *   filter: `conversation_id=eq.${conversationId}`,
 *   onEvent: (payload) => {
 *     console.log('New message:', payload.new);
 *   }
 * });
 * ```
 *
 * @param options - Subscription configuration
 * @param options.channelName - Unique name for this channel
 * @param options.table - Database table to subscribe to
 * @param options.event - Event type ('INSERT' | 'UPDATE' | 'DELETE' | '*')
 * @param options.filter - Optional Supabase filter (e.g., 'user_id=eq.123')
 * @param options.onEvent - Callback fired when event occurs
 * @param options.schema - Database schema (defaults to 'public')
 * @param options.enabled - Whether subscription is active (defaults to true)
 */

import { useEffect } from 'react';
import { supabase } from '@/supabaseClient';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type PostgresEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseRealtimeOptions {
  /** Unique channel name (must be unique per subscription) */
  channelName: string;
  /** Database table to subscribe to */
  table: string;
  /** Event type to listen for */
  event: PostgresEvent;
  /** Optional Supabase filter string */
  filter?: string;
  /** Callback fired when event occurs */
  onEvent: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void | Promise<void>;
  /** Database schema (defaults to 'public') */
  schema?: string;
  /** Whether subscription is enabled (defaults to true) */
  enabled?: boolean;
}

export function useRealtime({
  channelName,
  table,
  event,
  filter,
  onEvent,
  schema = 'public',
  enabled = true,
}: UseRealtimeOptions) {
  useEffect(() => {
    // Don't subscribe if disabled
    if (!enabled) return;

    // Create subscription channel
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          // supabase-js overloads .on() per event literal; our event is a union
          // of those literals, so present it as the catch-all overload ('*').
          event: event as '*',
          schema,
          table,
          ...(filter && { filter }),
        },
        onEvent
      )
      .subscribe();

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName, table, event, filter, schema, enabled, onEvent]);
}
