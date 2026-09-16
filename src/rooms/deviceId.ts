/**
 * @fileoverview The device id — what a seat in a Game Room is keyed on.
 *
 * A seat is a DEVICE because Supabase bills per connected socket, and every
 * browser opens its own. So each browser mints itself one id, once, and keeps
 * it in localStorage: a refresh or a second tab is the same device, a tablet
 * is a new one. The id means nothing outside the room tables and carries no
 * identity — the member behind it is always resolved server-side.
 *
 * Storage can be unavailable (private mode, blocked site data). Then we still
 * hand back a stable id for THIS page load, so the room works — the person
 * just gets a fresh seat on the next reload, which the grace window absorbs.
 */

const KEY = 'game-room:device-id';

/** The id minted for this page load when storage is unavailable. */
let sessionFallback: string | null = null;

function mint(): string {
  return crypto.randomUUID();
}

/** This browser's device id — minted on first call, stable afterwards. */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const fresh = mint();
    localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    if (!sessionFallback) sessionFallback = mint();
    return sessionFallback;
  }
}
