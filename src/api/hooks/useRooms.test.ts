/**
 * @fileoverview Tests for the Game Room hooks' wiring.
 *
 * Only the wiring: enabled gates, the polling fallback (on while the room
 * exists, off once it is gone), and that writes invalidate the room prefix.
 * The RPCs are proven end-to-end in src/__tests__/database/rooms.*.db.test.ts,
 * so queries and mutations are mocked at the module boundary here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockGetRoom = vi.fn();
const mockJoinRoom = vi.fn();
vi.mock('@/api/queries/rooms', () => ({
  getRoom: (id: string) => mockGetRoom(id),
  getRoomByToken: vi.fn(),
  getMyRooms: vi.fn(),
}));
vi.mock('@/api/mutations/rooms', () => ({
  createRoom: vi.fn(),
  joinRoom: (t: string, d: string) => mockJoinRoom(t, d),
  setRoomGame: vi.fn(),
  setRoomSettings: vi.fn(),
  setRoomShared: vi.fn(),
  closeRoom: vi.fn(),
}));

import { useRoom, useJoinRoom, ROOM_POLL_MS } from './useRooms';
import { queryKeys } from '@/api/queryKeys';
import type { RoomState } from '@/api/queries/rooms';

const STATE: RoomState = {
  room: {
    id: 'r1', host_member_id: 'm1', game_key: 'coin_flip', game_tables: ['room_coin_flips'],
    settings: {}, shared: true, join_token: 'tok', last_activity_at: '', created_at: '',
  },
  seats: { devices: 1, used: 1, seats: 4, open: 3 },
  phones: [],
};

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe('useRoom', () => {
  it('does not fetch without a room id', () => {
    const { result } = renderHook(() => useRoom(undefined), { wrapper });
    expect(mockGetRoom).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches the room and polls as the realtime fallback while it exists', async () => {
    mockGetRoom.mockResolvedValue(STATE);
    const { result } = renderHook(() => useRoom('r1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(STATE);

    const q = client.getQueryCache().find({ queryKey: queryKeys.rooms.detail('r1') })!;
    const interval = (q.options as { refetchInterval: (query: typeof q) => number | false }).refetchInterval(q);
    expect(interval).toBe(ROOM_POLL_MS);
  });

  it('stops polling once the room is gone (null)', async () => {
    mockGetRoom.mockResolvedValue(null);
    const { result } = renderHook(() => useRoom('r1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();

    const q = client.getQueryCache().find({ queryKey: queryKeys.rooms.detail('r1') })!;
    const interval = (q.options as { refetchInterval: (query: typeof q) => number | false }).refetchInterval(q);
    expect(interval).toBe(false);
  });
});

describe('useJoinRoom', () => {
  it('on success invalidates the joined room (the prefix of every table key)', async () => {
    mockJoinRoom.mockResolvedValue({ ok: true, room_id: 'r1', phone_id: 'p1', rejoined: false });
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useJoinRoom(), { wrapper });

    await result.current.mutateAsync({ joinToken: 'tok', deviceId: 'dev' });
    expect(mockJoinRoom).toHaveBeenCalledWith('tok', 'dev');
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.rooms.detail('r1') });
  });

  it('a refusal is returned as data, not thrown, and invalidates nothing', async () => {
    mockJoinRoom.mockResolvedValue({ ok: false, reason: 'full' });
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useJoinRoom(), { wrapper });

    const r = await result.current.mutateAsync({ joinToken: 'tok', deviceId: 'dev' });
    expect(r).toEqual({ ok: false, reason: 'full' });
    expect(spy).not.toHaveBeenCalled();
  });
});
