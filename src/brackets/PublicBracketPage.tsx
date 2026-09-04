/**
 * @fileoverview Public, read-only bracket share page (Unit 6).
 *
 * The no-auth `/brackets/share/:shareToken` page anyone can open from a shared
 * link. Reads names-only data via the get_bracket_share RPC (the authorization
 * boundary while RLS is off) and reuses BracketTree in read-only mode. Stays
 * live via realtime (fast path) with a polling fallback in the hook, since anon
 * realtime delivery isn't proven for this app.
 *
 * Unknown / closed / swept token → a friendly "ended" state with a create CTA
 * (this is a growth-funnel surface, so the dead-link state is a conversion
 * moment, not just an error).
 */

import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { queryKeys } from '@/api/queryKeys';
import { useBracketShare } from '@/api/hooks/useBrackets';
import { buildBracketView, championName } from './bracketViewModel';
import { BracketTree } from './BracketTree';
import { useBracketRealtime } from './useBracketRealtime';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted p-4">
      <div className="mx-auto w-full max-w-5xl py-8">{children}</div>
    </div>
  );
}

export function PublicBracketPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const { data, isLoading } = useBracketShare(shareToken);

  // Keep the public view live (fast path); the hook also polls while live.
  useBracketRealtime(data?.bracket?.id, queryKeys.brackets.share(shareToken ?? ''));

  const view = useMemo(
    () => (data?.found ? buildBracketView(data.participants, data.matches) : null),
    [data]
  );
  const champion = view ? championName(view) : null;

  if (isLoading) {
    return (
      <Shell>
        <p className="text-center text-muted-foreground">Loading bracket…</p>
      </Shell>
    );
  }

  // Unknown / closed / swept → the funnel-friendly ended state.
  if (!data?.found || !data.bracket || !view) {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle>This bracket has ended</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The link may be old, or the organizer has closed the bracket.
            </p>
            <Button asChild loadingText="none">
              <Link to="/brackets/new">Create your own bracket</Link>
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <Card>
        <CardHeader>
          <CardTitle>{data.bracket.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {champion && (
            <div className="rounded-md bg-accent px-4 py-3 text-center font-semibold">
              🏆 {champion} wins!
            </div>
          )}
          <BracketTree view={view} readOnly />
        </CardContent>
      </Card>
    </Shell>
  );
}
