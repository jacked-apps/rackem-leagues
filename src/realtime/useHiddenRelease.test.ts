/**
 * @fileoverview Tests for the shared hidden-tab release: hidden past the
 * window → released; visible again → reset; a short hide never counts.
 * The room's own realtime tests (useRoomRealtime.test.ts) prove the room
 * still releases the same way through this hook.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { HIDDEN_RELEASE_MS, useHiddenRelease } from './useHiddenRelease';

/** Flip the tab's visibility and tell listeners, as the browser would. */
function setVisibility(v: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: v, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useHiddenRelease', () => {
  it('is 2 minutes — the server presence grace', () => {
    expect(HIDDEN_RELEASE_MS).toBe(120_000);
  });

  it('hidden past the window → released; visible again → reset', () => {
    const { result } = renderHook(() => useHiddenRelease(HIDDEN_RELEASE_MS));
    expect(result.current).toBe(false);

    act(() => setVisibility('hidden'));
    act(() => vi.advanceTimersByTime(HIDDEN_RELEASE_MS - 1));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);

    act(() => setVisibility('visible'));
    expect(result.current).toBe(false);
  });

  it('a short hide never counts, and its timer does not carry over', () => {
    const { result } = renderHook(() => useHiddenRelease(HIDDEN_RELEASE_MS));
    act(() => setVisibility('hidden'));
    act(() => vi.advanceTimersByTime(HIDDEN_RELEASE_MS / 2));
    act(() => setVisibility('visible'));
    act(() => vi.advanceTimersByTime(HIDDEN_RELEASE_MS * 2));
    expect(result.current).toBe(false);
  });

  it('a tab that mounts hidden starts the clock straight away', () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    const { result } = renderHook(() => useHiddenRelease(HIDDEN_RELEASE_MS));
    act(() => vi.advanceTimersByTime(HIDDEN_RELEASE_MS));
    expect(result.current).toBe(true);
  });
});
