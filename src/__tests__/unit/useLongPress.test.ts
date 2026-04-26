/**
 * @fileoverview Tests for useLongPress hook
 *
 * Covers the core gesture state machine: timer firing past threshold,
 * cancellation on early release / movement / disable, and the critical
 * click-suppression regression test that prevents the parent's click
 * handler from firing after a successful long-press (the
 * scoring-button accountability scenario).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useLongPress } from '@/hooks/useLongPress';

describe('useLongPress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makePointerEvent(overrides: { clientX?: number; clientY?: number } = {}): ReactPointerEvent {
    return {
      clientX: overrides.clientX ?? 0,
      clientY: overrides.clientY ?? 0,
    } as ReactPointerEvent;
  }

  function makeClickEvent() {
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    return {
      event: { preventDefault, stopPropagation } as unknown as ReactMouseEvent,
      preventDefault,
      stopPropagation,
    };
  }

  it('fires the callback after the 600ms default threshold elapses', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useLongPress(callback));

    act(() => {
      result.current.onPointerDown(makePointerEvent());
      vi.advanceTimersByTime(600);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not fire when released at 599ms (one tick under threshold)', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useLongPress(callback));

    act(() => {
      result.current.onPointerDown(makePointerEvent());
      vi.advanceTimersByTime(599);
      result.current.onPointerUp(makePointerEvent());
      vi.advanceTimersByTime(100);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('a 100ms tap does not fire the callback and does not suppress the parent click', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useLongPress(callback));
    const click = makeClickEvent();

    act(() => {
      result.current.onPointerDown(makePointerEvent());
      vi.advanceTimersByTime(100);
      result.current.onPointerUp(makePointerEvent());
      result.current.onClickCapture(click.event);
    });

    expect(callback).not.toHaveBeenCalled();
    expect(click.preventDefault).not.toHaveBeenCalled();
    expect(click.stopPropagation).not.toHaveBeenCalled();
  });

  it('SCORING REGRESSION: after a long-press fires, the next click is swallowed (parent does NOT fire)', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useLongPress(callback));
    const click = makeClickEvent();

    act(() => {
      result.current.onPointerDown(makePointerEvent());
      vi.advanceTimersByTime(600);
      result.current.onPointerUp(makePointerEvent());
      result.current.onClickCapture(click.event);
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(click.preventDefault).toHaveBeenCalledTimes(1);
    expect(click.stopPropagation).toHaveBeenCalledTimes(1);
  });

  it('the suppression flag resets after a single use (next click goes through)', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useLongPress(callback));

    // First press: long-press fires + first click is swallowed.
    const firstClick = makeClickEvent();
    act(() => {
      result.current.onPointerDown(makePointerEvent());
      vi.advanceTimersByTime(600);
      result.current.onPointerUp(makePointerEvent());
      result.current.onClickCapture(firstClick.event);
    });
    expect(firstClick.stopPropagation).toHaveBeenCalledTimes(1);

    // Second press: short tap, click should NOT be swallowed.
    const secondClick = makeClickEvent();
    act(() => {
      result.current.onPointerDown(makePointerEvent());
      vi.advanceTimersByTime(100);
      result.current.onPointerUp(makePointerEvent());
      result.current.onClickCapture(secondClick.event);
    });
    expect(secondClick.stopPropagation).not.toHaveBeenCalled();
  });

  it('movement greater than 10px cancels the pending timer', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useLongPress(callback));

    act(() => {
      result.current.onPointerDown(makePointerEvent({ clientX: 0, clientY: 0 }));
      result.current.onPointerMove(makePointerEvent({ clientX: 15, clientY: 0 }));
      vi.advanceTimersByTime(600);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('movement of 5px in each axis (under 10px hypot) does not cancel', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useLongPress(callback));

    act(() => {
      result.current.onPointerDown(makePointerEvent({ clientX: 0, clientY: 0 }));
      result.current.onPointerMove(makePointerEvent({ clientX: 5, clientY: 5 }));
      vi.advanceTimersByTime(600);
    });

    // hypot(5,5) ~= 7.07 < 10
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('disabled=true returns no-op handlers (long-press never fires)', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useLongPress(callback, { disabled: true }));

    act(() => {
      result.current.onPointerDown(makePointerEvent());
      vi.advanceTimersByTime(700);
      result.current.onPointerUp(makePointerEvent());
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('clears the timer on unmount (no callback fires after unmount)', () => {
    const callback = vi.fn();
    const { result, unmount } = renderHook(() => useLongPress(callback));

    act(() => {
      result.current.onPointerDown(makePointerEvent());
      vi.advanceTimersByTime(300);
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('honors a custom thresholdMs option', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useLongPress(callback, { thresholdMs: 1000 }));

    act(() => {
      result.current.onPointerDown(makePointerEvent());
      vi.advanceTimersByTime(600);
    });
    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('honors a custom movementCancelPx option', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useLongPress(callback, { movementCancelPx: 50 }));

    act(() => {
      result.current.onPointerDown(makePointerEvent({ clientX: 0, clientY: 0 }));
      result.current.onPointerMove(makePointerEvent({ clientX: 30, clientY: 0 }));
      vi.advanceTimersByTime(600);
    });

    // 30px is under the 50px custom threshold; should fire.
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
