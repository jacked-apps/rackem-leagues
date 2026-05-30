/**
 * @fileoverview Tests for useConnectionHealth + its pure helpers
 * (live-scoring resilience, Phase 1 / Unit 3).
 *
 * Three layers:
 *  1. `classifyHealth` — pure realtime-status + reachability → health mapping.
 *  2. `computeDegradedPollInterval` — pure polling cadence decision.
 *  3. `useConnectionHealth` — fires one probe on degradation, reacts to the
 *     result, and re-probes fresh after recovering.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  classifyHealth,
  computeDegradedPollInterval,
  useConnectionHealth,
  DEGRADED_POLL_MS,
} from './useConnectionHealth';

describe('classifyHealth', () => {
  it('live realtime → live regardless of probe/online', () => {
    expect(classifyHealth('live', null, true)).toBe('live');
    expect(classifyHealth('live', false, false)).toBe('live');
  });

  it('degraded + reachable → realtime-down (poll fallback)', () => {
    expect(classifyHealth('reconnecting', true, true)).toBe('realtime-down');
    expect(classifyHealth('error', true, true)).toBe('realtime-down');
  });

  it('degraded + not-yet-probed → realtime-down (optimistic, start polling)', () => {
    expect(classifyHealth('reconnecting', null, true)).toBe('realtime-down');
  });

  it('degraded + probe failed → offline', () => {
    expect(classifyHealth('reconnecting', false, true)).toBe('offline');
  });

  it('degraded + navigator offline → offline (short-circuit)', () => {
    expect(classifyHealth('reconnecting', true, false)).toBe('offline');
    expect(classifyHealth('reconnecting', null, false)).toBe('offline');
  });
});

describe('computeDegradedPollInterval', () => {
  it('polls while realtime-down AND in_progress', () => {
    expect(computeDegradedPollInterval('realtime-down', 'in_progress')).toBe(
      DEGRADED_POLL_MS
    );
  });

  it('does not poll while live', () => {
    expect(computeDegradedPollInterval('live', 'in_progress')).toBe(false);
  });

  it('does not poll while offline (nothing reachable to poll)', () => {
    expect(computeDegradedPollInterval('offline', 'in_progress')).toBe(false);
  });

  it('does not poll when the match is not in progress', () => {
    expect(computeDegradedPollInterval('realtime-down', 'scheduled')).toBe(false);
    expect(computeDegradedPollInterval('realtime-down', 'completed')).toBe(false);
    expect(computeDegradedPollInterval('realtime-down', undefined)).toBe(false);
  });
});

describe('useConnectionHealth', () => {
  it('live → health live, never probes', () => {
    const probe = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useConnectionHealth('live', { probe }));
    expect(result.current.health).toBe('live');
    expect(result.current.isDegraded).toBe(false);
    expect(probe).not.toHaveBeenCalled();
  });

  it('realtime trouble + probe reachable → realtime-down, polling-eligible', async () => {
    const probe = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useConnectionHealth('reconnecting', { probe })
    );

    await waitFor(() => expect(result.current.health).toBe('realtime-down'));
    expect(result.current.isDegraded).toBe(true);
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('realtime trouble + probe unreachable → offline', async () => {
    const probe = vi.fn().mockResolvedValue(false);
    const { result } = renderHook(() =>
      useConnectionHealth('error', { probe })
    );

    await waitFor(() => expect(result.current.health).toBe('offline'));
    expect(result.current.isDegraded).toBe(true);
  });

  it('a thrown probe is treated as offline (never crashes)', async () => {
    const probe = vi.fn().mockRejectedValue(new Error('network'));
    const { result } = renderHook(() =>
      useConnectionHealth('reconnecting', { probe })
    );

    await waitFor(() => expect(result.current.health).toBe('offline'));
  });

  it('probes once per degradation episode, not on every render', async () => {
    const probe = vi.fn().mockResolvedValue(true);
    const { result, rerender } = renderHook(
      ({ status }) => useConnectionHealth(status, { probe }),
      { initialProps: { status: 'reconnecting' as const } }
    );

    await waitFor(() => expect(result.current.health).toBe('realtime-down'));
    rerender({ status: 'reconnecting' as const });
    rerender({ status: 'reconnecting' as const });
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('re-probes fresh after recovering to live', async () => {
    const probe = vi.fn().mockResolvedValue(true);
    const { result, rerender } = renderHook(
      ({ status }: { status: 'live' | 'reconnecting' }) =>
        useConnectionHealth(status, { probe }),
      { initialProps: { status: 'reconnecting' } }
    );

    await waitFor(() => expect(result.current.health).toBe('realtime-down'));
    expect(probe).toHaveBeenCalledTimes(1);

    // Recover → live, then drop again → a second probe fires.
    rerender({ status: 'live' });
    await waitFor(() => expect(result.current.health).toBe('live'));

    rerender({ status: 'reconnecting' });
    await waitFor(() => expect(probe).toHaveBeenCalledTimes(2));
  });
});
