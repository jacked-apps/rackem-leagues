/**
 * @fileoverview FavoritesSection — the entries a player starred, lifted out of
 * the Extras / Info folds so they're always one tap away.
 *
 * Renders NOTHING until the player has at least one favorite, so the menu
 * doesn't carry an empty heading. (Whether it keeps a "Favorites" title once
 * it has rows is still Ed's open call — revisit after he tries the stars.)
 */

import type { NavEntry } from './navEntries';
import { NavRow } from './NavRow';
import { NavSectionHeading } from './NavSectionHeading';

interface FavoritesSectionProps {
  /** Starred entries, in menu order. Empty = the section isn't shown. */
  entries: NavEntry[];
  /** Decorates a label with its live marker (see `useNavLabel`). */
  labelFor: (entry: NavEntry) => string;
  /** True in the drawer, so taps close it. */
  inSheet?: boolean;
}

export function FavoritesSection({ entries, labelFor, inSheet }: FavoritesSectionProps) {
  if (entries.length === 0) return null;

  return (
    <section aria-label="Favorites" className="mb-2">
      <NavSectionHeading>Favorites</NavSectionHeading>
      <ul className="space-y-1">
        {entries.map((e) => (
          <NavRow key={e.id} to={e.path} label={labelFor(e)} inSheet={inSheet} />
        ))}
      </ul>
    </section>
  );
}
