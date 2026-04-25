/**
 * @fileoverview Canonical list of rulebook sections the cleanup pipeline emits.
 *
 * Each entry maps a "RULES SECTION N" heading in the source PDF to the slug
 * and display name used by the reader. Order is display order (also the
 * source-PDF order). Section 10 (Referees, Event Officials) is intentionally
 * excluded from v1 — it is administrative content, not playable-game rules.
 */

export type GameMeta = {
  /** "RULES SECTION N" index in the source PDF (1-based). */
  sectionNumber: number;
  /** URL-safe slug used in /rules/:game/:ruleId. */
  slug: string;
  /** Human-readable name rendered in the UI. */
  name: string;
};

export const GAMES: GameMeta[] = [
  { sectionNumber: 1, slug: 'general', name: 'General Rules' },
  { sectionNumber: 2, slug: '8-ball', name: '8-Ball' },
  { sectionNumber: 3, slug: '9-ball', name: '9-Ball' },
  { sectionNumber: 4, slug: '10-ball', name: '10-Ball' },
  { sectionNumber: 5, slug: 'one-pocket', name: 'One Pocket' },
  { sectionNumber: 6, slug: '14-1-continuous', name: '14.1 Continuous' },
  { sectionNumber: 7, slug: 'bank-pool', name: 'Bank Pool' },
  { sectionNumber: 8, slug: 'wheelchair', name: 'Wheelchair' },
  { sectionNumber: 9, slug: 'scotch-doubles', name: 'Scotch Doubles' },
];

/** Default game shown on a cold `/rules` visit (per the plan). */
export const DEFAULT_GAME_SLUG = '8-ball';
