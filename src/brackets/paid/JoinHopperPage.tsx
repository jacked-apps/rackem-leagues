/**
 * @fileoverview JoinHopperPage — where a player lands after scanning a paid
 * tournament's QR / opening its join link (`/brackets/join/:joinToken`).
 *
 * A signed-in player is added to the hopper automatically (they only add
 * themselves — the token carries no identity). A not-signed-in scanner is asked
 * to sign in first; the seamless "sign in and come right back" round-trip is the
 * passwordless sign-in work (feat/passwordless-sign-in) — until then this links
 * to the login page.
 *
 * Public route (no auth wrapper) so a cold scanner can reach it; auth is handled
 * inside.
 */

import { useEffect, useRef } from 'react';
import { useLocation, useParams, Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentMember } from '@/api/hooks/useCurrentMember';
import { useJoinHopper } from '@/api/hooks/useBrackets';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted p-4">
      <div className="mx-auto w-full max-w-md py-16">
        <Card>{children}</Card>
      </div>
    </div>
  );
}

export function JoinHopperPage() {
  const { joinToken } = useParams<{ joinToken: string }>();
  const location = useLocation();
  const { data: member, isLoading: memberLoading } = useCurrentMember();
  const join = useJoinHopper();
  const attempted = useRef(false);

  // Join once, as soon as we know the player is signed in.
  useEffect(() => {
    if (!joinToken || memberLoading || !member?.id || attempted.current) return;
    attempted.current = true;
    join.mutate({ joinToken });
  }, [joinToken, member?.id, memberLoading, join]);

  // Still resolving the session.
  if (memberLoading) {
    return (
      <Shell>
        <CardContent className="flex items-center gap-3 py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-muted-foreground">Checking your account…</span>
        </CardContent>
      </Shell>
    );
  }

  // Not signed in (cold scanner) — ask them to sign in first.
  if (!member?.id) {
    return (
      <Shell>
        <CardHeader>
          <CardTitle>Sign in to join</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sign in (or create a free account) to add yourself to this tournament.
          </p>
          <Button asChild loadingText="none">
            {/*
              Carry the join intent through sign-in. Without this the scanner
              signs in, lands on the dashboard, and never joins — they'd have to
              find and scan the code a second time. Login validates the value
              with getSafeRedirectPath, so only a same-origin path is honored.
            */}
            <Link to={`/login?redirect=${encodeURIComponent(location.pathname)}`}>
              Sign in
            </Link>
          </Button>
        </CardContent>
      </Shell>
    );
  }

  // Joining / joined / rejected.
  const result = join.data;
  return (
    <Shell>
      {join.isPending || (!result && !join.isError) ? (
        <CardContent className="flex items-center gap-3 py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-muted-foreground">Joining…</span>
        </CardContent>
      ) : join.isError ? (
        <>
          <CardHeader>
            <CardTitle>Couldn’t join</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Something went wrong. Open the link again to retry.
            </p>
          </CardContent>
        </>
      ) : result?.ok ? (
        <>
          <CardHeader>
            <CardTitle>You’re in! 🎱</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              You’ve joined the hopper for{' '}
              <span className="font-medium">{result.bracket_name}</span>.
            </p>
            <p className="text-sm text-muted-foreground">
              The organizer will add you to the bracket once you’ve checked in. You can
              close this page.
            </p>
          </CardContent>
        </>
      ) : result?.reason === 'name_taken' ? (
        /*
         * Somebody got to this name first — names are one-per-tournament so that
         * scoring, alerts and the bracket itself can tell two players apart.
         * We never rename anyone: the nickname belongs to their profile and
         * changing it here would change it on their league team too. They fix it
         * where it lives and come back — no need to find the QR code again.
         */
        <>
          <CardHeader>
            <CardTitle>That name’s taken</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              Someone is already in{' '}
              <span className="font-medium">{result.bracket_name}</span> as{' '}
              <span className="font-medium">{result.name}</span>.
            </p>
            <p className="text-sm text-muted-foreground">
              If that isn’t you, change your nickname on your profile and come
              back — two players with the same name can’t be told apart on the
              bracket.
            </p>
            <div className="flex gap-2">
              <Button asChild loadingText="none">
                <Link to="/profile">Change my nickname</Link>
              </Button>
              <Button asChild variant="outline" loadingText="none">
                <Link to={location.pathname} reloadDocument>
                  Try again
                </Link>
              </Button>
            </div>
          </CardContent>
        </>
      ) : (
        <>
          <CardHeader>
            <CardTitle>
              {result?.reason === 'not_accepting'
                ? 'Sign-ups are closed'
                : 'Link not valid'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {result?.reason === 'not_accepting'
                ? 'This tournament has already started, so it’s no longer taking sign-ups.'
                : 'This join link isn’t valid — double-check the QR code or link.'}
            </p>
          </CardContent>
        </>
      )}
    </Shell>
  );
}
