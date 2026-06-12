/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures use minimal `as any` shapes */
/**
 * @fileoverview Tests for useTeamActions — the team editor/expansion state machine.
 * (The Supabase-backed delete path is exercised via the page in integration; here
 * we lock the pure state behavior that the extraction must preserve.)
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTeamActions } from './useTeamActions';

const team = (id: string) => ({ id, team_name: `Team ${id}` } as any);
const setup = (teams: any[] = []) =>
  renderHook(() => useTeamActions(teams, vi.fn(), vi.fn().mockResolvedValue(true)));

describe('useTeamActions', () => {
  it('default team name is "Team <count+1>"', () => {
    const { result } = setup([team('a'), team('b')]);
    expect(result.current.generateDefaultTeamName()).toBe('Team 3');
  });

  it('openAddTeam opens the editor with no existing team', () => {
    const { result } = setup();
    act(() => result.current.openAddTeam());
    expect(result.current.showTeamEditor).toBe(true);
    expect(result.current.editingTeam).toBeNull();
  });

  it('openEditTeam opens the editor with the chosen team', () => {
    const { result } = setup();
    const t = team('x');
    act(() => result.current.openEditTeam(t));
    expect(result.current.showTeamEditor).toBe(true);
    expect(result.current.editingTeam).toBe(t);
  });

  it('closeTeamEditor clears editor state', () => {
    const { result } = setup();
    act(() => result.current.openEditTeam(team('x')));
    act(() => result.current.closeTeamEditor());
    expect(result.current.showTeamEditor).toBe(false);
    expect(result.current.editingTeam).toBeNull();
  });

  it('toggleTeamExpansion adds then removes an id', () => {
    const { result } = setup();
    act(() => result.current.toggleTeamExpansion('t1'));
    expect(result.current.expandedTeams.has('t1')).toBe(true);
    act(() => result.current.toggleTeamExpansion('t1'));
    expect(result.current.expandedTeams.has('t1')).toBe(false);
  });
});
