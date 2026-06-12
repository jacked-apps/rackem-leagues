/**
 * @fileoverview Tests for the approve surface (JoinRequestList + JoinRequestCard).
 *
 * Verifies the list scoping (empty state, league filter) and the richer guided
 * card: a scannable collapsed summary (who's asking, team + league, a "captain
 * spot still open" flag), and on expand the full roster — claimable placeholder
 * spots as tap-to-connect targets (captain flagged + first), registered members
 * as non-tappable context, the no-spot single-Add path, the footgun-guarded
 * "just add as new" (which holds even if the roster fails to load), and decline.
 * The requests feed, approve mutation, and team-roster feed are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type {
  ApproverJoinRequest,
  TeamRosterMember,
} from '@/api/queries/teamJoin';

const mockUseRequests = vi.fn();
const mockMutate = vi.fn();
const mockUseRoster = vi.fn();

vi.mock('@/api/hooks/useTeamJoinRequests', () => ({
  useTeamJoinRequests: () => mockUseRequests(),
}));
vi.mock('@/api/hooks/useApproveJoinRequest', () => ({
  useApproveJoinRequest: () => ({ mutate: mockMutate, isPending: false }),
}));
vi.mock('@/api/hooks/useTeamRosterForApprover', () => ({
  useTeamRosterForApprover: (teamId: string | undefined) => mockUseRoster(teamId),
}));

import { JoinRequestList } from './JoinRequestList';

const baseReq: ApproverJoinRequest = {
  request_id: 'r1',
  team_id: 't1',
  team_name: 'The Break Room',
  league_id: 'lg1',
  league_name: 'Tuesday Eight-ball',
  requester_member_id: 'm1',
  requester_name: 'Jordan Quick',
  claimed_member_id: null,
  claimed_name: null,
  captain_name: 'Reggie Registered',
  captain_is_placeholder: false,
  has_open_placeholders: false,
  created_at: '2026-06-01T00:00:00Z',
};

/** Build a roster member with sane defaults. */
function member(over: Partial<TeamRosterMember>): TeamRosterMember {
  return {
    member_id: 'x',
    display_name: 'Someone',
    is_captain: false,
    is_registered: false,
    claimable: false,
    has_stats: false,
    ...over,
  };
}

