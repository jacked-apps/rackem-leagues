/**
 * @fileoverview Tests for the realtime survival heartbeat handler
 * (live-scoring resilience, Phase 1 / Unit 1).
 *
 * We test `handleRealtimeHeartbeat` as a pure function rather than asserting
 * against the constructed `supabase` client, because the createClient call
 * wires the same helper into `realtime.heartbeatCallback` — so verifying the
 * helper's decision logic verifies the wired behavior, without spinning up a
 * real socket/worker in happy-dom.
 */

import { describe, it, expect, vi } from 'vitest';
import { handleRealtimeHeartbeat } from './supabaseClient';

describe('handleRealtimeHeartbeat', () => {
  it("forces a reconnect when the socket is 'disconnected'", () => {
    const realtime = { connect: vi.fn() };
    const triggered = handleRealtimeHeartbeat('disconnected', realtime);
    expect(triggered).toBe(true);
    expect(realtime.connect).toHaveBeenCalledTimes(1);
  });

  it("forces a reconnect when the heartbeat 'timeout's", () => {
    const realtime = { connect: vi.fn() };
    const triggered = handleRealtimeHeartbeat('timeout', realtime);
    expect(triggered).toBe(true);
    expect(realtime.connect).toHaveBeenCalledTimes(1);
  });

  it.each(['sent', 'ok', 'error'] as const)(
    "does not reconnect on a healthy heartbeat status '%s'",
    (status) => {
      const realtime = { connect: vi.fn() };
      const triggered = handleRealtimeHeartbeat(status, realtime);
      expect(triggered).toBe(false);
      expect(realtime.connect).not.toHaveBeenCalled();
    }
  );
});
