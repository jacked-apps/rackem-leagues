/**
 * @fileoverview Tests for useMatchRealtime's connection-status + catch-up
 * layer (live-scoring resilience, Phase 1 / Unit 2).
 *
 * Two layers are tested:
 *
 *  1. `classifySubscribeEvent` — the pure state machine that maps a
 *     `REALTIME_SUBSCRIBE_STATES` callback into a coarse UI status plus the
 *     "is a catch-up refetch owed?" decision. Tested directly (mirrors
 *     `computePhaseRefetchInterval`) so the core logic is verifiable without a
 *     socket.
 *
 *  2. The hook itself, with `@/supabaseClient` mocked to a controllable fake
 *     channel. We capture the `.subscribe` callback and drive status sequences
 *     to assert the catch-up refetch fires exactly once on a true re-SUBSCRIBED,
 *     never on the first subscribe, and that a StrictMode-style remount
 *     re-establishes cleanly without a spurious catch-up.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Mock the Supabase client with a controllable fake channel. `vi.hoisted` lets
// the factory below reference these before the module under test imports them.
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => {
  let subscribeCallback:
    | ((status: REALTIME_SUBSCRIBE_STATES, err?: Error) => void)
    | null = null;

  const channelMock: any = {
    on: vi.fn(() => channelMock),
    subscribe: vi.fn((cb: any) => {
      subscribeCallback = cb;
      return channelMock;
    }),
  };

  const supabaseMock = {
    channel: vi.fn(() => channelMock),
    removeChannel: vi.fn(),
  };

  return {
    channelMock,
    supabaseMock,
    fireRaw: (status: REALTIME_SUBSCRIBE_STATES, err?: Error) => {
      if (!subscribeCallback) throw new Error('subscribe callback not captured');
      subscribeCallback(status, err);
    },
  };
});

vi.mock('@/supabaseClient', () => ({ supabase: mocks.supabaseMock }));

import {
  useMatchRealtime,
  classifySubscribeEvent,
  isBindingMismatch,
} from './useMatchRealtime';

const FRESH = { hasSubscribed: false, reconnecting: false };

describe('classifySubscribeEvent', () => {
  it('first SUBSCRIBED → live, no catch-up', () => {
    const r = classifySubscribeEvent(
      REALTIME_SUBSCRIBE_STATES.SUBSCRIBED,
      undefined,
      FRESH
    );
    expect(r.status).toBe('live');
    expect(r.catchUp).toBe(false);
    expect(r.next).toEqual({ hasSubscribed: true, reconnecting: false });
  });

  it('CLOSED after a live subscribe → reconnecting, arms catch-up', () => {
    const r = classifySubscribeEvent(REALTIME_SUBSCRIBE_STATES.CLOSED, undefined, {
      hasSubscribed: true,
      reconnecting: false,
    });
    expect(r.status).toBe('reconnecting');
    expect(r.catchUp).toBe(false);
    expect(r.next).toEqual({ hasSubscribed: true, reconnecting: true });
  });

  it('TIMED_OUT → reconnecting, arms catch-up', () => {
    const r = classifySubscribeEvent(
      REALTIME_SUBSCRIBE_STATES.TIMED_OUT,
      undefined,
      { hasSubscribed: true, reconnecting: false }
    );
    expect(r.status).toBe('reconnecting');
    expect(r.next.reconnecting).toBe(true);
  });

  it('re-SUBSCRIBED after a drop → live AND catch-up owed', () => {
    const r = classifySubscribeEvent(
      REALTIME_SUBSCRIBE_STATES.SUBSCRIBED,
      undefined,
      { hasSubscribed: true, reconnecting: true }
    );
    expect(r.status).toBe('live');
    expect(r.catchUp).toBe(true);
    expect(r.next).toEqual({ hasSubscribed: true, reconnecting: false });
  });

  it('full drop sequence CHANNEL_ERROR→CLOSED→TIMED_OUT→SUBSCRIBED catches up exactly once', () => {
    let flags = { hasSubscribed: true, reconnecting: false };
    const seen: boolean[] = [];
    for (const s of [
      REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR,
      REALTIME_SUBSCRIBE_STATES.CLOSED,
      REALTIME_SUBSCRIBE_STATES.TIMED_OUT,
      REALTIME_SUBSCRIBE_STATES.SUBSCRIBED,
    ]) {
      const r = classifySubscribeEvent(s, undefined, flags);
      flags = r.next;
      seen.push(r.catchUp);
    }
    expect(seen).toEqual([false, false, false, true]);
  });

  it('rapid duplicate CLOSED callbacks never arm a second catch-up', () => {
    let flags = { hasSubscribed: true, reconnecting: false };
    classifySubscribeEvent(REALTIME_SUBSCRIBE_STATES.CLOSED, undefined, flags);
    // Three closes in a row, then one subscribe.
    for (let i = 0; i < 3; i++) {
      flags = classifySubscribeEvent(
        REALTIME_SUBSCRIBE_STATES.CLOSED,
        undefined,
        flags
      ).next;
    }
    const sub = classifySubscribeEvent(
      REALTIME_SUBSCRIBE_STATES.SUBSCRIBED,
      undefined,
      flags
    );
    expect(sub.catchUp).toBe(true); // one catch-up, not three
  });

  it('binding-mismatch CHANNEL_ERROR → error status, never reconnecting/catch-up', () => {
    const err = new Error(
      'mismatch between server and client bindings for postgres changes'
    );
    const r = classifySubscribeEvent(
      REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR,
      err,
      { hasSubscribed: true, reconnecting: false }
    );
    expect(r.status).toBe('error');
    expect(r.catchUp).toBe(false);
    expect(r.next.reconnecting).toBe(false);
  });

  it('a subsequent SUBSCRIBED after a terminal error does NOT catch up', () => {
    const err = new Error('mismatch between server and client bindings');
    const afterError = classifySubscribeEvent(
      REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR,
      err,
      { hasSubscribed: true, reconnecting: false }
    );
    const sub = classifySubscribeEvent(
      REALTIME_SUBSCRIBE_STATES.SUBSCRIBED,
      undefined,
      afterError.next
    );
    expect(sub.catchUp).toBe(false);
  });
});

describe('isBindingMismatch', () => {
  it('matches the realtime-js bindings-mismatch message (case-insensitive)', () => {
    expect(
      isBindingMismatch(
        new Error('mismatch between server and client bindings for postgres changes')
      )
    ).toBe(true);
    expect(
      isBindingMismatch(new Error('MISMATCH BETWEEN SERVER AND CLIENT'))
    ).toBe(true);
  });

  it('does not match a generic transient error or undefined', () => {
    expect(isBindingMismatch(new Error('timeout'))).toBe(false);
    expect(isBindingMismatch(undefined)).toBe(false);
  });
});

/** Fire a subscribe status inside act() so the hook's setState flushes. */
const fire = (status: REALTIME_SUBSCRIBE_STATES, err?: Error) =>
  act(() => mocks.fireRaw(status, err));

