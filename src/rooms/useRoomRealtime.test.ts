/**
 * @fileoverview Tests for the Game Room realtime hook.
 *
 * `@/supabaseClient` is a controllable fake channel (the useMatchRealtime
 * harness): tests inspect the bindings the hook registered, fire their
 * handlers with fake payloads, and drive `.subscribe` status callbacks. A real
 * QueryClient sits underneath so invalidation is observed on the cache, not
 * on a mock.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';

const mocks = vi.hoisted(() => {
  type SubscribeCb = (status: REALTIME_SUBSCRIBE_STATES, err?: Error) => void;
  type Binding = { table: string; filter: string; handler: (payload: unknown) => void };

  const state = { bindings: [] as Binding[], subscribeCb: null as SubscribeCb | null };

  const channelMock = {
    on: vi.fn((_type: string, cfg: { table: string; filter: string }, handler: Binding['handler']) => {
      state.bindings.push({ table: cfg.table, filter: cfg.filter, handler });
      return channelMock;
    }),
    subscribe: vi.fn((cb: SubscribeCb) => {
      state.subscribeCb = cb;
      return channelMock;
    }),
  };
  const supabaseMock = {
    channel: vi.fn(() => {
      state.bindings = [];
      return channelMock;
    }),
    removeChannel: vi.fn(),
  };
  return { state, channelMock, supabaseMock };
});

vi.mock('@/supabaseClient', () => ({ supabase: mocks.supabaseMock }));
vi.mock('@/utils/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { useRoomRealtime, HIDDEN_RELEASE_MS } from './useRoomRealtime';
import { queryKeys } from '@/api/queryKeys';

const ROOM = 'room-1';
let client: QueryClient;
let invalidate: ReturnType<typeof vi.spyOn>;

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client }, children);
}

function binding(table: string) {
  const b = mocks.state.bindings.find((x) => x.table === table);
  if (!b) throw new Error(`no binding for ${table}`);
  return b;
}

function fireRow(table: string, eventType: 'INSERT' | 'UPDATE' | 'DELETE', oldRow: object, newRow: object) {
  // Block bodies, not expression arrows: a handler returns the invalidate
  // promise, and a returned promise turns act() async and leaks its scope.
  act(() => {
    binding(table).handler({ eventType, old: oldRow, new: newRow });
  });
}

const fireStatus = (status: REALTIME_SUBSCRIBE_STATES, err?: Error) =>
  act(() => {
    mocks.state.subscribeCb!(status, err);
  });

const render = (props = { roomId: ROOM, shared: true, tables: ['room_coin_flips'] }) =>
  renderHook((p: typeof props) => useRoomRealtime(p), { wrapper, initialProps: props });

beforeEach(() => {
  mocks.channelMock.on.mockClear();
  mocks.channelMock.subscribe.mockClear();
  mocks.supabaseMock.channel.mockClear();
  mocks.supabaseMock.removeChannel.mockClear();
  mocks.state.bindings = [];
  mocks.state.subscribeCb = null;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  invalidate = vi.spyOn(client, 'invalidateQueries');
});

describe('useRoomRealtime — bindings', () => {
  it('binds rooms, room_phones and each listed table with room filters', () => {
    render();
    expect(mocks.supabaseMock.channel).toHaveBeenCalledWith(`room:${ROOM}`);
    expect(mocks.state.bindings).toHaveLength(3);
    expect(binding('rooms').filter).toBe(`id=eq.${ROOM}`);
    expect(binding('room_phones').filter).toBe(`room_id=eq.${ROOM}`);
    expect(binding('room_coin_flips').filter).toBe(`room_id=eq.${ROOM}`);
  });

  it('shared=false opens no channel and reports live', () => {
    const { result } = render({ roomId: ROOM, shared: false, tables: ['room_coin_flips'] });
    expect(mocks.supabaseMock.channel).not.toHaveBeenCalled();
    expect(result.current.connectionStatus).toBe('live');
  });

  it('unmount removes the channel exactly once', () => {
    const { unmount } = render();
    unmount();
    expect(mocks.supabaseMock.removeChannel).toHaveBeenCalledTimes(1);
    expect(mocks.supabaseMock.removeChannel).toHaveBeenCalledWith(mocks.channelMock);
  });
});

describe('useRoomRealtime — row events', () => {
  it('an INSERT on a listed table invalidates only that table key', () => {
    render();
    fireRow('room_coin_flips', 'INSERT', {}, { id: 'f1', room_id: ROOM });
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.rooms.table(ROOM, 'room_coin_flips') });
  });

  it('room_phones: INSERT invalidates detail; heartbeat-only UPDATE is dropped; a name change invalidates', () => {
    render();
    const phone = { id: 'p1', room_id: ROOM, display_name: 'Ed', last_seen_at: 't1' };

    fireRow('room_phones', 'INSERT', {}, phone);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenLastCalledWith({ queryKey: queryKeys.rooms.detail(ROOM), exact: true });

    fireRow('room_phones', 'UPDATE', phone, { ...phone, last_seen_at: 't2' });
    expect(invalidate).toHaveBeenCalledTimes(1);

    fireRow('room_phones', 'UPDATE', phone, { ...phone, display_name: 'Eddie' });
    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  it('rooms: last_activity_at-only UPDATE is dropped; a settings change invalidates detail exactly', () => {
    render();
    const room = { id: ROOM, settings: { race: 5 }, last_activity_at: 't1' };

    fireRow('rooms', 'UPDATE', room, { ...room, last_activity_at: 't2' });
    expect(invalidate).not.toHaveBeenCalled();

    fireRow('rooms', 'UPDATE', room, { ...room, settings: { race: 7 } });
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenLastCalledWith({ queryKey: queryKeys.rooms.detail(ROOM), exact: true });
  });

  it('a rooms DELETE sets roomGone', () => {
    const { result } = render();
    expect(result.current.roomGone).toBe(false);
    fireRow('rooms', 'DELETE', { id: ROOM }, {});
    expect(result.current.roomGone).toBe(true);
  });
});

describe('useRoomRealtime — table list changes', () => {
  it('a new table list removes the old channel, drops the old table cache, and subscribes anew', () => {
    const oldKey = queryKeys.rooms.table(ROOM, 'room_coin_flips');
    client.setQueryData(oldKey, [{ id: 'stale' }]);

    const { rerender } = render();
    rerender({ roomId: ROOM, shared: true, tables: ['room_races'] });

    expect(mocks.supabaseMock.removeChannel).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(oldKey)).toBeUndefined();
    expect(mocks.supabaseMock.channel).toHaveBeenCalledTimes(2);
    expect(mocks.state.bindings.map((b) => b.table)).toEqual(['rooms', 'room_phones', 'room_races']);
  });

  it('a re-render with the same tables (new array identity) does not rebuild', () => {
    const { rerender } = render();
    rerender({ roomId: ROOM, shared: true, tables: ['room_coin_flips'] });
    expect(mocks.supabaseMock.channel).toHaveBeenCalledTimes(1);
    expect(mocks.supabaseMock.removeChannel).not.toHaveBeenCalled();
  });
});

describe('useRoomRealtime — subscribe status', () => {
  it('every SUBSCRIBED — the first and one after a CLOSED — invalidates the detail prefix', () => {
    const { result } = render();
    const prefix = { queryKey: queryKeys.rooms.detail(ROOM) };

    fireStatus(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
    expect(result.current.connectionStatus).toBe('live');
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenLastCalledWith(prefix);

    fireStatus(REALTIME_SUBSCRIBE_STATES.CLOSED);
    expect(result.current.connectionStatus).toBe('reconnecting');
    expect(invalidate).toHaveBeenCalledTimes(1);

    fireStatus(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
    expect(result.current.connectionStatus).toBe('live');
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenLastCalledWith(prefix);
  });

  it('a binding-mismatch CHANNEL_ERROR reports error and does not resubscribe', () => {
    const { result } = render();
    fireStatus(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
    fireStatus(
      REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR,
      new Error('mismatch between server and client bindings for postgres changes')
    );
    expect(result.current.connectionStatus).toBe('error');
    expect(mocks.channelMock.subscribe).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
});

describe('useRoomRealtime — hidden tab releases the socket', () => {
  function setVisibility(state: 'visible' | 'hidden') {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });
  afterEach(() => {
    setVisibility('visible');
    vi.useRealTimers();
  });

  it('hidden past the grace window → channel removed; visible again → a fresh channel that refetches on SUBSCRIBED', () => {
    const { result } = render();
    expect(mocks.supabaseMock.channel).toHaveBeenCalledTimes(1);

    setVisibility('hidden');
    act(() => vi.advanceTimersByTime(HIDDEN_RELEASE_MS - 1));
    expect(mocks.supabaseMock.removeChannel).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(mocks.supabaseMock.removeChannel).toHaveBeenCalledTimes(1);
    expect(result.current.connectionStatus).toBe('live'); // nothing to be behind on while hidden

    setVisibility('visible');
    expect(mocks.supabaseMock.channel).toHaveBeenCalledTimes(2);
    fireStatus(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
    expect(invalidate).toHaveBeenLastCalledWith({ queryKey: queryKeys.rooms.detail(ROOM) });
  });

  it('a short hide (back before the window) never touches the channel', () => {
    render();
    setVisibility('hidden');
    act(() => vi.advanceTimersByTime(HIDDEN_RELEASE_MS / 2));
    setVisibility('visible');
    act(() => vi.advanceTimersByTime(HIDDEN_RELEASE_MS * 2));
    expect(mocks.supabaseMock.removeChannel).not.toHaveBeenCalled();
    expect(mocks.supabaseMock.channel).toHaveBeenCalledTimes(1);
  });

  it('a visible tab, however idle, keeps its channel', () => {
    render();
    act(() => vi.advanceTimersByTime(HIDDEN_RELEASE_MS * 10));
    expect(mocks.supabaseMock.removeChannel).not.toHaveBeenCalled();
  });
});
