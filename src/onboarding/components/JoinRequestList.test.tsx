/**
 * @fileoverview Tests for the approve surface (JoinRequestList).
 *
 * Verifies the row controls and the two guards: Replace only appears when the
 * team has open placeholders; Add is one tap when none, but asks to confirm
 * "brand-new player" when placeholders still exist (the strand-a-record guard);
 * Decline always confirms. The data + approve hooks and the picker are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ApproverJoinRequest } from '@/api/queries/teamJoin';

const mockUseRequests = vi.fn();
const mockMutate = vi.fn();

vi.mock('@/api/hooks/useTeamJoinRequests', () => ({
  useTeamJoinRequests: () => mockUseRequests(),
}));
vi.mock('@/api/hooks/useApproveJoinRequest', () => ({
  useApproveJoinRequest: () => ({ mutate: mockMutate, isPending: false }),
}));
vi.mock('./PlaceholderPicker', () => ({
  PlaceholderPicker: () => <div>placeholder-picker</div>,
}));

import { JoinRequestList } from './JoinRequestList';

const baseReq: ApproverJoinRequest = {
  request_id: 'r1',
  team_id: 't1',
  team_name: 'The Break Room',
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
});

describe('JoinRequestList', () => {
  it('renders nothing when the feed is empty (no emptyHint)', () => {
    mockUseRequests.mockReturnValue({ data: [], isLoading: false });
    const { container } = render(<JoinRequestList />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the person, team, and league with Add + Decline', () => {
    render(<JoinRequestList />);
    expect(screen.getByText('Jordan Quick')).toBeInTheDocument();
    expect(screen.getByText(/The Break Room · Tuesday Eight-ball/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
  });

  it('hides Replace when the team has no open placeholders', () => {
    render(<JoinRequestList />);
    expect(screen.queryByRole('button', { name: 'Replace' })).not.toBeInTheDocument();
  });

  it('Add is one tap when there are no placeholders', () => {
    render(<JoinRequestList />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'r1', action: 'add' }),
      expect.anything()
    );
  });

  it('Add asks to confirm when placeholders still exist', () => {
    mockUseRequests.mockReturnValue({
      data: [{ ...baseReq, has_open_placeholders: true }],
      isLoading: false,
    });
    render(<JoinRequestList />);
    // Replace is now offered…
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument();
    // …and Add opens the confirm rather than mutating immediately.
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(mockMutate).not.toHaveBeenCalled();
    expect(screen.getByText(/brand-new player/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add as new' }));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'r1', action: 'add' }),
      expect.anything()
    );
  });

  it('Decline confirms before mutating', () => {
    render(<JoinRequestList />);
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    expect(mockMutate).not.toHaveBeenCalled();
    // The confirm dialog's action button.
    const declineButtons = screen.getAllByRole('button', { name: 'Decline' });
    fireEvent.click(declineButtons[declineButtons.length - 1]);
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'r1', action: 'decline' }),
      expect.anything()
    );
  });
});