describe('useMatchRealtime (hook integration)', () => {
  beforeEach(() => {
    mocks.channelMock.on.mockClear();
    mocks.channelMock.subscribe.mockClear();
    mocks.supabaseMock.channel.mockClear();
    mocks.supabaseMock.removeChannel.mockClear();
  });

  it('first SUBSCRIBED → status live, no catch-up refetch', () => {
    const onMatchUpdate = vi.fn();
    const onLineupUpdate = vi.fn();
    const onGamesUpdate = vi.fn();

    const { result } = renderHook(() =>
      useMatchRealtime('match-1', { onMatchUpdate, onLineupUpdate, onGamesUpdate })
    );

    fire(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);

    expect(result.current.connectionStatus).toBe('live');
    expect(onMatchUpdate).not.toHaveBeenCalled();
    expect(onLineupUpdate).not.toHaveBeenCalled();
    expect(onGamesUpdate).not.toHaveBeenCalled();
  });

  it('drop then re-SUBSCRIBED fires a catch-up refetch on all three callbacks exactly once', () => {
    const onMatchUpdate = vi.fn();
    const onLineupUpdate = vi.fn();
    const onGamesUpdate = vi.fn();

    const { result } = renderHook(() =>
      useMatchRealtime('match-1', { onMatchUpdate, onLineupUpdate, onGamesUpdate })
    );

    fire(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED); // first connect
    fire(REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR);
    fire(REALTIME_SUBSCRIBE_STATES.CLOSED);
    expect(result.current.connectionStatus).toBe('reconnecting');

    fire(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED); // re-subscribe

    expect(result.current.connectionStatus).toBe('live');
    expect(onMatchUpdate).toHaveBeenCalledTimes(1);
    expect(onLineupUpdate).toHaveBeenCalledTimes(1);
    expect(onGamesUpdate).toHaveBeenCalledTimes(1);
  });

  it('binding-mismatch CHANNEL_ERROR surfaces error status and no refetch storm', () => {
    const onGamesUpdate = vi.fn();
    const { result } = renderHook(() =>
      useMatchRealtime('match-1', { onGamesUpdate })
    );

    fire(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
    fire(
      REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR,
      new Error('mismatch between server and client bindings for postgres changes')
    );

    expect(result.current.connectionStatus).toBe('error');
    expect(onGamesUpdate).not.toHaveBeenCalled();
  });

  it('remount (StrictMode-style) removes the channel and re-subscribes without a spurious catch-up', () => {
    const onGamesUpdate = vi.fn();
    const { unmount } = renderHook(() =>
      useMatchRealtime('match-1', { onGamesUpdate })
    );

    fire(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
    expect(mocks.supabaseMock.channel).toHaveBeenCalledTimes(1);

    // Unmount tears the channel down.
    unmount();
    expect(mocks.supabaseMock.removeChannel).toHaveBeenCalledTimes(1);

    // Remount: a brand-new subscription. Its first SUBSCRIBED must NOT be
    // treated as a re-subscribe-after-drop, so no catch-up refetch fires.
    renderHook(() => useMatchRealtime('match-1', { onGamesUpdate }));
    expect(mocks.supabaseMock.channel).toHaveBeenCalledTimes(2);

    fire(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
    expect(onGamesUpdate).not.toHaveBeenCalled();
  });

  it('cleans up the channel on unmount', () => {
    const { unmount } = renderHook(() =>
      useMatchRealtime('match-1', { onGamesUpdate: vi.fn() })
    );
    unmount();
    expect(mocks.supabaseMock.removeChannel).toHaveBeenCalledTimes(1);
  });
});
