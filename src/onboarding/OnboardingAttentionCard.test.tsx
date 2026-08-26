/**
 * @fileoverview Tests for the combined onboarding attention card.
 *
 * Covers the two states Ed cares about — muted "all onboarded" when there's no
 * work, and a conspicuous count badge + full captain name when captains need
 * onboarding — plus the always-present join-request surface and copy-link flow.
 * Data hooks + the reused JoinRequestList are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { LeagueOnboardingTeam } from '@/api/queries/teamJoin';

const mockOnboard = vi.fn();
const mockFeed = vi.fn();

vi.mock('@/api/hooks/useTeamJoinDistribution', () => ({
  useLeagueTeamsForOnboarding: () => mockOnboard(),
}));
vi.mock('@/api/hooks/useTeamJoinRequests', () => ({
  useTeamJoinRequests: () => mockFeed(),
}));
vi.mock('@/onboarding/components/JoinRequestList', () => ({
  JoinRequestList: () => <div data-testid="join-request-list" />,
}));

import { OnboardingAttentionCard } from './OnboardingAttentionCard';

const rows: LeagueOnboardingTeam[] = [
  { team_id: 't1', team_name: 'The Break Room', captain_name: 'Jordan Quick', join_token: 'tok-1' },
];
const writeText = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockOnboard.mockReturnValue({ data: [], isLoading: false });
  mockFeed.mockReturnValue({ data: [], isLoading: false });
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

describe('OnboardingAttentionCard', () => {
  it('is muted ("all onboarded", no badges) when there is no work', () => {
    render(<OnboardingAttentionCard leagueId="lg1" />);
    expect(screen.getByText(/All players onboarded/i)).toBeInTheDocument();
    expect(screen.queryByText(/to onboard/i)).not.toBeInTheDocument();
  });

  it('is conspicuous with a count badge + FULL captain name, and always shows the join-request surface', () => {
    mockOnboard.mockReturnValue({ data: rows, isLoading: false });
    render(<OnboardingAttentionCard leagueId="lg1" />);
    expect(screen.getByText('1 to onboard')).toBeInTheDocument();
    expect(screen.getByText('The Break Room')).toBeInTheDocument();
    expect(screen.getByText('Captain: Jordan Quick')).toBeInTheDocument();
    // Join-request surface is present even with nothing pending (never disappears).
    expect(screen.getByTestId('join-request-list')).toBeInTheDocument();
  });

  it('copies the /join/:token link and flashes "Copied!"', () => {
    mockOnboard.mockReturnValue({ data: rows, isLoading: false });
    render(<OnboardingAttentionCard leagueId="lg1" />);
    fireEvent.click(screen.getByText('Copy link'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/join/tok-1'));
    expect(screen.getByText('Copied!')).toBeInTheDocument();
  });
});
