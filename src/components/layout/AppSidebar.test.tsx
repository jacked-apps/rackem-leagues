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

describe('AppSidebar — My Match entry', () => {
  it('renders the player nav with My Match as a button (no static /my-match link) at Tier 4', () => {
    renderSidebar();

    expect(screen.getByRole('link', { name: 'My Teams' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'My Match' })).not.toBeInTheDocument();
    const btn = screen.getByRole('button', { name: 'My Match' });
    expect(btn).toHaveAttribute('aria-disabled', 'true');
  });

  it('Tier 1: links to the match lineup, marks active, shows the live indicator', () => {
    mockUseMyMatchSurfaces.mockReturnValue(
      surfaces({ tier: 1, destinationMatchId: 'm1', showLiveDot: true }),
    );

    renderSidebar('/match/m1/lineup');

    const link = screen.getByRole('link', { name: /my match/i });
    expect(link).toHaveAttribute('href', '/match/m1/lineup');
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('live match in progress')).toBeInTheDocument();
  });

  it('Tier 2/3: links to the lineup with no live indicator', () => {
    mockUseMyMatchSurfaces.mockReturnValue(
      surfaces({ tier: 2, destinationMatchId: 'm2', showLiveDot: false }),
    );

    renderSidebar();

    const link = screen.getByRole('link', { name: 'My Match' });
    expect(link).toHaveAttribute('href', '/match/m2/lineup');
    expect(screen.queryByText('live match in progress')).not.toBeInTheDocument();
  });

  it('Tier 4: dim button that toasts on tap, no navigation', () => {
    renderSidebar();

    const btn = screen.getByRole('button', { name: 'My Match' });
    fireEvent.click(btn);
    expect(toastMock).toHaveBeenCalledWith('No current matches');
  });

  it('Hydrating: neutral button, NOT aria-disabled, tap is a silent no-op', () => {
    mockUseMyMatchSurfaces.mockReturnValue(surfaces({ isHydrating: true }));

    renderSidebar();

    const btn = screen.getByRole('button', { name: 'My Match' });
    expect(btn.getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(btn);
    expect(toastMock).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it('Error: dim button that fires an error toast on tap', () => {
    mockUseMyMatchSurfaces.mockReturnValue(surfaces({ isError: true }));

    renderSidebar();

    const btn = screen.getByRole('button', { name: 'My Match' });
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(btn);
    expect(toastMock.error).toHaveBeenCalledTimes(1);
  });
});
