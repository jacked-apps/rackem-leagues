/**
 * @fileoverview Tests for `useLineupPersistence` — the tiebreaker lock rule.
 *
 * When a tied match goes to a tiebreaker, both lineups are unlocked ONLY so
 * each team can choose the order its players shoot games 19–21. Per Ed
 * (2026-10-26) the players, their handicaps and the home team bonus are fixed
 * at the initial lock and must not change in any way. These tests pin that
 * down: in tiebreaker mode, lock and unlock send ONLY the lock flag to the
 * lineup row — even when the screen is holding re-ordered players, freshly
 * recalculated handicaps, a different team bonus, or a double-duty slot.
 *
 * The normal (pre-match) lock is covered too, as the control: it still writes
 * the full lineup the captain built.
 *
 * supabase-js and the mutation hooks are mocked; no database is touched.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const lineupMutateAsync = vi.fn();
const matchMutateAsync = vi.fn();

vi.mock('@/api/hooks', () => ({
  useUpdateMatchLineup: () => ({ mutateAsync: lineupMutateAsync }),
  useUpdateMatch: () => ({ mutateAsync: matchMutateAsync }),
}));

// Team-membership check: supabase.from('team_players').select().eq().eq().single()
vi.mock('@/supabaseClient', () => {
  const single = vi.fn().mockResolvedValue({ data: { id: 'tp1' }, error: null });
  const chain = { select: () => chain, eq: () => chain, single };
  return { supabase: { from: () => chain } };
});

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { useLineupPersistence } from './useLineupPersistence';

/**
 * Params as the lineup screen passes them DURING a tiebreaker: players in the
 * new tiebreaker order, handicaps recalculated (different from the locked
 * row), a re-derived team bonus, and a double-duty player in two slots.
 */
function tiebreakerScreenParams(isTiebreakerMode: boolean) {
  return {
    matchId: 'm1',
    userTeamId: 't-home',
    memberId: 'mem1',
    lineupId: 'lineup-home',
    opponentLocked: false,
    player1Id: 'p3',
    player2Id: 'p1',
    player3Id: 'p1', // double duty — appears twice
    player1Handicap: 5,
    player2Handicap: 4,
    player3Handicap: 4,
    playerCount: 3,
    teamHandicap: 2,
    isComplete: true,
    hasDuplicates: false,
    onLineupIdChange: vi.fn(),
    onLockedChange: vi.fn(),
    matchData: { home_team_id: 't-home', away_lineup_id: 'lineup-away', started_at: 'x' },
    refetchLineups: vi.fn(),
    isTiebreakerMode,
  };
}

describe('useLineupPersistence — tiebreaker keeps the initial lineup intact', () => {
  beforeEach(() => {
    lineupMutateAsync.mockReset().mockResolvedValue({ id: 'lineup-home' });
    matchMutateAsync.mockReset().mockResolvedValue({});
  });

  it('tiebreaker LOCK writes only the lock flag (no players, handicaps or team bonus)', async () => {
    const params = tiebreakerScreenParams(true);
    const { result } = renderHook(() => useLineupPersistence(params));

    await act(async () => {
      await result.current.handleLockLineup();
    });

    expect(lineupMutateAsync).toHaveBeenCalledTimes(1);
    const { lineupId, updates } = lineupMutateAsync.mock.calls[0][0];
    expect(lineupId).toBe('lineup-home');
    expect(Object.keys(updates).sort()).toEqual(['locked', 'locked_at']);
    expect(updates.locked).toBe(true);
    expect(params.onLockedChange).toHaveBeenCalledWith(true);
    // The match row is left alone too (lineup id / started_at already set).
    expect(matchMutateAsync).not.toHaveBeenCalled();
  });

  it('tiebreaker UNLOCK writes only the lock flag (double-duty slots are not cleared)', async () => {
    const params = tiebreakerScreenParams(true);
    const { result } = renderHook(() => useLineupPersistence(params));

    await act(async () => {
      await result.current.handleUnlockLineup();
    });

    expect(lineupMutateAsync).toHaveBeenCalledTimes(1);
    const { updates } = lineupMutateAsync.mock.calls[0][0];
    expect(updates).toEqual({ locked: false, locked_at: null });
    expect(params.onLockedChange).toHaveBeenCalledWith(false);
  });

  it('normal pre-match LOCK still saves the full lineup the captain built', async () => {
    const params = tiebreakerScreenParams(false);
    const { result } = renderHook(() => useLineupPersistence(params));

    await act(async () => {
      await result.current.handleLockLineup();
    });

    const { updates } = lineupMutateAsync.mock.calls[0][0];
    expect(updates).toMatchObject({
      player1_id: 'p3',
      player1_handicap: 5,
      home_team_modifier: 2,
      locked: true,
    });
  });

  it('normal pre-match UNLOCK still clears a player listed twice', async () => {
    const params = tiebreakerScreenParams(false);
    const { result } = renderHook(() => useLineupPersistence(params));

    await act(async () => {
      await result.current.handleUnlockLineup();
    });

    const { updates } = lineupMutateAsync.mock.calls[0][0];
    expect(updates).toMatchObject({
      locked: false,
      player2_id: null,
      player3_id: null,
    });
  });
});
