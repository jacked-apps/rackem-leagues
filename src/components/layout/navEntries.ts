/**
 * @fileoverview The ONE list of signed-in menu entries.
 *
 * Both the desktop sidebar (`AppSidebar`) and the phone drawer (`AppDrawer`)
 * render from this list through `MemberNavSections`, so the two menus can't
 * drift apart again (they did: the drawer had Season Re-Up and the sidebar
 * didn't). To add a page to the menu, add ONE entry here.
 *
 * What is NOT here: the "automatic" entries — My Match, Join requests (N),
 * Season Re-Up and operator Reports. They appear because a count says so, not
 * because a player chose them, so their sections compute and place them.
 *
 * Rooms (`/rooms`) belongs in `non-league` with `show: () => !isProduction`
 * once `feat/game-room` lands — the gate must match its route's gate (see
 * CLAUDE.md "Feature Gating": gate the door AND the room). It isn't listed
 * yet because that route doesn't exist on this branch.
 */

/** Which part of the menu an entry lives in when it isn't a favorite. */
export type NavGroup = 'favorites-default' | 'non-league' | 'info';

export interface NavEntry {
  /** Stable id — saved in a player's favorites later, so never rename one. */
  id: string;
  /** Plain label; counts/markers are added by `useNavBadges`. */
  label: string;
  /** Route the row links to. */
  path: string;
  /** Home group. `favorites-default` entries start out in Favorites. */
  group: NavGroup;
  /** Optional visibility rule (e.g. a non-production gate). Omitted = shown. */
  show?: () => boolean;
}

/** Menu order within each group is the order of this array. */
export const NAV_ENTRIES: readonly NavEntry[] = [
  { id: 'my-teams', label: 'My Teams', path: '/my-teams', group: 'favorites-default' },
  { id: 'messages', label: 'Messages', path: '/messages', group: 'favorites-default' },

  { id: 'tournaments', label: 'Tournaments', path: '/brackets', group: 'non-league' },
  { id: 'stats', label: 'Stats', path: '/stats', group: 'non-league' },
  { id: 'profile', label: 'Profile', path: '/profile', group: 'non-league' },

  { id: 'home', label: 'Home', path: '/', group: 'info' },
  { id: 'about', label: 'About', path: '/about', group: 'info' },
  { id: 'rules', label: 'Rules', path: '/rules', group: 'info' },
  { id: 'learn', label: 'Learn', path: '/learn', group: 'info' },
  { id: 'whats-new', label: "What's New", path: '/whats-new', group: 'info' },
];

/** Ids that sit in Favorites until a player customises them. */
export const DEFAULT_FAVORITE_IDS: readonly string[] = NAV_ENTRIES.filter(
  (e) => e.group === 'favorites-default',
).map((e) => e.id);

/**
 * Split the visible entries into the menu's three blocks.
 *
 * A favorite leaves its home fold and shows in Favorites instead; everything
 * keeps the list's own order (favorites aren't reorderable). Unknown ids are
 * ignored, so a removed page can't break a saved favorites list.
 *
 * @param favoriteIds Ids the player has in Favorites (defaults for now).
 * @returns `{ favorites, nonLeague, info }`, each in menu order.
 * @example splitNavEntries(['my-teams', 'rules']).info // Home, About, Learn, What's New
 */
export function splitNavEntries(favoriteIds: readonly string[] = DEFAULT_FAVORITE_IDS) {
  const favs = new Set(favoriteIds);
  const visible = NAV_ENTRIES.filter((e) => e.show?.() ?? true);
  const inFold = (group: NavGroup) => visible.filter((e) => e.group === group && !favs.has(e.id));
  return {
    favorites: visible.filter((e) => favs.has(e.id)),
    nonLeague: inFold('non-league'),
    info: inFold('info'),
  };
}
