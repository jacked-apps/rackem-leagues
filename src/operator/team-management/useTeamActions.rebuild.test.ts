/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures use minimal `as any` shapes */
/**
 * @fileoverview useTeamActions: ADDING a team before any game is played clears
 * the schedule and sends the operator to rebuild it (Ed 2026-11-21). Editing a
 * team (incl. Fill on the BYE) and adding once play has begun leave it alone.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const scheduleState = vi.fn();
vi.mock('./preSeasonSchedule', () => ({
  fetchSeasonScheduleState: (...a: unknown[]) => scheduleState(...a),
  removeTeamAndClearSchedule: vi.fn(),
}));
const clear = vi.fn().mockResolvedValue({ success: true, matchesDeleted: 64 });
vi.mock('@/utils/scheduleGenerator', () => ({ clearSchedule: (...a: unknown[]) => clear(...a) }));
vi.mock('./useTeamDrop', () => ({ useTeamDrop: () => ({ handleDeleteTeam: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { useTeamActions } from './useTeamActions';

const onScheduleCleared = vi.fn();
const setup = () => renderHook(() =>
  useTeamActions([], vi.fn(), vi.fn(), { seasonId: 's1', onScheduleCleared }));

describe('useTeamActions: schedule after adding a team', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adding before any game is played → schedule cleared, go rebuild', async () => {
    scheduleState.mockResolvedValue({ hasSchedule: true, started: false });
    const { result } = setup();
    act(() => result.current.openAddTeam());
    await act(() => result.current.handleTeamCreateSuccess());
    expect(clear).toHaveBeenCalledWith('s1');
    expect(onScheduleCleared).toHaveBeenCalledWith('s1');
  });

  it('adding once play has begun → schedule kept', async () => {
    scheduleState.mockResolvedValue({ hasSchedule: true, started: true });
    const { result } = setup();
    act(() => result.current.openAddTeam());
    await act(() => result.current.handleTeamCreateSuccess());
    expect(clear).not.toHaveBeenCalled();
  });

  it('editing a team (e.g. Fill on the BYE) → schedule kept', async () => {
    scheduleState.mockResolvedValue({ hasSchedule: true, started: false });
    const { result } = setup();
    act(() => result.current.openEditTeam({ id: 'bye', team_name: 'BYE' } as any));
    await act(() => result.current.handleTeamCreateSuccess());
    expect(clear).not.toHaveBeenCalled();
  });
});
