/**
 * @fileoverview Supabase client configuration and initialization
 * Central configuration for all Supabase database and authentication operations
 *
 * ## Realtime survival config (live-scoring resilience, Phase 1 / Unit 1)
 *
 * Live match scoring rides on Supabase realtime. On a pool-hall phone the
 * scoring screen is frequently backgrounded (the scorer checks a text, the
 * screen locks), and mobile browsers aggressively throttle background timers.
 * The realtime heartbeat is a plain `setInterval` by default, so a throttled
 * background tab can silently miss heartbeats and let the socket die without
 * anyone noticing until a manual refresh.
 *
 * Two settings harden this without rebuilding anything the client already does
 * (the client already reconnects the socket and auto-rejoins channels with
 * backoff — we only close the gaps it leaves):
 *
 * - `worker: true` runs the 25s heartbeat in a Web Worker (an inline Blob
 *   worker — no external script is fetched), which browsers do NOT throttle
 *   when the tab is backgrounded. A backgrounded phone keeps its heartbeat
 *   alive instead of silently dropping. Worker failures are caught internally
 *   by realtime-js (the worker terminates, the socket keeps running), so this
 *   can never crash live scoring. We only enable it when Web Workers actually
 *   exist (see `supportsWebWorker` below) because realtime-js *throws
 *   synchronously inside `createClient`* if `worker: true` and `window.Worker`
 *   is missing — and this client is imported app-wide at module load, so an
 *   unguarded throw would crash the entire app on startup in any browser or
 *   webview without Worker support. When absent, we fall back to the normal
 *   heartbeat (still alive, just throttleable when backgrounded).
 * - `heartbeatCallback` forces an idempotent `realtime.connect()` the moment
 *   the heartbeat reports the socket is `'disconnected'` or `'timeout'`, so a
 *   dead socket re-establishes without waiting for a user action. It is
 *   registered unconditionally, so the reconnect nudge works with or without
 *   the worker.
 */
import { createClient } from '@supabase/supabase-js';

/**
 * Heartbeat status values realtime-js passes to `heartbeatCallback`.
 *
 * Mirrors realtime-js's internal `HeartbeatStatus` type, which the package
 * does not re-export. Declared locally (structurally identical, so the
 * callback stays assignable) so we don't depend on a non-public export.
 */
type HeartbeatStatus = 'sent' | 'ok' | 'error' | 'timeout' | 'disconnected';

// Retrieve Supabase connection details from environment variables
// These should be set in .env file and are injected at build time by Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Minimal slice of the realtime client this module needs to nudge a
 * reconnect. Kept narrow so `handleRealtimeHeartbeat` is trivially testable
 * without constructing a real `RealtimeClient`.
 */
interface RealtimeReconnector {
  connect: () => void;
}

/**
 * Heartbeat handler: force a reconnect when the socket is reported dead.
 *
 * realtime-js fires this callback every heartbeat tick with the socket's
 * status. `'disconnected'` (socket not connected when a heartbeat was due) and
 * `'timeout'` (no heartbeat ack in time) both mean the live connection is gone.
 * In those cases we call `connect()`, which is idempotent — it no-ops if the
 * client is already connecting/connected, so calling it on every bad tick is
 * safe and simply shortens the window before the socket comes back.
 *
 * Healthy statuses (`'sent'`, `'ok'`, `'error'`) are left alone; realtime-js
 * already handles transient `'error'` acks and its own backoff reconnect.
 *
 * @param status - Heartbeat status from realtime-js.
 * @param realtime - The realtime client (or any object exposing `connect()`).
 * @returns `true` if a reconnect was triggered, otherwise `false`. The return
 *   value exists for tests; callers ignore it.
 */
export function handleRealtimeHeartbeat(
  status: HeartbeatStatus,
  realtime: RealtimeReconnector
): boolean {
  if (status === 'disconnected' || status === 'timeout') {
    realtime.connect();
    return true;
  }
  return false;
}

/**
 * Whether this environment can run a Web Worker. realtime-js throws inside
 * `createClient` if `worker: true` and `window.Worker` is missing, so we gate
 * the option on actual support. Covers happy-dom test env (no Worker) and the
 * rare worker-less browser/webview alike — both fall back to the standard
 * heartbeat instead of crashing the app at import time.
 */
const supportsWebWorker =
  typeof window !== 'undefined' && typeof window.Worker !== 'undefined';

/**
 * Configured Supabase client instance
 *
 * This client provides access to:
 * - Authentication (supabase.auth)
 * - Database operations (supabase.from())
 * - Real-time subscriptions
 * - Storage operations
 *
 * Import this instance throughout the app for all Supabase operations
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    // Run the heartbeat in a (background-throttle-immune) Web Worker when the
    // platform supports one; otherwise fall back to the normal heartbeat.
    worker: supportsWebWorker,
    // `supabase` is fully assigned by the time any heartbeat fires, so
    // referencing it lazily inside the callback is safe (no TDZ at call time).
    heartbeatCallback: (status: HeartbeatStatus) =>
      handleRealtimeHeartbeat(status, supabase.realtime),
  },
});
