/**
 * @fileoverview The player's tournament page (`/brackets/join/:joinToken`).
 *
 * Where a scanned QR / opened join link lands. It is a LIVE page, not a
 * one-shot confirmation: a player standing in a bar wants to watch the room
 * fill up, see whether the organizer has added them yet, and know what they're
 * playing. Joining is something that happens on arrival and is announced with a
 * toast — it is not the destination.
 *
 * Two tabs: Players (always) and Bracket, which appears the moment the
 * organizer starts the tournament so the player can go back and forth without
 * losing this page.
 *
 * Public route — the read is anon-safe (names only, plus the caller's own row),
 * so someone with no account still sees the tournament and is offered sign-in.
 * Auth is handled inside rather than by a route guard.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { queryKeys } from '@/api/queryKeys';
import { useCurrentMember } from '@/api/hooks/useCurrentMember';
import { useBracketPlayerView, useJoinHopper } from '@/api/hooks/useBrackets';
import { buildBracketView } from '../bracketViewModel';
import { BracketTree } from '../BracketTree';
import { useBracketRealtime } from '../useBracketRealtime';
import { PlayerTournamentView } from './PlayerTournamentView';

export function JoinHopperPage() {
  const { joinToken } = useParams<{ joinToken: string }>();
  const location = useLocation();
  const { data: member, isLoading: memberLoading } = useCurrentMember();
  const join = useJoinHopper();
  const attempted = useRef(false);

  const { data: view, isLoading: viewLoading } = useBracketPlayerView(joinToken);

  // Watch the hopper, not just the matches — the whole point before the start
  // is seeing players arrive.
  useBracketRealtime(
    view?.bracket?.id,
    queryKeys.brackets.playerView(joinToken ?? ''),
    true
  );

  // Join once, as soon as we know the player is signed in and isn't already on
  // the list. Announced with a toast so the page itself stays the destination.
  const alreadyListed = !!view?.me;
  useEffect(() => {
    if (!joinToken || memberLoading || !member?.id || attempted.current) return;
    if (viewLoading || alreadyListed) return;
    attempted.current = true;
    join.mutate(
      { joinToken },
      {
        onSuccess: (result) => {
          if (result.ok && !result.already_in) toast.success("You're on the list.");
        },
      }
    );
  }, [joinToken, member?.id, memberLoading, viewLoading, alreadyListed, join]);

  const tree = useMemo(
    () =>
      view?.matches?.length
        ? buildBracketView(view.participants, view.matches)
        : null,
    [view?.participants, view?.matches]
  );

  if (viewLoading || memberLoading) {
    return (
      <Shell>
        <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading tournament…
        </div>
      </Shell>
    );
  }

  if (!view?.found || !view.bracket) {
    return (
      <Shell>
        <Notice title="Link not valid">
          This join link isn't valid — double-check the QR code or link.
        </Notice>
      </Shell>
    );
  }

  const result = join.data;

  return (
    <Shell>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">{view.bracket.name}</h1>
          <p className="text-sm text-muted-foreground">
            {view.bracket.status === 'setup' ? 'Getting players together' : 'Under way'}
          </p>
        </div>

        {/* Anyone not signed in still sees the tournament — they just can't join yet. */}
        {!member?.id && <SignInPrompt path={location.pathname} />}

        {result?.reason === 'name_taken' && <NameTaken name={result.name} path={location.pathname} />}
        {result?.reason === 'not_accepting' && (
          <Notice title="Sign-ups are closed">
            This tournament has already started, so it's no longer taking sign-ups.
          </Notice>
        )}

        <Tabs defaultValue="players">
          <TabsList>
            <TabsTrigger value="players">Players</TabsTrigger>
            {/* Appears the moment there's a bracket to look at. */}
            {tree && <TabsTrigger value="bracket">Bracket</TabsTrigger>}
          </TabsList>

          <TabsContent value="players" className="mt-4">
            <PlayerTournamentView view={view} />
          </TabsContent>

          {tree && (
            <TabsContent value="bracket" className="mt-4">
              <BracketTree view={tree} readOnly />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </Shell>
  );
}

/** Not signed in: show the tournament, offer the way in. */
function SignInPrompt({ path }: { path: string }) {
  return (
    <Card>
      <CardHeader className="py-4">
        <CardTitle className="text-base">Sign in to join</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pb-4">
        <p className="text-sm text-muted-foreground">
          You can watch this page without an account. Sign in to add yourself to
          the list.
        </p>
        {/* Carry the join intent through sign-in so they land back here. */}
        <Button asChild loadingText="none">
          <Link to={`/login?redirect=${encodeURIComponent(path)}`}>Sign in</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Somebody got to this name first. We never rename anyone from here — the
 * nickname belongs to their profile and changing it would change it on their
 * league team too.
 */
function NameTaken({ name, path }: { name?: string; path: string }) {
  return (
    <Card className="border-destructive/40">
      <CardHeader className="py-4">
        <CardTitle className="text-base">That name's taken</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pb-4">
        <p className="text-sm">
          Someone is already on this list as <span className="font-medium">{name}</span>.
        </p>
        <p className="text-sm text-muted-foreground">
          If that isn't you, change your nickname on your profile and come back —
          two players with the same name can't be told apart on the bracket.
        </p>
        <div className="flex gap-2">
          <Button asChild loadingText="none">
            <Link to="/profile">Change my nickname</Link>
          </Button>
          <Button asChild variant="outline" loadingText="none">
            <Link to={path} reloadDocument>
              Try again
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="py-4">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pb-4 text-sm text-muted-foreground">{children}</CardContent>
    </Card>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted p-4">
      <div className="mx-auto w-full max-w-2xl py-8">{children}</div>
    </div>
  );
}
