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
 *
 * ## Note on file size
 *
 * This file exceeds the project's ~100-line target. The branching
 * dispatch table (status × pathname × isError × softRetryFailed) is
 * the load-bearing logic and resists splitting cleanly without
 * inventing premature abstractions. The compromise is to keep the
 * branching here and isolate it behind one component contract; tests
 * (when added) cover the dispatch table at the public boundary.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { queryKeys } from '@/api/queryKeys';
import { useMatchPhase } from '@/api/hooks/useMatchPhase';
import {
  MatchTransitionRecovery,
  type RecoveryReason,
} from '@/components/match/MatchTransitionRecovery';

interface MatchPhaseGuardProps {
  children: ReactNode;
}

/**
 * Maps a Supabase/network error onto a `RecoveryReason` so the recovery
 * surface can show actionable copy instead of a generic "something
 * failed". Defaults to `'connection'` because that's the most common
 * cause of an unexpected error in this surface.
 *
 * Exported so unit tests can pin the reason-classification matrix
 * independent of the guard component.
 */
export function deriveReasonFromError(error: unknown): RecoveryReason {
  if (!error || typeof error !== 'object') return 'connection';

  // Runtime narrowing: pick fields explicitly only when they have the
  // shape we expect. No `as { ... }` cast — that silences the
  // compiler without proving anything.
  const e = error as Record<string, unknown>;
  const code = typeof e.code === 'string' ? e.code : undefined;
  const status = typeof e.status === 'number' ? e.status : undefined;
  const message = typeof e.message === 'string' ? e.message : '';

  if (code === 'PGRST116') return 'match_not_found';
  if (status === 401 || code === '401' || /jwt expired/i.test(message)) {
    return 'auth_expired';
  }
  if (typeof status === 'number' && status >= 500) return 'server_error';
  return 'connection';
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

  // Two-level recovery state.
  //   - recoveryEpoch: bumped by Hard Reset → compound key change → full
  //     subtree remount. Reload-equivalent.
  //   - softRetryFailed: flips true after a soft refetch comes back still
  //     errored. Unlocks the Hard Reset button on the recovery surface.
  const [recoveryEpoch, setRecoveryEpoch] = useState(0);
  const [softRetryFailed, setSoftRetryFailed] = useState(false);

  const phase = useMatchPhase(matchId);

  // Cross-match cleanup: when matchId changes, evict the prior match's
  // PHASE query specifically. Prior versions used the broad
  // matches.detail(matchId) prefix which also evicted leagueSettings,
  // lineup, and games — that was redundant (the body components own
  // those queries via the compound-key remount) and could race
  // in-flight realtime ticks targeted at the broader prefix.
  useEffect(() => {
    return () => {
      if (matchId) {
        queryClient.removeQueries({
          queryKey: [...queryKeys.matches.detail(matchId), 'phase'],
        });
      }
    };
  }, [matchId, queryClient]);

  // Status-based redirect — side effect goes in useEffect, never in
  // render. Calling navigate() during render is a React anti-pattern.
  // Depend on `phase.data?.status` (a primitive) rather than `phase.data`
  // (an object reference that TanStack re-creates on every poll tick),
  // so this effect re-runs only when status actually changes.
  useEffect(() => {
    if (!matchId || !phase.data) return;
    const onLineup = location.pathname.endsWith('/lineup');
    const onScore = location.pathname.endsWith('/score');
    if (phase.data.status === 'scheduled' && onScore) {
      navigate(`/match/${matchId}/lineup`, { replace: true });
    } else if (phase.data.status === 'in_progress' && onLineup) {
      navigate(`/match/${matchId}/score`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.data?.status, location.pathname, matchId, navigate]);

  // Soft retry: refetch the status query without remounting the
  // subtree. The wrapped lineup/scoring body keeps its in-progress
  // form state. If the refetch resolves cleanly, the recovery surface
  // unmounts naturally because phase.isError flips to false. If the
  // refetch fails again, softRetryFailed flips and the Hard Reset
  // button appears.
  //
  // useCallback dep is `phase.refetch` (a stable function) rather than
  // `phase` (a fresh object every render), so the callback identity
  // is genuinely stable and the recovery surface doesn't re-render
  // unnecessarily.
  const handleTryAgainSoft = useCallback(async () => {
    const result = await phase.refetch();
    if (result.isError) {
      setSoftRetryFailed(true);
    } else {
      setSoftRetryFailed(false);
    }
  }, [phase.refetch]);

  // Hard reset: also kick off a phase refetch so the recovery surface
  // doesn't immediately re-render in the same isError state. The
  // refetch puts the query into 'pending', the guard renders the
  // spinner, and the eventual settle either lands on the children
  // (success) or re-renders the recovery (still error, fresh cycle).
  // Without the refetch, the user clicks Hard Reset and sees the same
  // error surface — the button reads as a no-op.
  const handleTryAgainHard = useCallback(() => {
    setSoftRetryFailed(false);
    setRecoveryEpoch((e) => e + 1);
    void phase.refetch();
  }, [phase.refetch]);

  // Reset the softRetryFailed latch on EVERY isError transition (in or
  // out). This ensures each fresh error episode starts clean: Hard
  // Reset is reachable only after a soft retry within the current
  // episode, regardless of any prior episode's state. The setter is a
  // no-op when softRetryFailed is already false, so this is safe.
  // handleTryAgainSoft's own setSoftRetryFailed(true) call is unaffected
  // because isError doesn't change during a still-failing refetch.
  useEffect(() => {
    setSoftRetryFailed(false);
  }, [phase.isError]);

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

  // Error: fullscreen recovery surface with reason-aware copy and the
  // two-level Try Again contract.
  if (phase.isError && matchId) {
    return (
      <MatchTransitionRecovery
        matchId={matchId}
        // The guard does not have access to "the user's team in THIS
        // match" — that derivation requires match data (home/away team
        // ids) which the guard's minimal phase query doesn't fetch.
        // Passing null routes Back-to-Schedule to /dashboard, which is
        // a safe universal fallback. A future follow-up could wire a
        // useUserTeamInMatch lookup here, but the cost-benefit is low
        // for an error-recovery affordance.
        userTeamId={null}
        reason={deriveReasonFromError(phase.error)}
        softRetryFailed={softRetryFailed}
        onTryAgainSoft={handleTryAgainSoft}
        onTryAgainHard={handleTryAgainHard}
        availableActions={{
          canBackToLineup: !location.pathname.endsWith('/lineup'),
        }}
      />
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

  // Unknown status (null, future enum value, mis-typed string): render
  // the recovery surface with reason='unknown_status' so the user
  // doesn't fall through to children with a status the rest of the app
  // wasn't built to handle. The known terminal statuses
  // ('completed' / 'forfeited' / 'postponed') are handled by existing
  // post-match surfaces and pass through to children.
  const KNOWN_STATUSES = new Set([
    'scheduled',
    'in_progress',
    'completed',
    'forfeited',
    'postponed',
  ]);
  if (matchId && phase.data && !KNOWN_STATUSES.has(phase.data.status)) {
    return (
      <MatchTransitionRecovery
        matchId={matchId}
        userTeamId={null}
        reason="unknown_status"
        softRetryFailed={softRetryFailed}
        onTryAgainSoft={handleTryAgainSoft}
        onTryAgainHard={handleTryAgainHard}
        availableActions={{
          canBackToLineup: !location.pathname.endsWith('/lineup'),
        }}
      />
    );
  }

  // Status is one of the renderable states for the current path —
  // render children with the compound key on a real wrapping <div>.
  // The key MUST be on a real element, not a Fragment, for React's
  // reconciliation to actually remount on key change.
  return <div key={`${matchId}:${recoveryEpoch}`}>{children}</div>;
}
