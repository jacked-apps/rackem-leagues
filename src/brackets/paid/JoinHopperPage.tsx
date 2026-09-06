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
 * so someone with no account still sees the tournament. They get two doors:
 * sign in, or simply type a name. The typed name is remembered in their own
 * browser per tournament, and re-checked against the live list every visit —
 * the organizer may have removed them, and a note in one browser proves
 * nothing about the actual tournament.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { queryKeys } from '@/api/queryKeys';
import { useCurrentMember } from '@/api/hooks/useCurrentMember';
import type { SelfWalkupResult } from '@/api/mutations/brackets';
import {
  useAddSelfAsWalkup,
  useBracketPlayerView,
  useJoinHopper,
} from '@/api/hooks/useBrackets';
import { buildBracketView } from '../bracketViewModel';
import { BracketTree } from '../BracketTree';
import { useBracketRealtime } from '../useBracketRealtime';
import { AddMyNameCard, MAX_WALKUP_NAME } from './AddMyNameCard';
import { PlayerTournamentView } from './PlayerTournamentView';
import { forgetWalkupName, recallWalkupName, rememberWalkupName } from './walkupMemory';

export function JoinHopperPage() {
  const { joinToken } = useParams<{ joinToken: string }>();
  const location = useLocation();
  const { data: member, isLoading: memberLoading } = useCurrentMember();
  const join = useJoinHopper();
  const attempted = useRef(false);

  const { data: view, isLoading: viewLoading, isFetching } = useBracketPlayerView(joinToken);
  const addSelf = useAddSelfAsWalkup(joinToken ?? '');

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

  /**
   * Who the viewer is when they have no account: the name this browser noted.
   *
   * Held in STATE, not read from storage during render — writing to
   * localStorage doesn't tell React anything, so reading it inline left the
   * "add my name" box on screen after a successful add.
   */
  const [localName, setLocalName] = useState<string | null>(() =>
    joinToken ? recallWalkupName(joinToken) : null
  );

  /** The remembered name, but only if the live list still backs it up. */
  const localEntry = useMemo(() => {
    if (!localName || !view?.found) return null;
    const inOfficial = view.official.includes(localName);
    const inWaiting = view.waiting.includes(localName);
    if (!inOfficial && !inWaiting) return null;
    return {
      display_name: localName,
      status: (inOfficial ? 'official' : 'hopper') as 'official' | 'hopper',
      // A typed name proves nothing about who they are, so no fee status is
      // shown for it — that would leak another player's standing to anyone
      // willing to guess a name.
      paid_status: null,
    };
  }, [localName, view?.found, view?.official, view?.waiting]);

  /**
   * Drop a note the list no longer backs up — the organizer removed them.
   *
   * Gated on the fetch being SETTLED. A refetch in flight still holds the old
   * list, so running this mid-flight deleted the note of a name that had just
   * been added successfully — the player came back to an empty box.
   */
  useEffect(() => {
    if (isFetching) return;
    if (joinToken && localName && view?.found && !localEntry) {
      forgetWalkupName(joinToken);
      setLocalName(null);
    }
  }, [isFetching, joinToken, localName, view?.found, localEntry]);

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

        {/*
          Not signed in and not already on the list: two doors. Someone who
          already typed a name sees themselves in the list instead, so the box
          doesn't invite them to add a second entry.
        */}
        {!member?.id && !localEntry && (
          <AddMyNameCard
            redirectPath={location.pathname}
            onAdd={async (name) => {
              const result = await addSelf.mutateAsync(name);
              if (result.ok) {
                const saved = result.name ?? name;
                if (joinToken) rememberWalkupName(joinToken, saved);
                // State, so the box gives way to "you're on the list" at once.
                setLocalName(saved);
                toast.success("You're on the list.");
                return null;
              }
              return selfAddProblem(result);
            }}
          />
        )}

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
            {/* The server knows a signed-in player; a walk-up is only known to
                their own browser, so the two identities merge here. */}
            <PlayerTournamentView view={{ ...view, me: view.me ?? localEntry }} />
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

/**
 * Turn a rejected self-add into the sentence that says what to do about it.
 * Every one of these is an ordinary outcome, not a fault, so none of them
 * should read like an error.
 */
function selfAddProblem(result: SelfWalkupResult): string {
  switch (result.reason) {
    case 'name_taken':
      return `${result.name} is already on this list — try another name.`;
    case 'name_too_long':
      return `Keep it to ${result.max ?? MAX_WALKUP_NAME} characters.`;
    case 'not_accepting':
      return 'This tournament has already started, so it’s no longer taking names.';
    case 'full':
      return 'This list is full — see the organizer.';
    case 'not_found':
      return 'This tournament link isn’t valid any more.';
    default:
      return 'That didn’t go through — try again.';
  }
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
