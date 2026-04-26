/**
 * @fileoverview useLongPress Hook
 *
 * Detects long-press gestures via pointer events. Designed for inline
 * name components nested inside clickable parents (buttons, accordion
 * headers) where the parent owns the primary tap action and the inline
 * element offers a secondary "press and hold" affordance.
 *
 * Behavior:
 * - Short tap (`pointerdown` -> `pointerup` before the threshold):
 *   timer is cleared, no callback fires, the parent's `click` event
 *   fires normally.
 * - Long press (held past `thresholdMs`): callback fires AND the next
 *   `click` event is swallowed by the `onClickCapture` handler so the
 *   parent's primary action does NOT also fire.
 * - Pointer move past `movementCancelPx`: cancels the pending timer.
 *
 * **Why `onClickCapture`:** `pointerdown.stopPropagation()` does NOT
 * prevent the synthesized `click` event that follows. Only intercepting
 * the subsequent `click` event reliably suppresses the parent's click
 * handler cross-browser (iOS Safari + Android Chrome).
 *
 * Usage:
 *   const handlers = useLongPress(() => openPopover());
 *   return <span {...handlers}>Mike J</span>;
 *
 * @param callback - Invoked when the press is held past `thresholdMs`.
 * @param options.thresholdMs - Hold duration that fires the callback. Default 600ms.
 * @param options.movementCancelPx - Pointer move distance that cancels the hold. Default 10px.
 * @param options.disabled - When true, returns no-op handlers (gesture suppressed entirely).
 * @returns Pointer event handlers to spread onto the target element.
 */

import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';

export interface UseLongPressOptions {
  thresholdMs?: number;
  movementCancelPx?: number;
  disabled?: boolean;
}

export interface UseLongPressHandlers {
  onPointerDown: (event: ReactPointerEvent) => void;
  onPointerUp: (event: ReactPointerEvent) => void;
  onPointerCancel: (event: ReactPointerEvent) => void;
  onPointerMove: (event: ReactPointerEvent) => void;
  onClickCapture: (event: ReactMouseEvent) => void;
}

const NOOP_HANDLERS: UseLongPressHandlers = {
  onPointerDown: () => {},
  onPointerUp: () => {},
  onPointerCancel: () => {},
  onPointerMove: () => {},
  onClickCapture: () => {},
};

export function useLongPress(
  callback: () => void,
  options: UseLongPressOptions = {},
): UseLongPressHandlers {
  const { thresholdMs = 600, movementCancelPx = 10, disabled = false } = options;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef<boolean>(false);

  // Clean up any pending timer if the component unmounts mid-hold.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (disabled) return NOOP_HANDLERS;

  const clearPendingTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  };

  return {
    onPointerDown: (event) => {
      startRef.current = { x: event.clientX, y: event.clientY };
      timerRef.current = setTimeout(() => {
        callback();
        suppressClickRef.current = true;
        timerRef.current = null;
      }, thresholdMs);
    },
    onPointerUp: () => {
      clearPendingTimer();
    },
    onPointerCancel: () => {
      clearPendingTimer();
    },
    onPointerMove: (event) => {
      if (!startRef.current || !timerRef.current) return;
      const dx = event.clientX - startRef.current.x;
      const dy = event.clientY - startRef.current.y;
      if (Math.hypot(dx, dy) > movementCancelPx) {
        clearPendingTimer();
      }
    },
    onClickCapture: (event) => {
      if (suppressClickRef.current) {
        event.preventDefault();
        event.stopPropagation();
        suppressClickRef.current = false;
      }
    },
  };
}
