/**
 * @fileoverview Unit tests for the global AppDrawer.
 *
 * Covers role-aware section rendering (logged-out / player / operator),
 * position-based owner-vs-staff classification, the cap-at-4 + overflow,
 * single-org flat layout vs multi-org collapsible layout, drawer-internal
 * `(N)` badges for unread messages and pending reports, loading/error
 * graceful fallbacks, and SheetClose-driven dismissal on link tap.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { renderWithProviders, screen, userEvent, within } from '@/test/utils';

// Mock the data-fetching hooks used by AppDrawer. The drawer's role/auth
// branching is driven by these return values; controlling them per test lets
// us exercise every branch deterministically without hitting the network.
const mockUseUserProfile = vi.fn();
const mockUseOrganizations = vi.fn();
const mockUseUnreadMessageCount = vi.fn();
const mockUsePendingReportsCount = vi.fn();

vi.mock('@/api/hooks/useUserProfile', () => ({
  useUserProfile: () => mockUseUserProfile(),
}));

vi.mock('@/api/hooks/useOrganizations', () => ({
  useOrganizations: (memberId?: string) => mockUseOrganizations(memberId),
}));

vi.mock('@/api/hooks/useMessages', () => ({
  useUnreadMessageCount: (memberId?: string) => mockUseUnreadMessageCount(memberId),
}));

vi.mock('@/hooks/usePendingReportsCount', () => ({
  usePendingReportsCount: (orgId?: string) => mockUsePendingReportsCount(orgId),
}));

import { AppDrawer } from './AppDrawer';

/** Renders AppDrawer inside an open Sheet so SheetClose etc. work. */
function renderDrawer(opts?: { isLoggedIn?: boolean }) {
  const onOpenChange = vi.fn();
  const view = renderWithProviders(
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent side="left">
        <AppDrawer open onOpenChange={onOpenChange} />
      </SheetContent>
    </Sheet>,
    {
      userContext: {
        isLoggedIn: opts?.isLoggedIn ?? true,
        logout: vi.fn(),
      },
    },
  );
  return { ...view, onOpenChange };
}

/** Default mocks for a logged-in player with no operator role and no orgs. */
function configurePlayer() {
  mockUseUserProfile.mockReturnValue({
    member: { id: 'm1', first_name: 'Pat', last_name: 'Player' },
    canAccessLeagueOperatorFeatures: () => false,
    loading: false,
  });
  mockUseOrganizations.mockReturnValue({ organizations: [], loading: false, error: null });
  mockUseUnreadMessageCount.mockReturnValue({ data: 0 });
  mockUsePendingReportsCount.mockReturnValue({ count: 0, loading: false });
}

/** Default mocks for a logged-out visitor. */
function configureLoggedOut() {
  mockUseUserProfile.mockReturnValue({
    member: null,
    canAccessLeagueOperatorFeatures: () => false,
    loading: false,
  });
  mockUseOrganizations.mockReturnValue({ organizations: [], loading: false, error: null });
  mockUseUnreadMessageCount.mockReturnValue({ data: 0 });
  mockUsePendingReportsCount.mockReturnValue({ count: 0, loading: false });
}

