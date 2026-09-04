/**
 * @fileoverview Brackets index — the organizer's list of their brackets (Unit 8).
 *
 * The landing surface behind the "Brackets" nav entry (`/brackets`). Lists the
 * current member's active brackets (setup / live / complete) with a link into
 * each, plus a "New bracket" action. Empty state = a first-run CTA. Closed
 * tombstones are excluded (they're ended and get swept).
 */

import { Link } from 'react-router-dom';
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
        <h1 className="text-2xl font-semibold">Brackets</h1>
        <Button asChild loadingText="none">
          <Link to="/brackets/new">New bracket</Link>
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
    <Link to={`/brackets/${bracket.id}`}>
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
        <CardTitle>No brackets yet</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Run a single- or double-elimination bracket for your next event — just
          add names and tap winners.
        </p>
        <Button asChild loadingText="none">
          <Link to="/brackets/new">Create your first bracket</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
