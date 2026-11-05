/**
 * @fileoverview useTiebreakLineupRedirect — the stranded-team backstop.
 *
 * A tied match's tiebreak lineups must be set on the lineup page. The phone
 * that loses the completion race used to sit on /score forever; this hook
 * sends it to /lineup, but only once the tiebreak record has loaded.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { useTiebreakLineupRedirect } from './useTiebreakLineupRedirect';
import type { MatchTiebreaker } from '@/api/queries/tiebreakers';

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

function record(locks: boolean[]): MatchTiebreaker {
  return { match_tiebreaker_lineups: locks.map((locked) => ({ locked })) } as unknown as MatchTiebreaker;
}

const tied = {
  matchId: 'm1',
  status: 'in_progress',
  matchResult: 'tie',
  tiebreakerGamesExist: true,
};

describe('useTiebreakLineupRedirect', () => {
  beforeEach(() => {
    navigate.mockReset();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('sends a stranded team to the lineup page once the record has loaded', () => {
    renderHook(() => useTiebreakLineupRedirect({ ...tied, record: record([false, false]), refetchRecord: vi.fn() }), { wrapper });
    expect(navigate).toHaveBeenCalledWith('/match/m1/lineup', { replace: true });
  });

  it('also redirects when only one tiebreak lineup is locked', () => {
    renderHook(() => useTiebreakLineupRedirect({ ...tied, record: record([true, false]), refetchRecord: vi.fn() }), { wrapper });
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('waits and keeps re-fetching while the record is missing, without navigating', () => {
    const refetchRecord = vi.fn();
    renderHook(() => useTiebreakLineupRedirect({ ...tied, record: null, refetchRecord }), { wrapper });
    vi.advanceTimersByTime(2500);
    expect(navigate).not.toHaveBeenCalled();
    expect(refetchRecord).toHaveBeenCalledTimes(3); // once now, then every second
  });

  it('stays on scoring once both tiebreak lineups are locked', () => {
    renderHook(() => useTiebreakLineupRedirect({ ...tied, record: record([true, true]), refetchRecord: vi.fn() }), { wrapper });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does nothing for a match that is not tied', () => {
    const refetchRecord = vi.fn();
    renderHook(() => useTiebreakLineupRedirect({ ...tied, matchResult: null, record: null, refetchRecord }), { wrapper });
    vi.advanceTimersByTime(2500);
    expect(navigate).not.toHaveBeenCalled();
    expect(refetchRecord).not.toHaveBeenCalled();
  });
});