describe('AppDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Happy path — logged out
  it('renders public items when logged out', () => {
    configureLoggedOut();
    renderDrawer({ isLoggedIn: false });

    const nav = screen.getByRole('navigation', { name: /main navigation/i });
    expect(within(nav).getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'About' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Pricing' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Rules' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });

  it('does not render player or operator sections when logged out', () => {
    configureLoggedOut();
    renderDrawer({ isLoggedIn: false });

    const nav = screen.getByRole('navigation', { name: /main navigation/i });
    expect(within(nav).queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(within(nav).queryByText(/^Operator$/)).not.toBeInTheDocument();
  });

  // Happy path — logged-in player
  it('renders the player root items when logged in as a non-operator', () => {
    configurePlayer();
    renderDrawer();

    const nav = screen.getByRole('navigation', { name: /main navigation/i });
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'My Teams' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Stats' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Rules' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /^Messages/ })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Profile' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  // Happy path — single-org operator
  it('renders flat operator shortcuts for a single-org operator', () => {
    mockUseUserProfile.mockReturnValue({
      member: { id: 'm1', first_name: 'Op', last_name: 'Solo' },
      canAccessLeagueOperatorFeatures: () => true,
      loading: false,
    });
    mockUseOrganizations.mockReturnValue({
      organizations: [{ id: 'org-a', organization_name: 'Triple B Pool', position: 'owner' }],
      loading: false,
      error: null,
    });
    mockUseUnreadMessageCount.mockReturnValue({ data: 0 });
    mockUsePendingReportsCount.mockReturnValue({ count: 0, loading: false });

    renderDrawer();

    expect(screen.getByText('Operator')).toBeInTheDocument();
    // Two "Dashboard" links exist: the player section one (/dashboard) and the
    // org-scoped operator one (/operator-dashboard/org-a). Match each by href.
    const dashboardLinks = screen.getAllByRole('link', { name: 'Dashboard' });
    expect(dashboardLinks.map((l) => l.getAttribute('href'))).toEqual(
      expect.arrayContaining(['/dashboard', '/operator-dashboard/org-a']),
    );
    expect(screen.getByRole('link', { name: 'Create League' })).toHaveAttribute(
      'href',
      '/create-league/org-a',
    );
    expect(screen.getByRole('link', { name: 'Reports' })).toHaveAttribute(
      'href',
      '/operator-reports/org-a',
    );
  });

  // Happy path — multi-org operator
  it('renders multi-org operator section with collapsed-by-default groups', async () => {
    mockUseUserProfile.mockReturnValue({
      member: { id: 'm1', first_name: 'Op', last_name: 'Multi' },
      canAccessLeagueOperatorFeatures: () => true,
      loading: false,
    });
    mockUseOrganizations.mockReturnValue({
      organizations: [
        { id: 'org-a', organization_name: 'Triple B Pool', position: 'owner' },
        { id: 'org-b', organization_name: 'Riverside League', position: 'admin' },
      ],
      loading: false,
      error: null,
    });
    mockUseUnreadMessageCount.mockReturnValue({ data: 0 });
    mockUsePendingReportsCount.mockReturnValue({ count: 0, loading: false });

    renderDrawer();

    expect(screen.getByText('Operator')).toBeInTheDocument();
    // Both org names show as collapsible group headers.
    expect(screen.getByText('Triple B Pool')).toBeInTheDocument();
    expect(screen.getByText('Riverside League')).toBeInTheDocument();

    // Owners are listed before staff. Triple B Pool (owner) comes before Riverside (admin).
    const orgHeaders = screen.getAllByRole('group');
    expect(orgHeaders[0]).toHaveTextContent('Triple B Pool');
    expect(orgHeaders[1]).toHaveTextContent('Riverside League');

    // Sub-items are not visible until the group is expanded (collapsed by default).
    const tripleBSummary = screen.getByText('Triple B Pool').closest('summary')!;
    expect(tripleBSummary.parentElement).not.toHaveAttribute('open');
  });

  // Edge case — unread messages badge
  it('shows "(N)" suffix on Messages when unread > 0', () => {
    configurePlayer();
    mockUseUnreadMessageCount.mockReturnValue({ data: 4 });

    renderDrawer();

    expect(screen.getByRole('link', { name: 'Messages (4)' })).toBeInTheDocument();
  });

  it('shows no badge on Messages when unread is 0', () => {
    configurePlayer();
    mockUseUnreadMessageCount.mockReturnValue({ data: 0 });

    renderDrawer();

    expect(screen.getByRole('link', { name: 'Messages' })).toBeInTheDocument();
    expect(screen.queryByText(/Messages \(/)).not.toBeInTheDocument();
  });

  // Edge case — pending reports badge
  it('shows "(N)" suffix on Reports when pending > 0', () => {
    mockUseUserProfile.mockReturnValue({
      member: { id: 'm1', first_name: 'Op', last_name: 'X' },
      canAccessLeagueOperatorFeatures: () => true,
      loading: false,
    });
    mockUseOrganizations.mockReturnValue({
      organizations: [{ id: 'org-a', organization_name: 'TripleB', position: 'owner' }],
      loading: false,
      error: null,
    });
    mockUseUnreadMessageCount.mockReturnValue({ data: 0 });
    mockUsePendingReportsCount.mockReturnValue({ count: 3, loading: false });

    renderDrawer();

    expect(screen.getByRole('link', { name: 'Reports (3)' })).toBeInTheDocument();
  });

  // Edge case — overflow with cap-at-4
  it('caps the operator section at 4 orgs and shows "More on Dashboard" overflow link', () => {
    mockUseUserProfile.mockReturnValue({
      member: { id: 'm1', first_name: 'Op', last_name: 'Many' },
      canAccessLeagueOperatorFeatures: () => true,
      loading: false,
    });
    mockUseOrganizations.mockReturnValue({
      organizations: [
        { id: 'o1', organization_name: 'Owned A', position: 'owner' },
        { id: 'o2', organization_name: 'Staff Alpha', position: 'admin' },
        { id: 'o3', organization_name: 'Staff Bravo', position: 'admin' },
        { id: 'o4', organization_name: 'Staff Charlie', position: 'league_rep' },
        { id: 'o5', organization_name: 'Staff Delta', position: 'admin' },
        { id: 'o6', organization_name: 'Staff Echo', position: 'admin' },
      ],
      loading: false,
      error: null,
    });
    mockUseUnreadMessageCount.mockReturnValue({ data: 0 });
    mockUsePendingReportsCount.mockReturnValue({ count: 0, loading: false });

    renderDrawer();

    // Owner first, then alphabetical staff. Visible: Owned A, Staff Alpha, Staff Bravo, Staff Charlie.
    expect(screen.getByText('Owned A')).toBeInTheDocument();
    expect(screen.getByText('Staff Alpha')).toBeInTheDocument();
    expect(screen.getByText('Staff Bravo')).toBeInTheDocument();
    expect(screen.getByText('Staff Charlie')).toBeInTheDocument();
    // Cut off:
    expect(screen.queryByText('Staff Delta')).not.toBeInTheDocument();
    expect(screen.queryByText('Staff Echo')).not.toBeInTheDocument();
    // Overflow link to /dashboard:
    expect(screen.getByRole('link', { name: /more on dashboard/i })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });

  // Edge case — operator with 0 owned orgs renders staff orgs only (no owner section)
  it('renders staff orgs without an owner section when the operator owns nothing', () => {
    mockUseUserProfile.mockReturnValue({
      member: { id: 'm1', first_name: 'Op', last_name: 'Staff' },
      canAccessLeagueOperatorFeatures: () => true,
      loading: false,
    });
    mockUseOrganizations.mockReturnValue({
      organizations: [
        { id: 'o1', organization_name: 'Beta League', position: 'admin' },
        { id: 'o2', organization_name: 'Alpha League', position: 'league_rep' },
      ],
      loading: false,
      error: null,
    });
    mockUseUnreadMessageCount.mockReturnValue({ data: 0 });
    mockUsePendingReportsCount.mockReturnValue({ count: 0, loading: false });

    renderDrawer();

    // Two collapsible group headers, alphabetical: Alpha then Beta.
    expect(screen.getByText('Alpha League')).toBeInTheDocument();
    expect(screen.getByText('Beta League')).toBeInTheDocument();
    // No "More on Dashboard" because we're under cap.
    expect(screen.queryByText(/more on dashboard/i)).not.toBeInTheDocument();
  });

  // Edge case — orgs loading
  it('omits the operator section while organizations are loading', () => {
    mockUseUserProfile.mockReturnValue({
      member: { id: 'm1', first_name: 'Op', last_name: 'X' },
      canAccessLeagueOperatorFeatures: () => true,
      loading: false,
    });
    mockUseOrganizations.mockReturnValue({ organizations: [], loading: true, error: null });
    mockUseUnreadMessageCount.mockReturnValue({ data: 0 });
    mockUsePendingReportsCount.mockReturnValue({ count: 0, loading: false });

    renderDrawer();

    // Player section still renders; Operator heading is absent until orgs load.
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.queryByText('Operator')).not.toBeInTheDocument();
  });

  // Integration — sign out closes drawer and calls logout
  it('Sign out button closes the drawer and calls logout', async () => {
    const user = userEvent.setup();
    const logoutSpy = vi.fn();
    configurePlayer();

    const onOpenChange = vi.fn();
    renderWithProviders(
      <Sheet open onOpenChange={onOpenChange}>
        <SheetContent side="left">
          <AppDrawer open onOpenChange={onOpenChange} />
        </SheetContent>
      </Sheet>,
      {
        userContext: {
          isLoggedIn: true,
          logout: logoutSpy,
        },
      },
    );

    await user.click(screen.getByRole('button', { name: /sign out/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(logoutSpy).toHaveBeenCalled();
  });
});
