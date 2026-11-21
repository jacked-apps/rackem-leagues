/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures use minimal `as any` shapes */
/**
 * @fileoverview Tests for useTeamActions — the team editor/expansion state machine.
 * (The Supabase-backed delete path is exercised via the page in integration; here
 * we lock the pure state behavior that the extraction must preserve.)
 */

import { describe, it, expect, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTeamActions } from './useTeamActions';

const team = (id: string) => ({ id, team_name: `Team ${id}` } as any);
const named = (team_name: string) => ({ id: team_name, team_name } as any);
// The hook reads the query client (it refreshes the schedule cache after a rebuild).
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient() }, children);
const setup = (teams: any[] = []) =>
  renderHook(() => useTeamActions(teams, vi.fn(), vi.fn().mockResolvedValue(true)), { wrapper });

describe('useTeamActions', () => {
  it('default team name is the next "Team N" when names run 1..count', () => {
    const { result } = setup([named('Team 1'), named('Team 2')]);
    expect(result.current.generateDefaultTeamName()).toBe('Team 3');
  });

  it('default team name fills the gap a dropped team left, never a name in use', () => {
    // Team 5 was dropped: 1-4, 6, 7 remain. "Team 7" (count + 1) is taken.
    const { result } = setup(['Team 1', 'Team 2', 'Team 3', 'Team 4', 'Team 6', 'Team 7'].map(named));
    expect(result.current.generateDefaultTeamName()).toBe('Team 5');
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
