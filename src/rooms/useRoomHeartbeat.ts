/**
 * @fileoverview "This device is still here." — the Game Room heartbeat.
 *
 * While a room screen is open, this device tells the server so every
 * HEARTBEAT_MS. That is what keeps the device "present" (its seat), and what
 * keeps the ROOM alive against the idle sweep — the room owns its own
 * activity signal, so games contribute nothing to it and a free room with no
 * realtime channel is never swept mid-play.
 *
 * A hidden tab stops beating (a sleeping phone keeps its seat for the grace
 * window, which is the whole point of the grace window) and beats once the
 * moment it is visible again. A failed beat is logged and ignored: the next
 * one is 30 seconds away, and a missed audit of "still here" is not an error
 * anyone needs to see.
 */
import { useEffect, useRef } from 'react';
import { roomHeartbeat } from '@/api/mutations/rooms';
import { logger } from '@/utils/logger';

/** How often a visible room screen beats. A dial. */
export const HEARTBEAT_MS = 30_000;

/**
 * Beat for `roomId` on `deviceId` while `enabled`.
 *
 * @param roomId   The room this device is in (undefined = nothing to beat for).
 * @param deviceId This browser's device id (see `deviceId.ts`).
 * @param enabled  False while the page has not joined yet, or after leaving.
 */
export function useRoomHeartbeat(
  roomId: string | undefined,
  deviceId: string,
  enabled: boolean
): void {
  // The beat reads the latest ids without being a dependency of the interval.
  const idsRef = useRef({ roomId, deviceId });
  idsRef.current = { roomId, deviceId };

  useEffect(() => {
    if (!enabled || !roomId) return;

    const beat = () => {
      const { roomId: r, deviceId: d } = idsRef.current;
      if (!r) return;
      roomHeartbeat(r, d).catch((err) =>
        logger.debug('[room] heartbeat failed (ignored)', { roomId: r, err: String(err) })
      );
    };

    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      beat();
      timer = setInterval(beat, HEARTBEAT_MS);
    };
    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };

    // Beat only while visible; the grace window covers the gap.
    const onVisibility = () => (document.visibilityState === 'hidden' ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);
    if (document.visibilityState !== 'hidden') start();

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [roomId, enabled]);
}
