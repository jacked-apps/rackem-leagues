/**
 * @fileoverview Tests for `useScoringParticipationModes`.
 *
 * The hook's value is its CONSEQUENCE-SCALED PERSISTENCE, which has the only
 * non-obvious logic in the scoring-participation-modes feature:
 *   - Auto-Confirm survives a refresh but resets the moment you leave the page
 *     — implemented as a deferred clear-on-unmount that a remount cancels, so
 *     React StrictMode's dev mount→unmount→mount can't wipe it.
 *   - I'm-Not-Scoring lasts the whole match (it must NOT clear on leave).
 *   - The two modes are mutually exclusive.
 *
 * Fake timers drive the deferred-clear macrotask deterministically; storage is
 * reset per test so match-keying assertions can't bleed across cases. happy-dom
 * supplies session/localStorage.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScoringParticipationModes } from '@/hooks/useScoringParticipationModes';

const AUTO_KEY = 'scoring:autoConfirm:m1';
const NOT_KEY = 'scoring:notScoring:m1';

describe('useScoringParticipationModes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    // Drain any clear the auto-cleanup unmount scheduled, then go back to real
    // timers — so a pending macrotask can't fire mid-next-test.
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('starts with both modes off when nothing is stored', () => {
    const { result } = renderHook(() => useScoringParticipationModes('m1'));
    expect(result.current.autoConfirm).toBe(false);
    expect(result.current.notScoring).toBe(false);
  });

  it('persists Auto-Confirm to sessionStorage and reads it back on a fresh mount (survives refresh)', () => {
    const first = renderHook(() => useScoringParticipationModes('m1'));
    act(() => first.result.current.setAutoConfirm(true));
    expect(sessionStorage.getItem(AUTO_KEY)).toBe('true');

    // A "refresh" = a brand-new hook instance reading storage at init. No
    // unmount happened (the page reloaded), so the value is still there.
    const afterRefresh = renderHook(() => useScoringParticipationModes('m1'));
    expect(afterRefresh.result.current.autoConfirm).toBe(true);
  });

  it('persists I\'m-Not-Scoring to localStorage and reads it back on a fresh mount (lasts the match)', () => {
    const first = renderHook(() => useScoringParticipationModes('m1'));
    act(() => first.result.current.setNotScoring(true));
    expect(localStorage.getItem(NOT_KEY)).toBe('true');

    const remount = renderHook(() => useScoringParticipationModes('m1'));
    expect(remount.result.current.notScoring).toBe(true);
  });

  it('keeps the two modes mutually exclusive (each direction, state + storage)', () => {
    const { result } = renderHook(() => useScoringParticipationModes('m1'));

    act(() => result.current.setNotScoring(true));
    expect(result.current.notScoring).toBe(true);

    // Turning Auto-Confirm on must turn I'm-Not-Scoring off.
    act(() => result.current.setAutoConfirm(true));
    expect(result.current.autoConfirm).toBe(true);
    expect(result.current.notScoring).toBe(false);
    expect(sessionStorage.getItem(AUTO_KEY)).toBe('true');
    expect(localStorage.getItem(NOT_KEY)).toBeNull();

    // ...and the reverse.
    act(() => result.current.setNotScoring(true));
    expect(result.current.notScoring).toBe(true);
    expect(result.current.autoConfirm).toBe(false);
    expect(localStorage.getItem(NOT_KEY)).toBe('true');
    expect(sessionStorage.getItem(AUTO_KEY)).toBeNull();
  });

  it('namespaces by match — a mode set on one match never leaks to another', () => {
    sessionStorage.setItem(AUTO_KEY, 'true'); // set on m1
    const { result } = renderHook(() => useScoringParticipationModes('m2'));
    expect(result.current.autoConfirm).toBe(false);
  });

  it('clears Auto-Confirm on a real unmount (off the moment you leave the page)', () => {
    const { result, unmount } = renderHook(() =>
      useScoringParticipationModes('m1')
    );
    act(() => result.current.setAutoConfirm(true));
    expect(sessionStorage.getItem(AUTO_KEY)).toBe('true');

    unmount(); // schedules the deferred clear
    act(() => {
      vi.runAllTimers(); // a real navigate-away → the clear fires
    });
    expect(sessionStorage.getItem(AUTO_KEY)).toBeNull();
  });

  it('does NOT clear I\'m-Not-Scoring on unmount (it outlives leaving the page)', () => {
    const { result, unmount } = renderHook(() =>
      useScoringParticipationModes('m1')
    );
    act(() => result.current.setNotScoring(true));

    unmount();
    act(() => {
      vi.runAllTimers();
    });
    // Only Auto-Confirm is consequence-perishable; the opt-out persists.
    expect(localStorage.getItem(NOT_KEY)).toBe('true');
  });

  it('survives a StrictMode unmount→remount: the remount cancels the pending clear', () => {
    const first = renderHook(() => useScoringParticipationModes('m1'));
    act(() => first.result.current.setAutoConfirm(true));

    // StrictMode (dev) fires a throwaway unmount immediately followed by a
    // remount. The unmount schedules a clear; the remount must cancel it
    // before the macrotask runs.
    first.unmount();
    const second = renderHook(() => useScoringParticipationModes('m1'));
    act(() => {
      vi.runAllTimers(); // the cancelled clear must NOT fire
    });

    expect(sessionStorage.getItem(AUTO_KEY)).toBe('true');
    expect(second.result.current.autoConfirm).toBe(true);
  });
});
