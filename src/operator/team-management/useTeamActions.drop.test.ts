/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures use minimal `as any` shapes */
/**
 * @fileoverview useTeamActions delete routing: a season that already has a BYE
 * (odd team count) must take the odd-league drop, never the even-league
 * drop_team_mid_season (which refuses a second BYE) or convertTeamToBye.
 * Supabase is mocked: every count says "has matches, some played".
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const rpc = vi.fn().mockResolvedValue({ error: null });
const counted = { count: 3, error: null };
vi.mock('@/supabaseClient', () => ({
  supabase: {
    from: () => ({ select: () => ({ or: () => Object.assign(Promise.resolve(counted), { or: () => Promise.resolve(counted) }) }) }),
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));
const byeLookup = vi.fn();
const oddDrop = vi.fn().mockResolvedValue(2);
vi.mock('./dropTeamOddLeague', () => ({
  fetchSeasonByeTeamId: (...a: unknown[]) => byeLookup(...a),
  dropTeamOddLeague: (...a: unknown[]) => oddDrop(...a),
}));
const toBye = vi.fn();
vi.mock('@/api/mutations/teams', () => ({ convertTeamToBye: (...a: unknown[]) => toBye(...a) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { useTeamActions } from './useTeamActions';

const teams = [{ id: 't1', season_id: 's1' } as any];
const drop = async () => {
  const { result } = renderHook(() => useTeamActions(teams, vi.fn(), vi.fn().mockResolvedValue(true)));
  await act(() => result.current.handleDeleteTeam('t1'));
};

describe('useTeamActions: dropping a scheduled team', () => {
  beforeEach(() => { rpc.mockClear(); oddDrop.mockClear(); toBye.mockClear(); });

  it('season with a BYE → odd-league drop, not the even-league paths', async () => {
    byeLookup.mockResolvedValue('bye-1');
    await drop();
    expect(oddDrop).toHaveBeenCalledWith('t1', 's1', 'bye-1');
    expect(rpc).not.toHaveBeenCalled();
    expect(toBye).not.toHaveBeenCalled();
  });

  it('season without a BYE → unchanged even-league mid-season drop', async () => {
    byeLookup.mockResolvedValue(null);
    await drop();
    expect(oddDrop).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('drop_team_mid_season', { p_team_id: 't1', p_season_id: 's1' });
  });
});
