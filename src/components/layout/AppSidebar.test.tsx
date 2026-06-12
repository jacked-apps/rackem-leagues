/**
 * @fileoverview Tests for the desktop AppSidebar's My Match entry (Unit 5).
 *
 * Focuses on the state-driven My Match entry that replaced the old static
 * `/my-match` link: actionable tiers render a Link to the match lineup (with a
 * live dot + sr-only label on Tier 1), while the non-actionable postures render
 * a non-navigating button — silent while hydrating, dim + toast on Tier 4 /
 * error. Mirrors the bottom-nav tab's behavior on the desktop surface.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/utils';

const mockUseUserProfile = vi.fn();
const mockUseOrganizations = vi.fn();
const mockUseUnreadMessageCount = vi.fn();
const mockUsePendingJoinRequestCount = vi.fn();
const mockUseMyMatchSurfaces = vi.fn();

vi.mock('@/api/hooks/useUserProfile', () => ({
  useUserProfile: () => mockUseUserProfile(),
}));
vi.mock('@/api/hooks/useOrganizations', () => ({
  useOrganizations: (id?: string) => mockUseOrganizations(id),
}));
vi.mock('@/api/hooks/useMessages', () => ({
  useUnreadMessageCount: (id?: string) => mockUseUnreadMessageCount(id),
}));
vi.mock('@/api/hooks/usePendingJoinRequestCount', () => ({
  usePendingJoinRequestCount: () => mockUsePendingJoinRequestCount(),
}));
vi.mock('@/api/hooks/useMyMatchSurfaces', () => ({
  useMyMatchSurfaces: (id?: string) => mockUseMyMatchSurfaces(id),
}));

const { toastMock } = vi.hoisted(() => {
  const fn: any = vi.fn();
  fn.error = vi.fn();
  return { toastMock: fn };
});
vi.mock('sonner', () => ({ toast: toastMock }));

import { AppSidebar } from './AppSidebar';

/** Default surfaces shape (Tier 4); spread overrides per test. */
function surfaces(o: Record<string, unknown> = {}) {
  return {
    tier: 4,
    destinationMatchId: null,
    showLiveDot: false,
    drawerItems: [],
    isHydrating: false,
    isError: false,
    ...o,
  };
}

function renderSidebar(initialRoute?: string) {
  return renderWithProviders(<AppSidebar />, {
    userContext: { isLoggedIn: true },
    initialRoute,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseUserProfile.mockReturnValue({
    member: { id: 'm1', first_name: 'Pat', last_name: 'Player' },
    canAccessLeagueOperatorFeatures: () => false,
  });
  mockUseOrganizations.mockReturnValue({ organizations: [] });
  mockUseUnreadMessageCount.mockReturnValue({ data: 0 });
  mockUsePendingJoinRequestCount.mockReturnValue(0);
  mockUseMyMatchSurfaces.mockReturnValue(surfaces());
});

describe('AppSidebar — My Match panel', () => {
  // The sidebar now mirrors the drawer via the shared MyMatchPanel. Detailed
  // chip/list behavior is covered by AppDrawer.test; here we just confirm the
  // panel is wired into the sidebar (and the old single link is gone).

  it('renders the My Match panel with chips + matchup for a live match', () => {
    mockUseMyMatchSurfaces.mockReturnValue(
      surfaces({
        drawerItems: [
          { matchId: 'm1', teamName: 'Sharks', opponentName: 'Cues', rowDetail: '', group: 'live', destinationPath: '/match/m1/lineup' },
        ],
      }),
    );

    renderSidebar();

    expect(screen.getByText('My Match')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Live/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: /Sharks/ })).toHaveAttribute('href', '/match/m1/lineup');
  });

  it('switches to the Makeup list when its chip is tapped', () => {
    mockUseMyMatchSurfaces.mockReturnValue(
      surfaces({
        drawerItems: [
          { matchId: 'm1', teamName: 'Sharks', opponentName: 'Cues', rowDetail: '', group: 'live', destinationPath: '/match/m1/lineup' },
          { matchId: 'm2', teamName: 'Rails', opponentName: 'Felt', rowDetail: '6/11', group: 'makeup', destinationPath: '/match/m2/lineup' },
        ],
      }),
    );

    renderSidebar();

    expect(screen.queryByRole('link', { name: /Rails/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Makeup/ }));
    expect(screen.getByRole('link', { name: /Rails/ })).toHaveAttribute('href', '/match/m2/lineup');
  });

  it('hides the My Match panel entirely when there are no matches', () => {
    renderSidebar(); // default: no drawerItems
    expect(screen.queryByText('My Match')).not.toBeInTheDocument();
    // The old static /my-match nav link is gone.
    expect(screen.queryByRole('link', { name: 'My Match' })).not.toBeInTheDocument();
  });
});
