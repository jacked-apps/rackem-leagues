/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures use minimal `as any` shapes */
/**
 * @fileoverview useTeamDrop routing (staging rules, Ed 2026-11-21) for a team
 * that is on the schedule:
 *   no game played in the season → remove team + schedule, go rebuild
 *   played + BYE (odd)           → odd-league re-pair
 *   played + no BYE (even)       → drop_team_mid_season
 * Supabase and the data helpers are mocked; the team "has matches".
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const rpc = vi.fn().mockResolvedValue({ error: null });
vi.mock('@/supabaseClient', () => ({
  supabase: {
    from: () => ({ select: () => ({ or: () => Promise.resolve({ count: 3, error: null }) }) }),
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));
const byeLookup = vi.fn();
const oddDrop = vi.fn().mockResolvedValue(2);
vi.mock('./dropTeamOddLeague', () => ({
  fetchSeasonByeTeamId: (...a: unknown[]) => byeLookup(...a),
  dropTeamOddLeague: (...a: unknown[]) => oddDrop(...a),
}));
const scheduleState = vi.fn();
const removeAndClear = vi.fn().mockResolvedValue(undefined);
vi.mock('./preSeasonSchedule', () => ({
  fetchSeasonScheduleState: (...a: unknown[]) => scheduleState(...a),
  removeTeamAndClearSchedule: (...a: unknown[]) => removeAndClear(...a),
}));
const toBye = vi.fn();
vi.mock('@/api/mutations/teams', () => ({ convertTeamToBye: (...a: unknown[]) => toBye(...a) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const scheduleChanged = vi.fn().mockResolvedValue(undefined);
vi.mock('@/api/hooks/useInvalidateSeasonSchedule', () => ({ useInvalidateSeasonSchedule: () => scheduleChanged }));

import { useTeamDrop } from './useTeamDrop';

const onScheduleCleared = vi.fn();
const drop = async () => {
  const { result } = renderHook(() => useTeamDrop({
    teams: [{ id: 't1', season_id: 's1' } as any],
    refreshTeams: vi.fn(),
    confirm: vi.fn().mockResolvedValue(true),
    onScheduleCleared,
  }));
  await act(() => result.current.handleDeleteTeam('t1'));
};

describe('useTeamDrop: removing a scheduled team', () => {
  beforeEach(() => vi.clearAllMocks());

  it('no game played yet → removes the team with the schedule, then sends you to rebuild', async () => {
    scheduleState.mockResolvedValue({ hasSchedule: true, started: false });
    await drop();
    expect(removeAndClear).toHaveBeenCalledWith('t1', 's1');
    expect(onScheduleCleared).toHaveBeenCalledWith('s1');
    expect(scheduleChanged).toHaveBeenCalledWith('s1'); // no stale schedule on other pages
    expect(oddDrop).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(toBye).not.toHaveBeenCalled();
  });

  it('games played, season has a BYE → odd-league re-pair', async () => {
    scheduleState.mockResolvedValue({ hasSchedule: true, started: true });
    byeLookup.mockResolvedValue('bye-1');
    await drop();
    expect(oddDrop).toHaveBeenCalledWith('t1', 's1', 'bye-1');
    expect(scheduleChanged).toHaveBeenCalledWith('s1');
    expect(removeAndClear).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('games played, no BYE → even-league mid-season drop', async () => {
    scheduleState.mockResolvedValue({ hasSchedule: true, started: true });
    byeLookup.mockResolvedValue(null);
    await drop();
    expect(rpc).toHaveBeenCalledWith('drop_team_mid_season', { p_team_id: 't1', p_season_id: 's1' });
    expect(oddDrop).not.toHaveBeenCalled();
    expect(onScheduleCleared).not.toHaveBeenCalled();
  });
});
