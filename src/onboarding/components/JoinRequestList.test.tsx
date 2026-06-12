/**
 * @fileoverview Tests for the approve surface (JoinRequestList + JoinRequestCard).
 *
 * Verifies the guided card flow: who's asking, the "is this one of your players?"
 * inline placeholder list (tap a name → confirm → merge/replace), the
 * "just add them" fallback, the no-placeholder single-Add path, and the decline
 * confirm. The requests feed, approve mutation, and placeholder feed are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ApproverJoinRequest } from '@/api/queries/teamJoin';

const mockUseRequests = vi.fn();
const mockMutate = vi.fn();
const mockUsePlaceholders = vi.fn();

vi.mock('@/api/hooks/useTeamJoinRequests', () => ({
  useTeamJoinRequests: () => mockUseRequests(),
}));
vi.mock('@/api/hooks/useApproveJoinRequest', () => ({
  useApproveJoinRequest: () => ({ mutate: mockMutate, isPending: false }),
}));
vi.mock('@/api/hooks/useTeamPlaceholders', () => ({
  useTeamPlaceholders: (teamId: string | undefined) => mockUsePlaceholders(teamId),
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
  has_open_placeholders: false,
  created_at: '2026-06-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseRequests.mockReturnValue({ data: [baseReq], isLoading: false });
  // Default: no placeholders loaded (hook disabled / empty).
  mockUsePlaceholders.mockReturnValue({ data: [], isLoading: false });
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

  it('leads with who accepted the invite, plus team and league', () => {
    render(<JoinRequestList />);
    expect(screen.getByText(/Jordan Quick accepted the invite/)).toBeInTheDocument();
    expect(screen.getByText(/The Break Room · Tuesday Eight-ball/)).toBeInTheDocument();
  });

  it('no placeholders → single "Add to the team", one tap → add', () => {
    render(<JoinRequestList />);
    // No "is this one of your players?" prompt when there's nothing to match.
    expect(screen.queryByText(/one of your players/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add to the team' }));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'r1', action: 'add' }),
      expect.anything(),
    );
  });

  it('with placeholders → shows the name list + "just add" fallback', () => {
    mockUseRequests.mockReturnValue({
      data: [{ ...baseReq, has_open_placeholders: true }],
      isLoading: false,
    });
    mockUsePlaceholders.mockReturnValue({
      data: [{ member_id: 'p1', display_name: 'J. Quick (PP)', has_stats: true }],
      isLoading: false,
    });
    render(<JoinRequestList />);
    expect(screen.getByText(/one of your players/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /J\. Quick \(PP\)/ })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /just add them to the team/i }),
    ).toBeInTheDocument();
  });

  it('tapping a placeholder name confirms, then merges (replace + member id)', () => {
    mockUseRequests.mockReturnValue({
      data: [{ ...baseReq, has_open_placeholders: true }],
      isLoading: false,
    });
    mockUsePlaceholders.mockReturnValue({
      data: [{ member_id: 'p1', display_name: 'J. Quick (PP)', has_stats: true }],
      isLoading: false,
    });
    render(<JoinRequestList />);

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
    mockUsePlaceholders.mockReturnValue({
      data: [{ member_id: 'p1', display_name: 'J. Quick (PP)', has_stats: false }],
      isLoading: false,
    });
    render(<JoinRequestList />);

    fireEvent.click(screen.getByRole('button', { name: /J\. Quick \(PP\)/ }));
    // Plain add language — no "same person" / merge framing for a recordless PP.
    expect(screen.getByText(/^Add them to the team\?$/i)).toBeInTheDocument();
    expect(screen.queryByText(/same person/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Add to team$/i }));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'r1', action: 'replace', claimedMemberId: 'p1' }),
      expect.anything(),
    );
  });

  it('"just add them" with placeholders present → add (no merge)', () => {
    mockUseRequests.mockReturnValue({
      data: [{ ...baseReq, has_open_placeholders: true }],
      isLoading: false,
    });
    mockUsePlaceholders.mockReturnValue({
      data: [{ member_id: 'p1', display_name: 'J. Quick (PP)', has_stats: false }],
      isLoading: false,
    });
    render(<JoinRequestList />);
    fireEvent.click(screen.getByRole('button', { name: /just add them to the team/i }));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'r1', action: 'add' }),
      expect.anything(),
    );
  });

  it('Decline confirms before mutating', () => {
    render(<JoinRequestList />);
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
