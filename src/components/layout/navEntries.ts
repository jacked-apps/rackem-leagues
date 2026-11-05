/**
 * @fileoverview The ONE list of signed-in menu entries.
 *
 * Both the desktop sidebar (`AppSidebar`) and the phone drawer (`AppDrawer`)
 * render from this list through `MemberNavSections`, so the two menus can't
 * drift apart again (they did: the drawer had Season Re-Up and the sidebar
 * didn't). To add a page to the menu, add ONE entry here.
 *
 * Groups:
 * - `core` — My Teams + Messages: fixed at the top under the player's name,
 *   always there, never starred.
 * - `extras` / `info` — the two folds. A player can star any of these to
 *   lift it into Favorites (Unit 3).
 *
 * Profile is NOT an entry: the name / avatar row at the top already opens it.
 *
 * What is also NOT here: the "automatic" entries — My Match, Join requests
 * (N), Season Re-Up and operator Reports. They appear because a count says
 * so, not because a player chose them, so their sections compute them.
 *
 * Rooms (`/rooms`) belongs in `extras` with `show: () => !isProduction`
 * once `feat/game-room` lands — the gate must match its route's gate (see
 * CLAUDE.md "Feature Gating": gate the door AND the room). It isn't listed
 * yet because that route doesn't exist on this branch.
 */

/** Which part of the menu an entry lives in. */
export type NavGroup = 'core' | 'extras' | 'info';

export interface NavEntry {
  /** Stable id — saved in a player's favorites, so never rename one. */
  id: string;
  /** Plain label; counts/markers are added by `useNavLabel`. */
  label: string;
  /** Route the row links to. */
  path: string;
  /** Home group. Only `extras` / `info` entries can become favorites. */
  group: NavGroup;
  /** Optional visibility rule (e.g. a non-production gate). Omitted = shown. */
  show?: () => boolean;
}

/** Menu order within each group is the order of this array. */
export const NAV_ENTRIES: readonly NavEntry[] = [
  { id: 'my-teams', label: 'My Teams', path: '/my-teams', group: 'core' },
  { id: 'messages', label: 'Messages', path: '/messages', group: 'core' },

  { id: 'tournaments', label: 'Tournaments', path: '/brackets', group: 'extras' },
  { id: 'stats', label: 'Stats', path: '/stats', group: 'extras' },

  { id: 'home', label: 'Home', path: '/', group: 'info' },
  { id: 'rules', label: 'Rules', path: '/rules', group: 'info' },
  { id: 'learn', label: 'Learn', path: '/learn', group: 'info' },
  { id: 'whats-new', label: "What's New", path: '/whats-new', group: 'info' },
  { id: 'about', label: 'About', path: '/about', group: 'info' },
];

/**
 * Split the visible entries into the menu's blocks.
 *
 * A favorite leaves its fold and shows in Favorites instead; everything keeps
 * this list's order (favorites aren't reorderable). Unknown ids and `core`
 * ids are ignored, so a removed page can't break a saved favorites list.
 *
 * @param favoriteIds Ids the player starred (none until they star one).
 * @returns `{ core, favorites, extras, info }`, each in menu order.
 * @example splitNavEntries(['rules']).info // Home, Learn, What's New, About
 */
export function splitNavEntries(favoriteIds: readonly string[] = []) {
  const favs = new Set(favoriteIds);
  const visible = NAV_ENTRIES.filter((e) => e.show?.() ?? true);
  const isFav = (e: NavEntry) => e.group !== 'core' && favs.has(e.id);
  const inFold = (group: NavGroup) => visible.filter((e) => e.group === group && !isFav(e));
  return {
    core: visible.filter((e) => e.group === 'core'),
    favorites: visible.filter(isFav),
    extras: inFold('extras'),
    info: inFold('info'),
  };
}
