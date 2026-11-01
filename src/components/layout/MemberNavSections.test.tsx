/**
 * @fileoverview Tests for the grouped signed-in menu (`MemberNavSections`),
 * which both the desktop sidebar and the phone drawer render.
 *
 * Covers the block order, folds starting closed and remembering their state,
 * the Info "(New)" marker, the doorbells in the core block (Season Re-Up used
 * to be drawer-only), Favorites hidden while empty, and `splitNavEntries`. Drawer-specific behaviour
 * (SheetClose, signed-out list, operator orgs) stays in AppDrawer.test.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/utils';

const mockReup = vi.fn();
const mockUnseen = vi.fn();
const mockJoinCount = vi.fn();

vi.mock('@/api/hooks/useUserProfile', () => ({
  useUserProfile: () => ({
    member: { id: 'm1', first_name: 'Pat', last_name: 'Player' },
    canAccessLeagueOperatorFeatures: () => false,
  }),
}));
vi.mock('@/api/hooks/useOrganizations', () => ({ useOrganizations: () => ({ organizations: [] }) }));
vi.mock('@/api/hooks/useMessages', () => ({ useUnreadMessageCount: () => ({ data: 0 }) }));
vi.mock('@/api/hooks/usePendingJoinRequestCount', () => ({ usePendingJoinRequestCount: () => mockJoinCount() }));
vi.mock('@/hooks/useCaptainReupPrompt', () => ({ useCaptainReupPrompt: () => mockReup() }));
vi.mock('@/whatsNew/useWhatsNewSeen', () => ({ useHasUnseenWhatsNew: () => mockUnseen() }));
vi.mock('@/api/hooks/useMyMatchSurfaces', () => ({
  useMyMatchSurfaces: () => ({ drawerItems: [], isHydrating: false }),
}));

import { MemberNavSections } from './MemberNavSections';
import { splitNavEntries } from './navEntries';

const renderMenu = () => renderWithProviders(<MemberNavSections />, { userContext: { isLoggedIn: true } });

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mockReup.mockReturnValue({ data: [] });
  mockUnseen.mockReturnValue(false);
  mockJoinCount.mockReturnValue(0);
});

describe('MemberNavSections', () => {
  it('puts My Teams + Messages first, then the Extras and Info folds; no empty Favorites', () => {
    renderMenu();
    const order = screen
      .getAllByText(/^(My Teams|Messages|Favorites|Extras|Info)$/)
      .map((el) => el.textContent);
    expect(order).toEqual(['My Teams', 'Messages', 'Extras', 'Info']);
  });

  it('starts folds closed and remembers a fold left open', () => {
    const first = renderMenu();
    expect(screen.queryByRole('link', { name: 'Rules' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Info' }));
    expect(screen.getByRole('link', { name: 'Rules' })).toBeInTheDocument();
    first.unmount();

    renderMenu();
    expect(screen.getByRole('link', { name: 'Rules' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Stats' })).not.toBeInTheDocument();
  });

  it('marks the folded Info heading "(New)" when What\'s New is unseen', () => {
    mockUnseen.mockReturnValue(true);
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Info (New)' }));
    expect(screen.getByRole('link', { name: "What's New (New)" })).toBeInTheDocument();
  });

  it('adds Season Re-Up and Join requests under My Teams + Messages when they apply', () => {
    mockReup.mockReturnValue({ data: [{ id: 't1' }, { id: 't2' }] });
    mockJoinCount.mockReturnValue(2);
    renderMenu();
    expect(screen.getByRole('link', { name: 'Season Re-Up (2)' })).toHaveAttribute('href', '/reup');
    expect(screen.getByRole('link', { name: 'Join requests (2)' })).toHaveAttribute('href', '/my-teams');
  });
});

describe('splitNavEntries', () => {
  it('moves a favorite out of its fold and ignores unknown ids', () => {
    // 'my-teams' is core — it can't be a favorite, so it's ignored too.
    const { favorites, info } = splitNavEntries(['rules', 'gone-page', 'my-teams']);
    expect(favorites.map((e) => e.id)).toEqual(['rules']);
    expect(info.map((e) => e.id)).toEqual(['home', 'learn', 'whats-new', 'about']);
  });
});