/** The card is collapsed by default — expand it to reach the roster + actions. */
function expandCard() {
  fireEvent.click(screen.getByRole('button', { expanded: false }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseRequests.mockReturnValue({ data: [baseReq], isLoading: false });
  // Default: roster not yet loaded (collapsed cards don't fetch).
  mockUseRoster.mockReturnValue({ data: undefined, isLoading: false, isError: false });
});

describe('JoinRequestList', () => {
  it('empty + emptyHint → stays visible with the title and hint (operator surface)', () => {
    mockUseRequests.mockReturnValue({ data: [], isLoading: false });
    render(<JoinRequestList title="Join requests" emptyHint="No pending join requests right now." />);
    expect(screen.getByText('Join requests')).toBeInTheDocument();
    expect(screen.getByText('No pending join requests right now.')).toBeInTheDocument();
  });

  it('leagueId filters the org-wide feed to that league only', () => {
    mockUseRequests.mockReturnValue({
      data: [
        baseReq,
        { ...baseReq, request_id: 'r2', requester_name: 'Pat Other', league_id: 'lg2' },
      ],
      isLoading: false,
    });
    render(<JoinRequestList leagueId="lg1" />);
    expect(screen.getByText(/Jordan Quick accepted the invite/)).toBeInTheDocument();
    expect(screen.queryByText(/Pat Other accepted the invite/)).not.toBeInTheDocument();
  });

  it('renders nothing when the feed is empty (no emptyHint)', () => {
    mockUseRequests.mockReturnValue({ data: [], isLoading: false });
    const { container } = render(<JoinRequestList />);
    expect(container).toBeEmptyDOMElement();
  });

  it('leads with who accepted the invite, plus team and league (collapsed summary)', () => {
    render(<JoinRequestList />);
    expect(screen.getByText(/Jordan Quick accepted the invite/)).toBeInTheDocument();
    expect(screen.getByText(/The Break Room · Tuesday Eight-ball/)).toBeInTheDocument();
    // Actions are hidden until expanded — the collapsed list stays scannable.
    expect(screen.queryByRole('button', { name: /Decline/ })).not.toBeInTheDocument();
  });

  it('flags a still-placeholder captain on the collapsed summary', () => {
    mockUseRequests.mockReturnValue({
      data: [{ ...baseReq, captain_is_placeholder: true }],
      isLoading: false,
    });
    render(<JoinRequestList />);
    // Visible without expanding — the at-a-scale "seat the captain" signal.
    expect(screen.getByText(/Captain spot still open/i)).toBeInTheDocument();
  });

  it('no open spots → expand → single "Add to the team", one tap → add', () => {
    mockUseRoster.mockReturnValue({
      data: [member({ member_id: 'c1', display_name: 'Reggie', is_captain: true, is_registered: true })],
      isLoading: false,
      isError: false,
    });
    render(<JoinRequestList />);
    expandCard();
    // No "is this one of your players?" prompt when there's nothing to connect.
    expect(screen.queryByText(/one of your players/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add to the team' }));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'r1', action: 'add' }),
      expect.anything(),
    );
  });

  it('with placeholders → expand → connect targets + guarded "just add as new"', () => {
    mockUseRequests.mockReturnValue({
      data: [{ ...baseReq, has_open_placeholders: true }],
      isLoading: false,
    });
    mockUseRoster.mockReturnValue({
      data: [member({ member_id: 'p1', display_name: 'J. Quick (PP)', claimable: true, has_stats: true })],
      isLoading: false,
      isError: false,
    });
    render(<JoinRequestList />);
    expandCard();
    expect(screen.getByText(/one of your players/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /J\. Quick \(PP\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /just add them as new/i })).toBeInTheDocument();
    // The bare unguarded single-add must NOT be present when there's an open spot.
    expect(screen.queryByRole('button', { name: 'Add to the team' })).not.toBeInTheDocument();
  });

  it('shows registered members as non-tappable context', () => {
    mockUseRequests.mockReturnValue({
      data: [{ ...baseReq, has_open_placeholders: true }],
      isLoading: false,
    });
    mockUseRoster.mockReturnValue({
      data: [
        member({ member_id: 'p1', display_name: 'Open Spot (PP)', claimable: true }),
        member({ member_id: 'r1', display_name: 'Already Here', is_registered: true }),
      ],
      isLoading: false,
      isError: false,
    });
    render(<JoinRequestList />);
    expandCard();
    expect(screen.getByText('Already on the team')).toBeInTheDocument();
    expect(screen.getByText('Already Here')).toBeInTheDocument();
    // The registered member is context, not a connect button.
    expect(screen.queryByRole('button', { name: /Already Here/ })).not.toBeInTheDocument();
  });

  it('tapping a placeholder name confirms, then merges (replace + member id)', () => {
    mockUseRequests.mockReturnValue({
      data: [{ ...baseReq, has_open_placeholders: true }],
      isLoading: false,
    });
    mockUseRoster.mockReturnValue({
      data: [member({ member_id: 'p1', display_name: 'J. Quick (PP)', claimable: true, has_stats: true })],
      isLoading: false,
      isError: false,
    });
    render(<JoinRequestList />);
    expandCard();

    // Tap the name → "same person?" confirm, not an immediate merge.
    fireEvent.click(screen.getByRole('button', { name: /J\. Quick \(PP\)/ }));
    expect(mockMutate).not.toHaveBeenCalled();
    expect(screen.getByText(/Are these the same person/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Yes, same person/i }));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'r1', action: 'replace', claimedMemberId: 'p1' }),
      expect.anything(),
    );
  });

  it('tapping a no-record placeholder confirms with plain "add" copy (no merge talk)', () => {
    mockUseRequests.mockReturnValue({
      data: [{ ...baseReq, has_open_placeholders: true }],
      isLoading: false,
    });
    mockUseRoster.mockReturnValue({
      data: [member({ member_id: 'p1', display_name: 'J. Quick (PP)', claimable: true, has_stats: false })],
      isLoading: false,
      isError: false,
    });
    render(<JoinRequestList />);
    expandCard();

    fireEvent.click(screen.getByRole('button', { name: /J\. Quick \(PP\)/ }));
    expect(screen.getByText(/^Add them to the team\?$/i)).toBeInTheDocument();
    expect(screen.queryByText(/same person/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Add to team$/i }));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'r1', action: 'replace', claimedMemberId: 'p1' }),
      expect.anything(),
    );
  });

  it('flags the captain spot, lists it first, and seats the captain on connect', () => {
    mockUseRequests.mockReturnValue({
      data: [{ ...baseReq, has_open_placeholders: true, captain_is_placeholder: true }],
      isLoading: false,
    });
    mockUseRoster.mockReturnValue({
      data: [
        member({ member_id: 'cap', display_name: 'Cappy (PP)', is_captain: true, claimable: true }),
        member({ member_id: 'p2', display_name: 'Other (PP)', claimable: true }),
      ],
      isLoading: false,
      isError: false,
    });
    render(<JoinRequestList />);
    expandCard();

    // The captain connect target carries a "captain" badge.
    const capBtn = screen.getByRole('button', { name: /Cappy \(PP\)/ });
    expect(capBtn).toHaveTextContent(/captain/i);

    fireEvent.click(capBtn);
    expect(screen.getByText(/Make them the captain\?/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Make captain$/i }));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'r1', action: 'replace', claimedMemberId: 'cap' }),
      expect.anything(),
    );
  });

  it('footgun guard: "just add as new" confirms before adding', () => {
    mockUseRequests.mockReturnValue({
      data: [{ ...baseReq, has_open_placeholders: true }],
      isLoading: false,
    });
    mockUseRoster.mockReturnValue({
      data: [member({ member_id: 'p1', display_name: 'Open (PP)', claimable: true })],
      isLoading: false,
      isError: false,
    });
    render(<JoinRequestList />);
    expandCard();

    fireEvent.click(screen.getByRole('button', { name: /just add them as new/i }));
    // Not an immediate add — a deliberate confirm first.
    expect(mockMutate).not.toHaveBeenCalled();
    expect(screen.getByText(/add .* as a new player\?/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Add as new$/i }));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'r1', action: 'add' }),
      expect.anything(),
    );
  });

  it('keeps the guard when the roster fails to load (no silent unguarded add)', () => {
    mockUseRequests.mockReturnValue({
      data: [{ ...baseReq, has_open_placeholders: true }],
      isLoading: false,
    });
    // Roster errored — but the feed still says there are open placeholders.
    mockUseRoster.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<JoinRequestList />);
    expandCard();

    // Guarded action remains; the bare unguarded single-add must NOT appear.
    expect(screen.getByRole('button', { name: /just add them as new/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add to the team' })).not.toBeInTheDocument();
  });

  it('Decline confirms before mutating', () => {
    render(<JoinRequestList />);
    expandCard();
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    expect(mockMutate).not.toHaveBeenCalled();
    const declineButtons = screen.getAllByRole('button', { name: 'Decline' });
    fireEvent.click(declineButtons[declineButtons.length - 1]);
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'r1', action: 'decline' }),
      expect.anything(),
    );
  });
});
