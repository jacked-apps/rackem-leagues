/**
 * @fileoverview FavoritesSection — the entries a player starred, lifted out of
 * the Extras / Info folds so they're always one tap away.
 *
 * Renders NOTHING until the player has at least one favorite, so the menu
 * doesn't carry an empty heading. Each row keeps its (filled) star, which is
 * how a player un-stars it back into its fold. (Whether this keeps a
 * "Favorites" title is Ed's open call after he tries the stars.)
 */

import type { NavEntry } from './navEntries';
import { StarredNavRow } from './StarredNavRow';
import { NavSectionHeading } from './NavSectionHeading';

interface FavoritesSectionProps {
  /** Starred entries, in menu order. Empty = the section isn't shown. */
  entries: NavEntry[];
  /** Decorates a label with its live marker (see `useNavLabel`). */
  labelFor: (entry: NavEntry) => string;
  /** Un-star an entry (sends it back to its fold). */
  onToggleStar: (id: string) => void;
  /** True in the drawer, so taps on a link close it. */
  inSheet?: boolean;
}

export function FavoritesSection({ entries, labelFor, onToggleStar, inSheet }: FavoritesSectionProps) {
  if (entries.length === 0) return null;

  return (
    <section aria-label="Favorites" className="mb-2">
      <NavSectionHeading>Favorites</NavSectionHeading>
      <ul className="space-y-1">
        {entries.map((e) => (
          <StarredNavRow
            key={e.id}
            to={e.path}
            label={labelFor(e)}
            name={e.label}
            starred
            onToggleStar={() => onToggleStar(e.id)}
            inSheet={inSheet}
          />
        ))}
      </ul>
    </section>
  );
}
