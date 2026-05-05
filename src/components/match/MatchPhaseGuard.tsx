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
 */
function deriveReasonFromError(error: unknown): RecoveryReason {
  if (!error || typeof error !== 'object') return 'connection';
  const e = error as { code?: string; status?: number; message?: string };
  if (e.code === 'PGRST116') return 'match_not_found';
  if (e.status === 401 || e.code === '401' || /jwt expired/i.test(e.message || '')) {
    return 'auth_expired';
  }
  if (typeof e.status === 'number' && e.status >= 500) return 'server_error';
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

  // Soft retry: refetch the status query without remounting the
  // subtree. The wrapped lineup/scoring body keeps its in-progress
  // form state. If the refetch resolves cleanly, the recovery surface
  // unmounts naturally because phase.isError flips to false. If the
  // refetch fails again, softRetryFailed flips and the Hard Reset
  // button appears.
  const handleTryAgainSoft = useCallback(async () => {
    const result = await phase.refetch();
    if (result.isError) {
      setSoftRetryFailed(true);
    } else {
      setSoftRetryFailed(false);
    }
  }, [phase]);

  // Hard reset: bump the compound key. Children remount from scratch.
  // Reset softRetryFailed so the next failure cycle starts fresh.
  const handleTryAgainHard = useCallback(() => {
    setSoftRetryFailed(false);
    setRecoveryEpoch((e) => e + 1);
  }, []);

  // When phase transitions back to a non-error state on its own (e.g.
  // realtime tick resolved the issue mid-recovery), reset the
  // softRetryFailed latch so the next error cycle starts clean.
  useEffect(() => {
    if (!phase.isError && softRetryFailed) {
      setSoftRetryFailed(false);
    }
  }, [phase.isError, softRetryFailed]);

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

  // Status is one of the renderable states for the current path —
  // render children with the compound key on a real wrapping <div>.
  // The key MUST be on a real element, not a Fragment, for React's
  // reconciliation to actually remount on key change.
  return <div key={`${matchId}:${recoveryEpoch}`}>{children}</div>;
}
