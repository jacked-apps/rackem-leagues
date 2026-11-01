/**
 * @fileoverview Tests for the grouped signed-in menu (`MemberNavSections`),
 * which both the desktop sidebar and the phone drawer render.
 *
 * Covers the block order, folds (closed at start, one open at a time, closed
 * again after navigating), the Info "(New)" marker, the doorbells in the core
 * block (Season Re-Up used to be drawer-only), Favorites hidden while empty,
 * starring, and `splitNavEntries`. Drawer-specific behaviour (SheetClose,
 * signed-out list, operator orgs) stays in AppDrawer.test.
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
// Saving is covered by useNavFavorites.test; here we drive the list directly.
const mockFavoriteIds = vi.fn();
const mockToggle = vi.fn();
vi.mock('@/api/hooks/useNavFavorites', () => ({
  useNavFavorites: () => ({ favoriteIds: mockFavoriteIds(), toggleFavorite: mockToggle }),
}));

import { MemberNavSections } from './MemberNavSections';
import { splitNavEntries } from './navEntries';

const renderMenu = () => renderWithProviders(<MemberNavSections />, { userContext: { isLoggedIn: true } });

beforeEach(() => {
  vi.clearAllMocks();
  mockReup.mockReturnValue({ data: [] });
  mockUnseen.mockReturnValue(false);
  mockJoinCount.mockReturnValue(0);
  mockFavoriteIds.mockReturnValue([]);
});

describe('MemberNavSections', () => {
  it('puts My Teams + Messages first, then the Extras and Info folds; no empty Favorites', () => {
    renderMenu();
    const order = screen
      .getAllByText(/^(My Teams|Messages|Favorites|Extras|Info)$/)
      .map((el) => el.textContent);
    expect(order).toEqual(['My Teams', 'Messages', 'Extras', 'Info']);
  });

  it('starts with both folds closed and opens only one at a time', () => {
    renderMenu();
    expect(screen.queryByRole('link', { name: 'Rules' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Stats' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Extras' }));
    expect(screen.getByRole('link', { name: 'Stats' })).toBeInTheDocument();

    // Opening Info closes Extras.
    fireEvent.click(screen.getByRole('button', { name: 'Info' }));
    expect(screen.getByRole('link', { name: 'Rules' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Stats' })).not.toBeInTheDocument();
  });

  it('closes the open fold once the player goes to another page', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Info' }));
    // The sidebar stays mounted on desktop, so this is the case that matters.
    fireEvent.click(screen.getByRole('link', { name: 'Rules' }));
    expect(screen.queryByRole('link', { name: 'Rules' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Info' })).toHaveAttribute('aria-expanded', 'false');
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

  it('stars a fold entry without following its link', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Info' }));
    const star = screen.getByRole('button', { name: 'Add Rules to favorites' });
    expect(star).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(star);
    expect(mockToggle).toHaveBeenCalledWith('rules');
  });

  it('shows a starred entry in Favorites (filled star) and not in its fold', () => {
    mockFavoriteIds.mockReturnValue(['rules']);
    renderMenu();
    const favorites = screen.getByRole('region', { name: 'Favorites' });
    expect(favorites).toHaveTextContent('Rules');
    const unstar = screen.getByRole('button', { name: 'Remove Rules from favorites' });
    expect(unstar).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Info' }));
    expect(screen.getAllByRole('link', { name: 'Rules' })).toHaveLength(1);

    fireEvent.click(unstar);
    expect(mockToggle).toHaveBeenCalledWith('rules');
  });

  it('moves the "(New)" marker off the Info heading when What\'s New is a favorite', () => {
    mockUnseen.mockReturnValue(true);
    mockFavoriteIds.mockReturnValue(['whats-new']);
    renderMenu();
    expect(screen.getByRole('button', { name: 'Info' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: "What's New (New)" })).toBeInTheDocument();
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
