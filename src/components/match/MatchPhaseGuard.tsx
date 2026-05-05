/**
 * @fileoverview Route guard for match-scoped pages (lineup + scoring).
 *
 * This is the SINGLE source of truth for the lineup → scoring transition.
 * Wraps each match-scoped page so that no decision-bearing UI renders
 * before `matches.status` is read fresh from the server.
 *
 * ## What it does
 *
 * On every mount and on every status-poll tick:
 *   1. Reads `matches.status` via `useMatchPhase`.
 *   2. While loading: renders a fullscreen spinner. No children render.
 *   3. On error: renders a fullscreen recovery surface with Try Again /
 *      Back to Schedule. (Unit 4 replaces the inline surface here with
 *      `MatchTransitionRecovery` to add reason-aware copy + the soft/hard
 *      Try Again split.)
 *   4. On `status='scheduled'`: if user is on `/match/:id/score`, redirects
 *      to `/match/:id/lineup`. Otherwise renders children.
 *   5. On `status='in_progress'`: if user is on `/match/:id/lineup`,
 *      redirects to `/match/:id/score`. Otherwise renders children.
 *   6. On any other status (completed, forfeited, postponed): renders
 *      children — the existing post-match surfaces handle these.
 *
 * Children are rendered with a compound `key={matchId:recoveryEpoch}` so
 * navigating between matches OR clicking Try Again forces a full
 * teardown of the wrapped page (refs, memos, state — all reset). This
 * delivers reload-equivalent recovery without `window.location.reload()`.
 *
 * ## Why this is a NEW pattern
 *
 * This is the first server-state route guard in the codebase. The
 * existing `ProtectedRoute` reads client-side state (auth, profile)
 * only. Future contributors should treat `MatchPhaseGuard` as
 * deliberately narrow: it exists for the match-phase transition
 * specifically. Do NOT extend it to non-match routes without a
 * separate design pass — pattern proliferation from a single instance
 * is harder to audit than not having the pattern at all.
 *
 * See origin: `docs/brainstorms/lineup-to-scoring-transition-requirements.md`
 * (Defenses 1, 2, 7) and the corresponding plan.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { queryKeys } from '@/api/queryKeys';
import { useMatchPhase } from '@/api/hooks/useMatchPhase';

interface MatchPhaseGuardProps {
  children: ReactNode;
}

/**
 * Wrapper component that gates rendering of its children on
 * `matches.status` for the current `:matchId` URL param.
 */
export function MatchPhaseGuard({ children }: MatchPhaseGuardProps) {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Bump on Try Again — compound key forces a full subtree remount.
  const [recoveryEpoch, setRecoveryEpoch] = useState(0);

  const phase = useMatchPhase(matchId);

  // Cross-match cleanup: when matchId changes, evict the prior match's
  // queries. Prevents stale data from leaking when fast back/forward
  // navigation outpaces TanStack's gcTime.
  useEffect(() => {
    return () => {
      if (matchId) {
        queryClient.removeQueries({
          queryKey: queryKeys.matches.detail(matchId),
        });
      }
    };
  }, [matchId, queryClient]);

  // Status-based redirect — side effect goes in useEffect, never in
  // render. Calling navigate() during render is a React anti-pattern.
  useEffect(() => {
    if (!phase.data || !matchId) return;
    const onLineup = location.pathname.endsWith('/lineup');
    const onScore = location.pathname.endsWith('/score');
    if (phase.data.status === 'scheduled' && onScore) {
      navigate(`/match/${matchId}/lineup`, { replace: true });
    } else if (phase.data.status === 'in_progress' && onLineup) {
      navigate(`/match/${matchId}/score`, { replace: true });
    }
  }, [phase.data, location.pathname, matchId, navigate]);

  const handleTryAgain = useCallback(() => {
    setRecoveryEpoch((e) => e + 1);
  }, []);

  const handleBackToSchedule = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  // Loading: fullscreen spinner, no children visible.
  if (phase.isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
          <p className="text-muted-foreground">Loading match…</p>
        </div>
      </div>
    );
  }

  // Error: fullscreen recovery surface (inline placeholder; Unit 4
  // swaps in `MatchTransitionRecovery` with reason-aware copy and the
  // soft/hard Try Again split).
  if (phase.isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-lg font-semibold">Match Setup Hit a Hiccup</p>
            <p className="text-sm text-muted-foreground">
              We couldn't reach the server. Tap Try Again when your signal's back.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
              <Button variant="default" loadingText="none" onClick={handleTryAgain}>
                Try Again
              </Button>
              <Button variant="outline" onClick={handleBackToSchedule}>
                Back to Schedule
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // While a redirect is queued in useEffect, render the spinner this
  // frame instead of the children (children would briefly render at
  // the wrong route otherwise).
  const onLineup = location.pathname.endsWith('/lineup');
  const onScore = location.pathname.endsWith('/score');
  const willRedirect =
    (phase.data?.status === 'scheduled' && onScore) ||
    (phase.data?.status === 'in_progress' && onLineup);
  if (willRedirect) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  // Status is one of the renderable states for the current path —
  // render children with the compound key on a real wrapping <div>.
  // The key MUST be on a real element, not a Fragment, for React's
  // reconciliation to actually remount on key change.
  return <div key={`${matchId}:${recoveryEpoch}`}>{children}</div>;
}
