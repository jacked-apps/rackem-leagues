/**
 * @fileoverview Tests for the race channel: it catches up on EVERY SUBSCRIBED
 * (first and after a hidden release) and lets go of the socket when the tab is
 * hidden past `HIDDEN_RELEASE_MS`, the same rule as the Game Room channel.
 *
 * `@/supabaseClient` is a controllable fake channel (the useRoomRealtime
 * harness). A real QueryClient sits underneath, seeded with the race's three
 * queries, so "refetched" is observed as invalidated cache entries.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mocks = vi.hoisted(() => {
  const state = { subscribeCb: null as ((status: string) => void) | null, tables: [] as string[] };
  const channelMock = {
    on: vi.fn((_t: string, cfg: { table: string }) => {
      state.tables.push(cfg.table);
      return channelMock;
    }),
    subscribe: vi.fn((cb: (status: string) => void) => {
      state.subscribeCb = cb;
      return channelMock;
    }),
  };
  const supabaseMock = {
    channel: vi.fn(() => {
      state.tables = [];
      return channelMock;
    }),
    removeChannel: vi.fn(),
  };
  return { state, channelMock, supabaseMock };
});
vi.mock('@/supabaseClient', () => ({ supabase: mocks.supabaseMock }));
vi.mock('@/utils/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { useRaceRealtime } from '../useRaceData';
import { HIDDEN_RELEASE_MS } from '@/realtime/useHiddenRelease';
import { queryKeys } from '@/api/queryKeys';

const RACE = 'race-1';
const KEYS = [queryKeys.races.detail(RACE), queryKeys.races.games(RACE), queryKeys.races.confirmations(RACE)];
let client: QueryClient;

const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
const render = () => renderHook(() => useRaceRealtime(RACE), { wrapper });

/** Seed all three queries as fresh, so an invalidation is visible. */
const seed = () => KEYS.forEach((k) => client.setQueryData(k, []));
const allInvalidated = () => KEYS.every((k) => client.getQueryState(k)?.isInvalidated === true);
const fireStatus = (status: string) =>
  act(() => {
    mocks.state.subscribeCb!(status);
  });
function setVisibility(v: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: v, configurable: true });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  mocks.supabaseMock.channel.mockClear();
  mocks.supabaseMock.removeChannel.mockClear();
  mocks.state.subscribeCb = null;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  setVisibility('visible');
  vi.useRealTimers();
});

describe('useRaceRealtime', () => {
  it('binds the three race tables on its own race:<id> channel', () => {
    render();
    expect(mocks.supabaseMock.channel).toHaveBeenCalledWith(`race:${RACE}`);
    expect(mocks.state.tables).toEqual(['races', 'race_games', 'race_confirmations']);
  });

  it('the first SUBSCRIBED refetches the race, its games and its confirmations', () => {
    render();
    seed();
    expect(allInvalidated()).toBe(false);
    fireStatus('SUBSCRIBED');
    expect(allInvalidated()).toBe(true);
  });

  it('an unhealthy status does not refetch', () => {
    render();
    seed();
    fireStatus('CHANNEL_ERROR');
    expect(allInvalidated()).toBe(false);
  });

  it('hidden past the window → channel released; back → a new channel that catches up on SUBSCRIBED', () => {
    render();
    setVisibility('hidden');
    act(() => vi.advanceTimersByTime(HIDDEN_RELEASE_MS));
    expect(mocks.supabaseMock.removeChannel).toHaveBeenCalledTimes(1);

    setVisibility('visible');
    expect(mocks.supabaseMock.channel).toHaveBeenCalledTimes(2);
    seed();
    fireStatus('SUBSCRIBED');
    expect(allInvalidated()).toBe(true);
  });

  it('a short hide never touches the channel', () => {
    render();
    setVisibility('hidden');
    act(() => vi.advanceTimersByTime(HIDDEN_RELEASE_MS / 2));
    setVisibility('visible');
    expect(mocks.supabaseMock.removeChannel).not.toHaveBeenCalled();
    expect(mocks.supabaseMock.channel).toHaveBeenCalledTimes(1);
  });
});
