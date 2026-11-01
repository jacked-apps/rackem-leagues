/**
 * @fileoverview FavoritesSection — the always-visible "Favorites" block of the
 * signed-in menu.
 *
 * Shows the player's favorite entries (for now the defaults, My Teams and
 * Messages) and, after them, the automatic entries that appear on a count:
 * - **Join requests (N)** — pending requests this user can approve.
 * - **Season Re-Up** — a captain has an open re-up form ("(N)" if several).
 *
 * The automatic entries come after the favorites so the favorites never jump
 * around when a doorbell rings.
 */

import { usePendingJoinRequestCount } from '@/api/hooks/usePendingJoinRequestCount';
import { useCaptainReupPrompt } from '@/hooks/useCaptainReupPrompt';
import type { NavEntry } from './navEntries';
import { NavRow } from './NavRow';
import { NavSectionHeading } from './NavSectionHeading';

interface FavoritesSectionProps {
  /** Favorite entries, already in menu order. */
  entries: NavEntry[];
  /** Decorates a label with its live marker (see `useNavLabel`). */
  labelFor: (entry: NavEntry) => string;
  /** Where the Join requests doorbell leads (operator vs player route). */
  joinRequestsTo: string;
  /** True in the drawer, so taps close it. */
  inSheet?: boolean;
}

export function FavoritesSection({ entries, labelFor, joinRequestsTo, inSheet }: FavoritesSectionProps) {
  const joinRequestCount = usePendingJoinRequestCount();
  // Same hook the re-up modal uses: the row appears the moment a qualifying
  // team exists and disappears the moment it's answered.
  const { data: reupTeams = [] } = useCaptainReupPrompt();
  const reupLabel = reupTeams.length > 1 ? `Season Re-Up (${reupTeams.length})` : 'Season Re-Up';

  return (
    <section aria-label="Favorites" className="mb-2">
      <NavSectionHeading>Favorites</NavSectionHeading>
      <ul className="space-y-1">
        {entries.map((e) => (
          <NavRow key={e.id} to={e.path} label={labelFor(e)} inSheet={inSheet} />
        ))}
        {joinRequestCount > 0 && (
          <NavRow to={joinRequestsTo} label={`Join requests (${joinRequestCount})`} inSheet={inSheet} />
        )}
        {reupTeams.length > 0 && <NavRow to="/reup" label={reupLabel} inSheet={inSheet} />}
      </ul>
    </section>
  );
}
