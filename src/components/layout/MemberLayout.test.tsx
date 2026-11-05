/**
 * @fileoverview MemberLayout shows the menu (desktop sidebar + phone tab bar)
 * to signed-in members only.
 *
 * Public pages (Home, Rules, What's New…) sit inside this layout so members
 * keep their menu there. A signed-out visitor used to get an empty sidebar
 * and tabs that bounced to sign-in; now they get neither (Ed, 2026-11-01).
 * While the session is still being checked the menu stays, so a member's
 * page doesn't jump sideways on refresh.
 *
 * The sidebar, tab bar and the two onboarding modals are stubbed — this file
 * is only about whether the layout mounts them.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';

vi.mock('./AppSidebar', () => ({ AppSidebar: () => <div>sidebar</div> }));
vi.mock('./BottomTabBar', () => ({ BottomTabBar: () => <div>tab bar</div> }));
vi.mock('@/components/modals/PendingInvitesModal', () => ({ PendingInvitesModal: () => null }));
vi.mock('@/components/modals/ApprovedJoinModal', () => ({ ApprovedJoinModal: () => null }));
vi.mock('@/api/hooks', () => ({
  usePendingInvites: () => ({ pendingInvites: [], hasPendingInvites: false, loading: false }),
}));
vi.mock('@/api/hooks/useApprovedJoinRequests', () => ({
  useApprovedJoinRequests: () => ({ data: [] }),
  useAcknowledgeJoinRequest: () => ({ mutate: vi.fn() }),
}));

import { MemberLayout } from './MemberLayout';

const render = (userContext: { isLoggedIn: boolean; loading?: boolean }) =>
  renderWithProviders(<MemberLayout />, { userContext });

describe('MemberLayout menu', () => {
  it('shows the sidebar and tab bar to a signed-in member', () => {
    render({ isLoggedIn: true });
    expect(screen.getByText('sidebar')).toBeInTheDocument();
    expect(screen.getByText('tab bar')).toBeInTheDocument();
  });

  it('shows neither to a signed-out visitor', () => {
    render({ isLoggedIn: false });
    expect(screen.queryByText('sidebar')).not.toBeInTheDocument();
    expect(screen.queryByText('tab bar')).not.toBeInTheDocument();
  });

  it('keeps the menu while the session is still being checked', () => {
    render({ isLoggedIn: false, loading: true });
    expect(screen.getByText('sidebar')).toBeInTheDocument();
  });
});
