/**
 * @fileoverview Connection-health classification + polling-fallback cadence
 * (live-scoring resilience, Phase 1 / Unit 3).
 *
 * `useMatchRealtime` (Unit 2) reports a coarse *realtime* status: is the
 * realtime channel live, reconnecting, or in a terminal error? But realtime
 * health is independent of whether the server is reachable at all — the socket
 * can be down while plain PostgREST requests still work (so scoring can keep
 * flowing via polling), OR the whole phone can be offline (nothing works,
 * show a calm note and wait).
 *
 * This hook turns the realtime status into an actionable *health*:
 *
 *   - `live`         — realtime is healthy; do nothing.
 *   - `realtime-down`— realtime is down but the server is reachable; poll as a
 *                      fallback so scoring stays in sync.
 *   - `offline`      — the server is unreachable / the device is offline;
 *                      there is nothing to poll, just wait (and reassure).
 *
 * Classification is realtime-signal-*triggered*, never timer-polled: when
 * realtime reports trouble we fire ONE cheap reachability probe to tell
 * realtime-down from offline, and we react to the browser's `online`/`offline`
 * events. We do not poll a health endpoint on a timer.
 */

import { useEffect, useRef, useState } from 'react';
import type { RealtimeConnectionStatus } from './useMatchRealtime';

/** Actionable connection health derived from realtime status + reachability. */
export type ConnectionHealth = 'live' | 'realtime-down' | 'offline';

/** Polling cadence (ms) for the degraded scoring fallback. */
export const DEGRADED_POLL_MS = 5000;

/**
 * Pure mapping from realtime status + reachability signals to health.
 *
 * Bias: assume *recoverable* until there's evidence otherwise. While realtime
 * is degraded but we have not yet learned the probe result (`probeReachable`
 * is `null`), we report `realtime-down` so the polling fallback starts
 * immediately; we only downgrade to `offline` on real evidence (the browser
 * says offline, or the probe failed).
 *
 * @param realtimeStatus - Coarse realtime status from `useMatchRealtime`.
 * @param probeReachable - Probe result: `true` reachable, `false` unreachable,
 *   `null` not yet probed.
 * @param online - `navigator.onLine` (a hint; corroborated by the probe).
 */
export function classifyHealth(
  realtimeStatus: RealtimeConnectionStatus,
  probeReachable: boolean | null,
  online: boolean
): ConnectionHealth {
  if (realtimeStatus === 'live') return 'live';
  if (!online) return 'offline';
  if (probeReachable === false) return 'offline';
  // Reachable, or not yet probed → assume a realtime-only outage and poll.
  return 'realtime-down';
}

/**
 * Pure cadence decision for the degraded polling fallback.
 *
 * Polls ONLY when realtime is down but the server is reachable AND a match is
 * actively in progress. `live` needs no poll (realtime handles it); `offline`
 * has nothing reachable to poll (wait for the network instead); a non-live
 * match status is not being scored.
 *
 * Mirrors `computePhaseRefetchInterval` so the cadence contract is testable
 * without mounting anything.
 *
 * @param health - Current connection health.
 * @param matchStatus - The match row's status.
 * @returns Poll interval in ms, or `false` to not poll.
 */
export function computeDegradedPollInterval(
  health: ConnectionHealth,
  matchStatus: string | null | undefined
): number | false {
  if (matchStatus !== 'in_progress') return false;
  if (health === 'realtime-down') return DEGRADED_POLL_MS;
  return false;
}

/**
 * Default reachability probe: a single cheap HEAD to the PostgREST root.
 *
 * Any HTTP response (even a 401/404) proves the server is reachable; only a
 * thrown network error means unreachable. Short-circuits on `navigator.onLine
 * === false`. If the Supabase URL is unavailable we assume reachable rather
 * than false-alarm offline.
 */
async function defaultReachabilityProbe(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) return true;
  try {
    await fetch(`${url}/rest/v1/`, {
      method: 'HEAD',
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '' },
    });
    return true;
  } catch {
    return false;
  }
}

/** Options for `useConnectionHealth` (probe override is for tests). */
interface UseConnectionHealthOptions {
  /** Override the reachability probe (tests inject a deterministic one). */
  probe?: () => Promise<boolean>;
}

/**
 * Derive actionable connection health from the realtime status.
 *
 * @param realtimeStatus - Coarse realtime status from `useMatchRealtime`.
 * @param options - Optional probe override.
 * @returns `{ health, isDegraded }`.
 */
export function useConnectionHealth(
  realtimeStatus: RealtimeConnectionStatus,
  options: UseConnectionHealthOptions = {}
): { health: ConnectionHealth; isDegraded: boolean } {
  const probe = options.probe ?? defaultReachabilityProbe;

  // `null` = not yet probed this degradation episode.
  const [probeReachable, setProbeReachable] = useState<boolean | null>(null);
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // One probe per degradation episode. Reset when realtime returns to live so
  // the next outage re-probes fresh.
  const probedRef = useRef(false);

  useEffect(() => {
    if (realtimeStatus === 'live') {
      probedRef.current = false;
      setProbeReachable(null);
      return;
    }
    if (probedRef.current) return;
    probedRef.current = true;

    let cancelled = false;
    probe()
      .then((reachable) => {
        if (!cancelled) setProbeReachable(reachable);
      })
      .catch(() => {
        if (!cancelled) setProbeReachable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [realtimeStatus, probe]);

  // Track the browser's online/offline events (a hint, corroborated by probe).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const health = classifyHealth(realtimeStatus, probeReachable, online);
  return { health, isDegraded: health !== 'live' };
}
