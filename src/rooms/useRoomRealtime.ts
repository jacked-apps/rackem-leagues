/**
 * @fileoverview One realtime channel per device, over the room's table list.
 *
 * The room row names the tables its current game uses (`game_tables`). This
 * hook listens to the room row, the room's devices, and each listed table —
 * all filtered by this room — and pokes ONE query key per table
 * (`queryKeys.rooms.table(roomId, table)`), so a game plugs in by keying its
 * queries with that helper and never touches the channel.
 *
 * What it will NOT do:
 * - Open a socket for a free (`shared=false`) room. One phone, nothing to
 *   hear; status reads `live` because there is nothing to be behind on.
 * - Refetch on a heartbeat. `room_phones.last_seen_at` / `rooms.last_activity_at`
 *   -only UPDATEs are dropped (see `roomChangeFilter.ts`).
 * - Hold a socket for a hidden tab. After `HIDDEN_RELEASE_MS` hidden (the
 *   same 2 min as the server's presence grace) the channel is released and
 *   reopened on return — a backgrounded desktop tab behaves like a phone
 *   whose OS suspended it. A visible screen, however idle, is never touched.
 * - Replay. Realtime never delivers rows missed while the socket was down, so
 *   EVERY SUBSCRIBED — the first included — invalidates the `rooms.detail`
 *   prefix (the room and every table). A rebuild is a normal in-game move here
 *   (the host switches games), so the first-subscribe gap is real, not
 *   theoretical, and one refetch of tables this small is nothing.
 *
 * Phones live INSIDE `rooms.detail` (the `room_state` RPC returns room + seats
 * + phones), so a `room_phones` event invalidates that key exactly, like the
 * room row does. Game tables are invalidated by their own key only.
 *
 * Supabase channels cannot change bindings live, so the subscribe effect keys
 * on the table list: a new list tears down, drops the OLD tables' cached rows
 * (a switch A→B→A must never flash pre-wipe rows), and rebuilds.
 */
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/supabaseClient';
import { queryKeys } from '@/api/queryKeys';
import { logger } from '@/utils/logger';
import {
  classifySubscribeEvent,
  type RealtimeConnectionStatus,
} from '@/realtime/useMatchRealtime';
import { HEARTBEAT_COLUMNS, onlyIgnoredColumnsChanged } from './roomChangeFilter';

type Row = Record<string, unknown>;
type ChangePayload = RealtimePostgresChangesPayload<Row>;

/**
 * How long a tab may stay hidden before its socket is released. Matches the
 * server's presence grace (`room_presence_grace()`, 2 min): the moment this
 * device reads as "away" is the moment it stops holding a connection.
 */
export const HIDDEN_RELEASE_MS = 120_000;

interface UseRoomRealtimeParams {
  /** The room this device is in (undefined = nothing to listen to). */
  roomId: string | undefined;
  /** Free rooms have one phone and no channel. */
  shared: boolean;
  /** The room row's `game_tables` — the current game's tables. */
  tables: readonly string[];
}

interface UseRoomRealtimeResult {
  /** `live` | `reconnecting` | `error` — text for the header, never colour alone. */
  connectionStatus: RealtimeConnectionStatus;
  /**
   * The room row was DELETED while we were listening (host closed it, or the
   * sweep took it). The fast path only: a phone that was asleep learns the
   * same thing when `getRoom` comes back null. The page renders "ended" on
   * either signal.
   */
  roomGone: boolean;
}

/** Is this UPDATE only the heartbeat moving? Non-UPDATEs never are. */
function isHeartbeatOnly(payload: ChangePayload, table: string): boolean {
  if (payload.eventType !== 'UPDATE') return false;
  return onlyIgnoredColumnsChanged(
    payload.old as Row,
    payload.new as Row,
    HEARTBEAT_COLUMNS[table] ?? []
  );
}

/**
 * Keep this device's view of `roomId` live.
 *
 * @example
 * const { connectionStatus, roomGone } = useRoomRealtime({
 *   roomId: room.id, shared: room.shared, tables: room.game_tables,
 * });
 */
