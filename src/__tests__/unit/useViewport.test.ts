/**
 * @fileoverview Tests for useViewport hook
 *
 * Covers the 640px Tailwind `sm` breakpoint, reactivity to `matchMedia`
 * change events, and listener cleanup on unmount. Tests override the
 * default test-setup matchMedia stub to drive controlled scenarios.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useViewport } from '@/hooks/useViewport';

type ChangeListener = (event: MediaQueryListEvent) => void;

/**
 * Test helper: replace `window.matchMedia` with a controllable stub.
 * Returns a handle that lets the test flip `matches` and fire the
 * change event, plus inspect the registered listener set.
 */
function mockMatchMedia(initialMatches: boolean) {
  const listeners = new Set<ChangeListener>();
  const mql = {
    matches: initialMatches,
    media: '',
    addEventListener: vi.fn((_event: string, listener: ChangeListener) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_event: string, listener: ChangeListener) => {
      listeners.delete(listener);
    }),
  };

  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
    mql.media = query;
    return mql as unknown as MediaQueryList;
  });

  return {
    setMatches(matches: boolean) {
      mql.matches = matches;
      const event = { matches, media: mql.media } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
    listeners,
    mql,
  };
}

describe('useViewport', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns isMobile=true when matchMedia reports a match', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useViewport());
    expect(result.current.isMobile).toBe(true);
  });

  it('returns isMobile=false when matchMedia reports no match', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useViewport());
    expect(result.current.isMobile).toBe(false);
  });

  it('queries the Tailwind sm boundary (max-width: 639px)', () => {
    const m = mockMatchMedia(false);
    renderHook(() => useViewport());
    expect(m.mql.media).toBe('(max-width: 639px)');
  });

  it('updates isMobile when a matchMedia change event fires', () => {
    const m = mockMatchMedia(false);
    const { result } = renderHook(() => useViewport());
    expect(result.current.isMobile).toBe(false);

    act(() => {
      m.setMatches(true);
    });

    expect(result.current.isMobile).toBe(true);
  });

  it('flips back when the change event reports a non-match', () => {
    const m = mockMatchMedia(true);
    const { result } = renderHook(() => useViewport());
    expect(result.current.isMobile).toBe(true);

    act(() => {
      m.setMatches(false);
    });

    expect(result.current.isMobile).toBe(false);
  });

  it('removes the change listener on unmount (no leak)', () => {
    const m = mockMatchMedia(false);
    const { unmount } = renderHook(() => useViewport());
    expect(m.listeners.size).toBe(1);

    unmount();

    expect(m.listeners.size).toBe(0);
  });
});
