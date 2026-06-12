/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures use minimal `as any` shapes */
/**
 * @fileoverview Tests for TeamsPanel — the main Teams section. The heavy TeamCard
 * child is mocked so we test the panel's own logic (Add Team guards, the bye
 * warning, the empty states, import visibility, and the action wiring).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TeamsPanel } from './TeamsPanel';

vi.mock('@/components/TeamCard', () => ({
  TeamCard: ({ team, onEdit, onDelete, onToggleExpand }: any) => (
    <div data-testid={`team-${team.id}`}>
      <span>{team.team_name}</span>
      <button onClick={onEdit}>edit-{team.id}</button>
      <button onClick={onDelete}>delete-{team.id}</button>
      <button onClick={onToggleExpand}>expand-{team.id}</button>
    </div>
  ),
}));

const venue = { venue_id: 'v1' } as any;

const base = {
  teams: [] as any[],
  leagueVenues: [venue] as any[],
  previousSeasonId: null as string | null,
  seasonId: 'season1' as string | null,
  importingTeams: false,
  isAtMaxTeams: false,
  hasBye: false,
  maxTeams: 10,
  expandedTeams: new Set<string>(),
  onImport: vi.fn(),
  onAddTeam: vi.fn(),
  onEditTeam: vi.fn(),
  onDeleteTeam: vi.fn(),
  onToggleExpand: vi.fn(),
};

beforeEach(() => vi.clearAllMocks());

describe('TeamsPanel', () => {
  it('no venues → "assign a venue" empty state + Add Team disabled', () => {
    render(<TeamsPanel {...base} leagueVenues={[]} />);
    expect(screen.getByText(/assign at least one venue/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add team/i })).toBeDisabled();
  });

  it('venues but no teams → "No Teams Yet"; Add Team enabled', () => {
    render(<TeamsPanel {...base} teams={[]} />);
    expect(screen.getByText('No Teams Yet')).toBeInTheDocument();
    const addBtn = screen.getByRole('button', { name: /add team/i });
    expect(addBtn).not.toBeDisabled();
    fireEvent.click(addBtn);
    expect(base.onAddTeam).toHaveBeenCalled();
  });

  it('open BYE → shows the bye warning and disables Add Team', () => {
    render(<TeamsPanel {...base} hasBye teams={[{ id: 'b1', status: 'bye', team_name: 'BYE' } as any]} />);
    expect(screen.getByText(/open BYE slot/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add team/i })).toBeDisabled();
  });

  it('at max teams → Add Team disabled', () => {
    render(<TeamsPanel {...base} isAtMaxTeams teams={[{ id: 't1', team_name: 'A' } as any]} />);
    expect(screen.getByRole('button', { name: /add team/i })).toBeDisabled();
  });

  it('no season → Add Team disabled', () => {
    render(<TeamsPanel {...base} seasonId={null} />);
    expect(screen.getByRole('button', { name: /add team/i })).toBeDisabled();
  });

  it('Import shows only with a previous season AND an empty team list', () => {
    const { rerender } = render(<TeamsPanel {...base} previousSeasonId="prev" teams={[]} />);
    expect(screen.getByRole('button', { name: /import from last season/i })).toBeInTheDocument();
    // With teams present, import is hidden.
    rerender(<TeamsPanel {...base} previousSeasonId="prev" teams={[{ id: 't1', team_name: 'A' } as any]} />);
    expect(screen.queryByRole('button', { name: /import from last season/i })).not.toBeInTheDocument();
  });

  it('renders a card per team and wires edit/delete/expand', () => {
    const onEditTeam = vi.fn();
    const onDeleteTeam = vi.fn();
    const onToggleExpand = vi.fn();
    const team = { id: 't1', team_name: 'Rack Attack' } as any;
    render(
      <TeamsPanel
        {...base}
        teams={[team]}
        onEditTeam={onEditTeam}
        onDeleteTeam={onDeleteTeam}
        onToggleExpand={onToggleExpand}
      />,
    );
    expect(screen.getByText('Rack Attack')).toBeInTheDocument();
    fireEvent.click(screen.getByText('edit-t1'));
    fireEvent.click(screen.getByText('delete-t1'));
    fireEvent.click(screen.getByText('expand-t1'));
    expect(onEditTeam).toHaveBeenCalledWith(team);
    expect(onDeleteTeam).toHaveBeenCalledWith('t1');
    expect(onToggleExpand).toHaveBeenCalledWith('t1');
  });
});
