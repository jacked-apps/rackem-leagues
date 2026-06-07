/**
 * @fileoverview Tests for the league-scoped OnboardCaptainsList.
 *
 * Verifies it renders one row per not-yet-registered captain (team + captain
 * name + Copy link), copies the right /join/:token URL and flips the row label
 * to "Copied!", and renders nothing while loading or when the list is empty
 * (the self-clearing behavior). The data hook + clipboard are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { LeagueOnboardingTeam } from '@/api/queries/teamJoin';

const mockUseLeagueTeams = vi.fn();

vi.mock('@/api/hooks/useTeamJoinDistribution', () => ({
  useLeagueTeamsForOnboarding: () => mockUseLeagueTeams(),
}));

import { OnboardCaptainsList } from './OnboardCaptainsList';

const rows: LeagueOnboardingTeam[] = [
  { team_id: 't1', team_name: 'The Break Room', captain_name: 'Jordan Quick', join_token: 'tok-1' },
  { team_id: 't2', team_name: 'Side Pockets', captain_name: 'Sam Rail', join_token: 'tok-2' },
];

const writeText = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockUseLeagueTeams.mockReturnValue({ data: rows, isLoading: false });
  // navigator.clipboard is a getter-only prop in happy-dom; define it directly.
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
});

describe('OnboardCaptainsList', () => {
  it('renders nothing while loading', () => {
    mockUseLeagueTeams.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(<OnboardCaptainsList leagueId="lg1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when no captains remain (self-cleared)', () => {
    mockUseLeagueTeams.mockReturnValue({ data: [], isLoading: false });
    const { container } = render(<OnboardCaptainsList leagueId="lg1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders one row per captain with team + captain name', () => {
    render(<OnboardCaptainsList leagueId="lg1" />);
    expect(screen.getByText('The Break Room')).toBeInTheDocument();
    expect(screen.getByText('Captain: Jordan Quick')).toBeInTheDocument();
    expect(screen.getByText('Side Pockets')).toBeInTheDocument();
    expect(screen.getByText('Captain: Sam Rail')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Copy link' })).toHaveLength(2);
  });

  it('copies the join URL and flips that row to "Copied!"', () => {
    render(<OnboardCaptainsList leagueId="lg1" />);
    const buttons = screen.getAllByRole('button', { name: 'Copy link' });
    fireEvent.click(buttons[0]!);
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/join/tok-1`);
    // Only the clicked row flips; the other stays "Copy link".
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Copy link' })).toHaveLength(1);
  });
});