export function useRoomRealtime({
  roomId,
  shared,
  tables,
}: UseRoomRealtimeParams): UseRoomRealtimeResult {
  const queryClient = useQueryClient();
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>('live');
  const [roomGone, setRoomGone] = useState(false);

  // Arrays are rebuilt every render; the string is what the effect keys on.
  const tablesKey = tables.join(',');
  const prevRef = useRef<{ roomId: string | undefined; tablesKey: string } | null>(null);

  // A new room is a fresh start: it has not been deleted under us yet.
  useEffect(() => setRoomGone(false), [roomId]);

  // Tab hidden past the grace window → let go of the socket. Phones already
  // lose it (the OS suspends the tab); this makes a backgrounded desktop tab
  // behave the same instead of holding a connection for up to the 24 h sweep.
  // Coming back re-subscribes, and every SUBSCRIBED refetches, so the return
  // is seamless. Never fires for a visible screen, however idle.
  const released = useHiddenRelease(HIDDEN_RELEASE_MS);

  useEffect(() => {
    // Game switch (same room, new table list): drop the old tables' cached
    // rows so the new game never flashes what the server already wiped. Runs
    // for free rooms too — the wipe is a data concern, not a socket one.
    const prev = prevRef.current;
    if (roomId && prev && prev.roomId === roomId && prev.tablesKey !== tablesKey) {
      const keep = new Set(tables);
      for (const table of prev.tablesKey.split(',').filter(Boolean)) {
        if (!keep.has(table)) {
          queryClient.removeQueries({ queryKey: queryKeys.rooms.table(roomId, table) });
        }
      }
    }
    prevRef.current = { roomId, tablesKey };

    if (!roomId || !shared || released) {
      setConnectionStatus('live');
      return;
    }

    const detailKey = queryKeys.rooms.detail(roomId);
    const invalidateDetail = () =>
      queryClient.invalidateQueries({ queryKey: detailKey, exact: true });

    // Per-subscription flags for the status classifier; reset per channel so
    // a remount is a fresh handshake, not a "reconnect".
    let flags = { hasSubscribed: false, reconnecting: false };

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload: ChangePayload) => {
          if (payload.eventType === 'DELETE') {
            setRoomGone(true);
            invalidateDetail();
            return;
          }
          if (!isHeartbeatOnly(payload, 'rooms')) invalidateDetail();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_phones', filter: `room_id=eq.${roomId}` },
        (payload: ChangePayload) => {
          if (!isHeartbeatOnly(payload, 'room_phones')) invalidateDetail();
        }
      );

    for (const table of tables) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `room_id=eq.${roomId}` },
        () => queryClient.invalidateQueries({ queryKey: queryKeys.rooms.table(roomId, table) })
      );
    }

    channel.subscribe((status, err) => {
      const result = classifySubscribeEvent(status, err, flags);
      flags = result.next;
      setConnectionStatus(result.status);
      logger.debug('[room] channel status', { roomId, status, error: err?.message });

      // Every SUBSCRIBED, not just re-subscribes after a drop — see @fileoverview.
      if (result.status === 'live') {
        queryClient.invalidateQueries({ queryKey: detailKey });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
    // `tables` is represented by `tablesKey`; the array identity is noise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, shared, tablesKey, queryClient, released]);

  return { connectionStatus, roomGone };
}

/**
 * True once the tab has been hidden for `afterMs`; false again the moment it
 * is visible. A visible tab — however idle — never counts.
 */
function useHiddenRelease(afterMs: number): boolean {
  const [released, setReleased] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const arm = () => {
      if (timer) return;
      timer = setTimeout(() => setReleased(true), afterMs);
    };
    const disarm = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      setReleased(false);
    };
    const onVisibility = () => (document.visibilityState === 'hidden' ? arm() : disarm());

    document.addEventListener('visibilitychange', onVisibility);
    if (document.visibilityState === 'hidden') arm();
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (timer) clearTimeout(timer);
    };
  }, [afterMs]);

  return released;
}
