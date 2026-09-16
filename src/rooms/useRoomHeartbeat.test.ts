/**
 * @fileoverview Tests for the Game Room heartbeat hook.
 *
 * Pins: beats on mount then every HEARTBEAT_MS while enabled; stops on
 * unmount; does nothing while disabled or without a room; pauses while the
 * tab is hidden and beats immediately on return; a failing beat is swallowed
 * and the interval keeps going.
 *
 * The RPC wrapper is mocked at the module boundary — the RPC itself is proven
 * in src/__tests__/database/rooms.join.db.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockHeartbeat = vi.fn();
vi.mock('@/api/mutations/rooms', () => ({
  roomHeartbeat: (roomId: string, deviceId: string) => mockHeartbeat(roomId, deviceId),
}));
vi.mock('@/utils/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { useRoomHeartbeat, HEARTBEAT_MS } from './useRoomHeartbeat';

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.useFakeTimers();
  mockHeartbeat.mockReset().mockResolvedValue({ ok: true });
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useRoomHeartbeat', () => {
  it('beats on mount and then every HEARTBEAT_MS; stops on unmount', () => {
    const { unmount } = renderHook(() => useRoomHeartbeat('room-1', 'dev-1', true));
    expect(mockHeartbeat).toHaveBeenCalledTimes(1);
    expect(mockHeartbeat).toHaveBeenCalledWith('room-1', 'dev-1');

    act(() => vi.advanceTimersByTime(HEARTBEAT_MS * 2));
    expect(mockHeartbeat).toHaveBeenCalledTimes(3);

    unmount();
    act(() => vi.advanceTimersByTime(HEARTBEAT_MS * 5));
    expect(mockHeartbeat).toHaveBeenCalledTimes(3);
  });

  it('does nothing while disabled or without a room', () => {
    renderHook(() => useRoomHeartbeat('room-1', 'dev-1', false));
    renderHook(() => useRoomHeartbeat(undefined, 'dev-1', true));
    act(() => vi.advanceTimersByTime(HEARTBEAT_MS * 3));
    expect(mockHeartbeat).not.toHaveBeenCalled();
  });

  it('pauses while the tab is hidden and beats immediately when it is visible again', () => {
    renderHook(() => useRoomHeartbeat('room-1', 'dev-1', true));
    expect(mockHeartbeat).toHaveBeenCalledTimes(1);

    act(() => setVisibility('hidden'));
    act(() => vi.advanceTimersByTime(HEARTBEAT_MS * 4));
    expect(mockHeartbeat).toHaveBeenCalledTimes(1);

    act(() => setVisibility('visible'));
    expect(mockHeartbeat).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(HEARTBEAT_MS));
    expect(mockHeartbeat).toHaveBeenCalledTimes(3);
  });

  it('a failing beat is swallowed and the interval keeps going', async () => {
    mockHeartbeat.mockRejectedValueOnce(new Error('network'));
    renderHook(() => useRoomHeartbeat('room-1', 'dev-1', true));
    await act(async () => {
      await Promise.resolve();
    });
    act(() => vi.advanceTimersByTime(HEARTBEAT_MS));
    expect(mockHeartbeat).toHaveBeenCalledTimes(2);
  });
});
