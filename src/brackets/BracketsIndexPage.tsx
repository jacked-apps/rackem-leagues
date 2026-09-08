/**
 * @fileoverview Tournaments index (`/brackets`) — everything you're part of.
 *
 * Two lists, because there are two ways to be in a tournament:
 *
 *   - ones you're RUNNING (you created them), and
 *   - ones you're PLAYING IN (you scanned a code or were added).
 *
 * The second is new and fixes a dead end: a player who joined by QR had no way
 * back to their tournament from inside the app. They had to keep the tab open
 * or go find the code again — which you can't do once you've walked away from
 * the wall it was taped to. Each row goes to that player's own view of the
 * tournament, not the organizer's.
 *
 * Closed tombstones are excluded from both (they're ended and get swept).
 *
 * A walk-up with no account can't appear here at all — there's nothing to look
 * them up by. Their route back is the link their own browser remembered.
 */

import { Link } from 'react-router-dom';
import { bracketDestination } from './paid/bracketDestination';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCurrentMember } from '@/api/hooks/useCurrentMember';
import { useBracketsByCreator, useMyTournaments } from '@/api/hooks/useBrackets';
import type { BracketRow, MyTournament } from '@/api/queries/brackets';

/** Human labels for the bracket status badge. */
const STATUS_LABEL: Record<string, string> = {
  setup: 'Setup',
  live: 'Live',
  complete: 'Complete',
};

export function BracketsIndexPage() {
  const { data: member } = useCurrentMember();
  const { data: brackets, isLoading } = useBracketsByCreator(member?.id);
  const { data: playing, isLoading: playingLoading } = useMyTournaments(member?.id);

  const running = brackets ?? [];
  const joined = playing ?? [];
  // Only a genuinely empty slate gets the first-run pitch — someone playing in
  // a tournament they didn't create has plenty here already.
  const nothingAtAll =
    !isLoading && !playingLoading && running.length === 0 && joined.length === 0;

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tournaments</h1>
        <Button asChild loadingText="none">
          <Link to="/brackets/new">New tournament</Link>
        </Button>
      </div>

      {isLoading || playingLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : nothingAtAll ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          {joined.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                You're playing in
              </h2>
              <ul className="space-y-3">
                {joined.map((t) => (
                  <li key={t.id}>
                    <JoinedRowLink tournament={t} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {running.length > 0 && (
            <section>
              {/* Only worth a heading when there is another list to tell it from. */}
              {joined.length > 0 && (
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  You're running
                </h2>
              )}
              <ul className="space-y-3">
                {running.map((b) => (
                  <li key={b.id}>
                    <BracketRowLink bracket={b} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function BracketRowLink({ bracket }: { bracket: BracketRow }) {
  return (
    // A sign-up tournament still in setup opens on its hopper, not on a
    // bracket that has no matches yet.
    <Link to={bracketDestination(bracket)}>
      <Card className="transition-colors hover:bg-accent">
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <CardTitle className="text-base">{bracket.name}</CardTitle>
          <Badge variant="secondary">{STATUS_LABEL[bracket.status] ?? bracket.status}</Badge>
        </CardHeader>
      </Card>
    </Link>
  );
}

/**
 * A tournament the member is playing in. Goes to the join page — the player's
 * own view — rather than the organizer's setup or bracket screen.
 */
function JoinedRowLink({ tournament }: { tournament: MyTournament }) {
  const waiting = tournament.entry_status === 'hopper';

  return (
    <Link to={`/brackets/join/${tournament.join_token}`}>
      <Card className="transition-colors hover:bg-accent">
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <CardTitle className="text-base">{tournament.name}</CardTitle>
          {/* Their own standing, which is what they came back to check. */}
          <Badge variant={waiting ? 'outline' : 'secondary'}>
            {waiting ? 'Waiting' : (STATUS_LABEL[tournament.status] ?? tournament.status)}
          </Badge>
        </CardHeader>
      </Card>
    </Link>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>No tournaments yet</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Run a single- or double-elimination tournament for your next event —
          just add names and tap winners.
        </p>
        <Button asChild loadingText="none">
          <Link to="/brackets/new">Create your first tournament</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
