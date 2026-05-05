/**
 * @fileoverview Tests for `computePhaseRefetchInterval` — the pure
 * function that decides MatchPhaseGuard's polling cadence.
 *
 * Defense 7 of the lineup → scoring transition stability fix: while
 * status='scheduled' (lineup phase, waiting for prep_match), poll
 * every 7s as a dropped-realtime backstop. Stop polling on every
 * other status, including when data is undefined (loading).
 */

import { describe, it, expect } from 'vitest';
import {
  computePhaseRefetchInterval,
  PHASE_POLL_MS,
  type MatchPhase,
} from '../useMatchPhase';

const PHASE = (status: MatchPhase['status']): MatchPhase => ({
  id: 'm1',
  status,
  started_at: null,
});

describe('computePhaseRefetchInterval', () => {
  it('polls every 7s while status=scheduled', () => {
    expect(computePhaseRefetchInterval(PHASE('scheduled'))).toBe(PHASE_POLL_MS);
    expect(PHASE_POLL_MS).toBe(7000);
  });

  it('stops polling when status flips to in_progress', () => {
    expect(computePhaseRefetchInterval(PHASE('in_progress'))).toBe(false);
  });

  it('stops polling on every terminal status', () => {
    expect(computePhaseRefetchInterval(PHASE('completed'))).toBe(false);
    expect(computePhaseRefetchInterval(PHASE('forfeited'))).toBe(false);
    expect(computePhaseRefetchInterval(PHASE('postponed'))).toBe(false);
  });

  it('does not poll while data is undefined (loading state)', () => {
    expect(computePhaseRefetchInterval(undefined)).toBe(false);
  });
});
