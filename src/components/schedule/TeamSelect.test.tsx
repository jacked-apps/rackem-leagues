/**
 * @fileoverview TeamSelect's "BYE" choice is the season's REAL bye team.
 *
 * The team list is active-only, so a bye matchup's bye side used to show
 * blank, and the old "BYE" choice saved an empty team slot (the pre-May bye
 * model). Now the bye team's id is passed in and shown as "BYE".
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TeamSelect } from './TeamSelect';

const teams = [
  { id: 'sharks', teamName: 'Sharks' },
  { id: 'eagles', teamName: 'Eagles' },
];

describe('TeamSelect bye choice', () => {
  it('shows "BYE" for a matchup side that holds the season bye team', () => {
    render(<TeamSelect value="bye-row" onChange={vi.fn()} teams={teams} byeTeamId="bye-row" label="Away" />);
    expect(screen.getByRole('combobox', { name: 'Away' })).toHaveTextContent('BYE');
  });

  it('shows the team name for a normal team', () => {
    render(<TeamSelect value="eagles" onChange={vi.fn()} teams={teams} byeTeamId="bye-row" label="Away" />);
    expect(screen.getByRole('combobox', { name: 'Away' })).toHaveTextContent('Eagles');
  });

  it('shows the placeholder when no team is chosen (a playoff TBD), not "BYE"', () => {
    render(<TeamSelect value={null} onChange={vi.fn()} teams={teams} byeTeamId="bye-row" placeholder="Away team" label="Away" />);
    const trigger = screen.getByRole('combobox', { name: 'Away' });
    expect(trigger).toHaveTextContent('Away team');
    expect(trigger).not.toHaveTextContent('BYE');
  });
});
