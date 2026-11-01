/**
 * @fileoverview CoreNavSection — the fixed block at the top of the signed-in
 * menu, right under the player's name / avatar row.
 *
 * Holds the `core` entries (My Teams, Messages) and, after them, the automatic
 * doorbells that appear on a count:
 * - **Join requests (N)** — pending requests this user can approve.
 * - **Season Re-Up** — a captain has an open re-up form ("(N)" if several).
 *
 * No heading: together with the name row above it, this block reads as
 * "you". It never moves, so muscle memory holds; the doorbells sit after the
 * core rows so My Teams / Messages don't shift when one rings.
 */

import { usePendingJoinRequestCount } from '@/api/hooks/usePendingJoinRequestCount';
import { useCaptainReupPrompt } from '@/hooks/useCaptainReupPrompt';
import type { NavEntry } from './navEntries';
import { NavRow } from './NavRow';

interface CoreNavSectionProps {
  /** The `core` entries, in menu order. */
  entries: NavEntry[];
  /** Decorates a label with its live marker (see `useNavLabel`). */
  labelFor: (entry: NavEntry) => string;
  /** Where the Join requests doorbell leads (operator vs player route). */
  joinRequestsTo: string;
  /** True in the drawer, so taps close it. */
  inSheet?: boolean;
}

export function CoreNavSection({ entries, labelFor, joinRequestsTo, inSheet }: CoreNavSectionProps) {
  const joinRequestCount = usePendingJoinRequestCount();
  // Same hook the re-up modal uses: the row appears the moment a qualifying
  // team exists and disappears the moment it's answered.
  const { data: reupTeams = [] } = useCaptainReupPrompt();
  const reupLabel = reupTeams.length > 1 ? `Season Re-Up (${reupTeams.length})` : 'Season Re-Up';

  return (
    <ul className="mb-4 space-y-1 border-b pb-4">
      {entries.map((e) => (
        <NavRow key={e.id} to={e.path} label={labelFor(e)} inSheet={inSheet} />
      ))}
      {joinRequestCount > 0 && (
        <NavRow to={joinRequestsTo} label={`Join requests (${joinRequestCount})`} inSheet={inSheet} />
      )}
      {reupTeams.length > 0 && <NavRow to="/reup" label={reupLabel} inSheet={inSheet} />}
    </ul>
  );
}
