/**
 * @fileoverview Tests for the /join/:token orchestrator state machine.
 *
 * Verifies TeamJoinPage routes to the correct step for each combination of
 * (join view, auth state, member state). The data hooks and the heavier child
 * steps are mocked at the module boundary so this exercises only the routing
 * logic — the steps and RPCs are covered by their own tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { TeamJoinView } from '@/api/queries/teamJoin';

const mockUseTeamJoinView = vi.fn();
const mockUseUser = vi.fn();
const mockUseUserProfile = vi.fn();

vi.mock('@/api/hooks/useTeamJoinView', () => ({
  useTeamJoinView: () => mockUseTeamJoinView(),
}));
vi.mock('@/context/useUser', () => ({ useUser: () => mockUseUser() }));
vi.mock('@/api/hooks/useUserProfile', () => ({
  useUserProfile: () => mockUseUserProfile(),
}));

// Stub the heavier steps so we assert *which* one rendered, not their innards.
vi.mock('./components/JoinSignInStep', () => ({
  JoinSignInStep: () => <div>signin-step</div>,
}));
vi.mock('./components/JoinSubmitStep', () => ({
  JoinSubmitStep: () => <div>submit-step</div>,
}));
vi.mock('@/completeProfile/CompleteProfileForm', () => ({
  CompleteProfileForm: () => <div>profile-form</div>,
}));

import { TeamJoinPage } from './TeamJoinPage';

const FOUND: TeamJoinView = {
  found: true,
  team_id: 'team-1',
  team_name: 'The Break Room',
  league_name: 'Tuesday Eight-ball',
  roster_size: 5,
  spots: [],
  viewer_request_status: null,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/join/tok-123']}>
      <Routes>
        <Route path="/join/:token" element={<TeamJoinPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Sensible defaults; each test overrides what it cares about.
  mockUseTeamJoinView.mockReturnValue({ data: FOUND, isLoading: false, isError: false });
  mockUseUser.mockReturnValue({ isLoggedIn: false });
  mockUseUserProfile.mockReturnValue({ member: null, loading: false });
});

describe('TeamJoinPage routing', () => {
  it('shows a loading card while the view loads', () => {
    mockUseTeamJoinView.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderPage();
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('shows an invalid-link card when the token is not found', () => {
    mockUseTeamJoinView.mockReturnValue({
      data: { found: false },
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByText(/isn't valid/i)).toBeInTheDocument();
  });

  it('shows the "you\'re in" card when already approved', () => {
    mockUseTeamJoinView.mockReturnValue({
      data: { ...FOUND, viewer_request_status: 'approved' },
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByText(/on the team/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go to my team/i })).toBeInTheDocument();
  });

  it('shows the waiting card when a request is pending', () => {
    mockUseTeamJoinView.mockReturnValue({
      data: { ...FOUND, viewer_request_status: 'pending' },
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByText(/on the list/i)).toBeInTheDocument();
  });

  it('shows the sign-in step when not logged in', () => {
    mockUseUser.mockReturnValue({ isLoggedIn: false });
    renderPage();
    expect(screen.getByText('signin-step')).toBeInTheDocument();
  });

  it('shows the profile form when logged in without a member row', () => {
    mockUseUser.mockReturnValue({ isLoggedIn: true });
    mockUseUserProfile.mockReturnValue({ member: null, loading: false });
    renderPage();
    expect(screen.getByText('profile-form')).toBeInTheDocument();
  });

  it('shows the submit step when logged in and registered', () => {
    mockUseUser.mockReturnValue({ isLoggedIn: true });
    mockUseUserProfile.mockReturnValue({ member: { id: 'm1' }, loading: false });
    renderPage();
    expect(screen.getByText('submit-step')).toBeInTheDocument();
  });
});
