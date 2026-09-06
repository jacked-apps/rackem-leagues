/**
 * @fileoverview Brackets index — the organizer's list of their brackets (Unit 8).
 *
 * The landing surface behind the "Brackets" nav entry (`/brackets`). Lists the
 * current member's active brackets (setup / live / complete) with a link into
 * each, plus a "New bracket" action. Empty state = a first-run CTA. Closed
 * tombstones are excluded (they're ended and get swept).
 */

import { Link } from 'react-router-dom';
import { bracketDestination } from './paid/bracketDestination';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCurrentMember } from '@/api/hooks/useCurrentMember';
import { useBracketsByCreator } from '@/api/hooks/useBrackets';
import type { BracketRow } from '@/api/queries/brackets';

/** Human labels for the bracket status badge. */
const STATUS_LABEL: Record<string, string> = {
  setup: 'Setup',
  live: 'Live',
  complete: 'Complete',
};

export function BracketsIndexPage() {
  const { data: member } = useCurrentMember();
  const { data: brackets, isLoading } = useBracketsByCreator(member?.id);

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tournaments</h1>
        <Button asChild loadingText="none">
          <Link to="/brackets/new">New tournament</Link>
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : !brackets || brackets.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-3">
          {brackets.map((b) => (
            <li key={b.id}>
              <BracketRowLink bracket={b} />
            </li>
          ))}
        </ul>
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
