/**
 * @fileoverview Unit tests for the new PageHeader.
 *
 * Covers: hamburger trigger + lazy-mounted drawer, conditional back button
 * behavior (none / `backTo` / `onBackClick`), title rendering, sub-header
 * scroll-with-content rendering (subtitle, org badge, decorative children),
 * the right-side identity slot (avatar when logged in, Sign-in when logged
 * out, suppressed on auth-flow routes), and the location-change drawer-close
 * effect.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils';

// Mock the data hooks. PageHeader uses useUser (mocked through user context),
// useUserProfile (for the identity slot), and useOrganization (for the badge).
const mockUseUserProfile = vi.fn();
const mockUseOrganization = vi.fn();

vi.mock('@/api/hooks/useUserProfile', () => ({
  useUserProfile: () => mockUseUserProfile(),
}));

vi.mock('@/api/hooks/useOrganizations', () => ({
  useOrganization: (orgId?: string) => mockUseOrganization(orgId),
}));

// Stub AppDrawer — we test its content separately. Here we only need to know
// that the drawer mounts when the Sheet opens (lazy-mount contract) and the
// content shows up in the dialog.
vi.mock('@/components/layout/AppDrawer', () => ({
  AppDrawer: ({ open }: { open: boolean }) => (
    <div data-testid="app-drawer">drawer mounted (open={String(open)})</div>
  ),
}));

import { PageHeader } from './PageHeader';

function renderHeader(
  ui: React.ReactNode,
  opts?: { isLoggedIn?: boolean; initialRoute?: string },
) {
  return renderWithProviders(<>{ui}</>, {
    userContext: {
      isLoggedIn: opts?.isLoggedIn ?? true,
    },
    initialRoute: opts?.initialRoute,
  });
}

function configureProfile(overrides: { firstName?: string; lastName?: string } = {}) {
  mockUseUserProfile.mockReturnValue({
    member: {
      id: 'm1',
      first_name: overrides.firstName ?? 'Pat',
      last_name: overrides.lastName ?? 'Player',
    },
  });
}

describe('PageHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOrganization.mockReturnValue({ organization: null, loading: false, error: null });
    configureProfile();
  });

  it('renders the title in the sticky bar', () => {
    renderHeader(<PageHeader title="Team Schedule" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Team Schedule' })).toBeInTheDocument();
  });

  it('renders the hamburger trigger with an accessible label', () => {
    renderHeader(<PageHeader title="Home" />);
    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
  });

  it('does not render the back button when no backTo or onBackClick is set', () => {
    renderHeader(<PageHeader title="Home" />);
    expect(screen.queryByRole('link', { name: /back/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^back/i })).not.toBeInTheDocument();
  });

  it('renders a back link with backLabel as accessible name when backTo is set', () => {
    renderHeader(
      <PageHeader title="Triple B Stars" backTo="/my-teams" backLabel="Back to My Teams" />,
    );
    const link = screen.getByRole('link', { name: 'Back to My Teams' });
    expect(link).toHaveAttribute('href', '/my-teams');
  });

  it('renders a back button when onBackClick is set (no backTo)', async () => {
    const user = userEvent.setup();
    const onBackClick = vi.fn();
    renderHeader(<PageHeader title="Edit" onBackClick={onBackClick} backLabel="Cancel edit" />);

    const backBtn = screen.getByRole('button', { name: 'Cancel edit' });
    await user.click(backBtn);
    expect(onBackClick).toHaveBeenCalledTimes(1);
  });

  it('hides the back button when hideBack is true even with backTo set', () => {
    renderHeader(<PageHeader title="x" backTo="/y" backLabel="Back" hideBack />);
    expect(screen.queryByRole('link', { name: /back/i })).not.toBeInTheDocument();
  });

  it('renders subtitle below the sticky bar (scrolls with content)', () => {
    renderHeader(<PageHeader title="Schedule" subtitle="Mondays" />);
    expect(screen.getByText('Mondays')).toBeInTheDocument();
  });

  it('renders the organization badge when organizationId resolves', () => {
    mockUseOrganization.mockReturnValue({
      organization: { organization_name: 'Triple B Pool' },
      loading: false,
      error: null,
    });
    renderHeader(<PageHeader title="League X" organizationId="org-a" />);
    expect(screen.getByText('Triple B Pool')).toBeInTheDocument();
  });

  it('renders decorative children below the sticky bar', () => {
    renderHeader(
      <PageHeader title="Setup">
        <div data-testid="info-chip">format: 5-Man</div>
      </PageHeader>,
    );
    expect(screen.getByTestId('info-chip')).toBeInTheDocument();
  });

  // The avatar/initials link used to live in PageHeader's right
  // identity slot. The 2026-05 nav overhaul moved profile access to
  // the sidebar (desktop) + bottom tab bar (mobile), so PageHeader
  // no longer renders it. Profile-link coverage now lives in the
  // AppDrawer + sidebar tests instead.

  it('shows the Sign in button when logged out on a non-auth-flow route', () => {
    renderHeader(<PageHeader title="Home" />, { isLoggedIn: false, initialRoute: '/' });
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
  });

  it('suppresses the right-slot Sign-in button on auth-flow routes', () => {
    renderHeader(<PageHeader title="Sign in" />, { isLoggedIn: false, initialRoute: '/login' });
    expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument();
    // Hamburger remains available.
    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
  });

  it('lazy-mounts the AppDrawer only when the Sheet is open', async () => {
    const user = userEvent.setup();
    renderHeader(<PageHeader title="x" />);

    // Drawer is not in the DOM until the hamburger is tapped.
    expect(screen.queryByTestId('app-drawer')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /open menu/i }));

    expect(await screen.findByTestId('app-drawer')).toBeInTheDocument();
  });

  // Note: the "drawer closes on programmatic navigation" effect (4-line
  // useEffect on location.pathname) is intentionally not unit-tested here —
  // happy-dom + BrowserRouter shares window.history across tests, making
  // navigation timing brittle. The effect is exercised by the Playwright e2e
  // landing in Unit 9.
});
