/**
 * @fileoverview "Let go of the socket when nobody is looking" — shared by every
 * realtime hook that must not hold a connection for a backgrounded tab.
 *
 * Phones already lose their socket when the OS suspends a hidden tab. This
 * makes a backgrounded desktop tab behave the same: once the tab has been
 * hidden for `afterMs`, the hook reports `true`, and the caller tears its
 * channel down. Visible again → `false`, the caller re-subscribes, and its
 * SUBSCRIBED handler refetches whatever it missed (realtime never replays).
 *
 * A visible screen, however idle, is never released.
 *
 * Used by the Game Room channel (`useRoomRealtime`) and the race channel
 * (`useRaceRealtime`), so a room race releases both together.
 */
import { useEffect, useState } from 'react';

/**
 * How long a tab may stay hidden before its socket is released. Matches the
 * server's presence grace (`room_presence_grace()`, 2 min): the moment this
 * device reads as "away" is the moment it stops holding a connection.
 */
export const HIDDEN_RELEASE_MS = 120_000;

/**
 * True once the tab has been hidden for `afterMs`; false again the moment it
 * is visible.
 *
 * @param afterMs - How long hidden counts as gone (usually `HIDDEN_RELEASE_MS`).
 * @returns Whether the caller should drop its channel right now.
 *
 * @example
 * const released = useHiddenRelease(HIDDEN_RELEASE_MS);
 * useEffect(() => { if (released) return; ...subscribe... }, [released]);
 */
export function useHiddenRelease(afterMs: number): boolean {
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
