/**
 * @fileoverview What a player sees while a tournament fills up (Unit C3).
 *
 * Deliberately compact: this is read standing up, on a phone, in a bar. Every
 * block is one or two lines — a card per fact would push the player lists off
 * the screen, which are the thing people actually keep checking.
 *
 * Paid status appears ONLY for the viewer's own entry. The page is reachable
 * from a code taped to a wall, so listing who still owes money would turn it
 * into a debt board.
 *
 * Presentational — the page owns fetching and realtime, this renders a snapshot.
 */

import type { BracketPlayerView } from '@/api/queries/brackets';
import { hasPremiumFeature } from './premiumFeatures';

interface PlayerTournamentViewProps {
  view: BracketPlayerView;
}

export function PlayerTournamentView({ view }: PlayerTournamentViewProps) {
  const { bracket, waiting, official, me } = view;
  if (!bracket) return null;

  const tracksEntryFees = hasPremiumFeature(bracket.premium_features, 'payment_tracker');

  return (
    <div className="space-y-4">
      {me && (
        <div className="rounded-md border bg-card px-3 py-2">
          <p className="text-sm font-medium">
            {me.status === 'official'
              ? `You're in as ${me.display_name}`
              : `You're on the waiting list as ${me.display_name}`}
          </p>
          {me.status === 'hopper' && (
            <p className="text-xs text-muted-foreground">
              The organizer will add you to the tournament.
            </p>
          )}
          {/* Only ever the viewer's own fee — never anyone else's. */}
          {tracksEntryFees && me.status === 'official' && (
            <p
              className={`text-xs ${
                me.paid_status === 'paid' ? 'text-success' : 'text-muted-foreground'
              }`}
            >
              {me.paid_status === 'paid'
                ? 'Entry fee paid.'
                : 'Entry fee not marked paid — see the organizer.'}
            </p>
          )}
        </div>
      )}

      <PlayerList title="In the tournament" names={official} empty="Nobody added yet." />
      <PlayerList title="Waiting" names={waiting} empty="Nobody waiting right now." />
    </div>
  );
}

/** One titled list of names with its live count. */
function PlayerList({
  title,
  names,
  empty,
}: {
  title: string;
  names: string[];
  empty: string;
}) {
  return (
    <section>
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title} ({names.length})
      </h2>
      {names.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {names.map((name, i) => (
            // Names are unique per tournament (enforced by the DB index), but
            // the index keeps the key stable if that ever changes.
            <li key={`${name}-${i}`} className="px-3 py-1.5 text-sm">
              {name}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
