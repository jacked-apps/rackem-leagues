/**
 * @fileoverview What a player sees while a tournament fills up (Unit C3).
 *
 * The page a scanned QR lands on, once they're in. It answers the four things a
 * player standing in a bar actually wants to know, in that order:
 *
 *   1. Am I on the list, and have I paid?
 *   2. Who else is in?
 *   3. Who's still waiting?
 *   4. What am I playing — how many losses puts me out, what game?
 *
 * Paid status appears ONLY for the viewer's own entry. This page is reachable
 * from a code taped to a wall, so listing who still owes money would turn it
 * into a debt board.
 *
 * Presentational — the page owns fetching and realtime, this renders a snapshot.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BracketPlayerView } from '@/api/queries/brackets';
import { hasPremiumFeature } from './premiumFeatures';
import { tournamentRules } from './tournamentRules';

interface PlayerTournamentViewProps {
  view: BracketPlayerView;
}

export function PlayerTournamentView({ view }: PlayerTournamentViewProps) {
  const { bracket, waiting, official, me } = view;
  if (!bracket) return null;

  const notStarted = bracket.status === 'setup';
  const tracksEntryFees = hasPremiumFeature(bracket.premium_features, 'payment_tracker');

  return (
    <div className="space-y-4">
      {/* 1. You. */}
      {me && (
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base">
              {me.status === 'official'
                ? `You're in as ${me.display_name}`
                : `You're on the waiting list as ${me.display_name}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 pb-4 text-sm text-muted-foreground">
            {me.status === 'hopper' && <p>The organizer will add you to the tournament.</p>}
            {/* Only ever the viewer's own fee — never anyone else's. */}
            {tracksEntryFees && me.status === 'official' && (
              <p className={me.paid_status === 'paid' ? 'text-success' : undefined}>
                {me.paid_status === 'paid'
                  ? 'Your entry fee is marked paid.'
                  : 'Your entry fee is not marked paid yet — see the organizer.'}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {notStarted && (
        <p className="text-sm text-muted-foreground">
          The bracket hasn't been drawn yet — it appears here once the organizer
          starts the tournament.
        </p>
      )}

      {/* 2 + 3. The room. */}
      <PlayerList title="In the tournament" names={official} empty="Nobody added yet." />
      <PlayerList
        title="Waiting to be added"
        names={waiting}
        empty="Nobody waiting right now."
      />

      {/* 4. What you're playing. */}
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">Rules</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <dl className="space-y-1 text-sm">
            {tournamentRules(bracket).map((rule) => (
              <div key={rule.label} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{rule.label}</dt>
                <dd className="text-right font-medium">{rule.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
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
    <Card>
      <CardHeader className="py-4">
        <CardTitle className="text-base">
          {title} ({names.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        {names.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="divide-y text-sm">
            {names.map((name, i) => (
              // Names are unique per tournament (enforced by the DB index), but
              // the index keeps the key stable if that ever changes.
              <li key={`${name}-${i}`} className="py-1.5">
                {name}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
