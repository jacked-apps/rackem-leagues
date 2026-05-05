/**
 * @fileoverview Unified recovery surface for the lineup → scoring transition.
 *
 * Renders fullscreen by `MatchPhaseGuard` whenever:
 *   - The status query fails (network, RLS, auth, server error)
 *   - The match's status comes back as a value the guard doesn't know
 *   - A future failure mode the reason enum is extended for
 *
 * Replaces the prior split UX:
 *   - Path B: lineup-page in-flight overlay with "Back to Schedule" only
 *   - Path C: scoring page's "Match Preparation Failed" card with a
 *             retry loop that's been a no-op for ~6 months
 *
 * ## Two-level Try Again
 *
 * The first appearance offers ONLY soft Try Again. Soft = re-fetch the
 * status query; the wrapped lineup/scoring body is preserved. A captain
 * who hit a transient connection blip mid-lineup-entry doesn't lose
 * the players they've already selected.
 *
 * If the soft refetch also fails, **Hard Reset** appears as a destructive
 * second-level option. Hard = compound-key bump on the guard, full
 * subtree remount, refs/memos/state all wiped. Equivalent to a browser
 * refresh but instant. Confirmation dialog before firing because Hard
 * Reset destroys in-progress form state.
 *
 * ## Reason → copy
 *
 * Each `reason` value maps to a distinct headline + body. Copy aims for
 * league-night-practical register, not generic SaaS softening — captains
 * are at a pool table on a Tuesday night and need to know what's wrong
 * and what to do, not "Match Setup Hit a Hiccup."
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/** Why the recovery surface is being rendered. Drives copy + button visibility. */
export type RecoveryReason =
  | 'connection'
  | 'match_not_found'
  | 'auth_expired'
  | 'server_error'
  | 'unknown_status';

interface CopyEntry {
  headline: string;
  body: string;
}

/** Pure mapping. Exported for tests; intentionally not memoized. */
export const RECOVERY_COPY: Record<RecoveryReason, CopyEntry> = {
  connection: {
    headline: 'Connection Lost',
    body: "We couldn't reach the server. Tap Try Again when your signal's back.",
  },
  match_not_found: {
    headline: 'Match Not Found',
    body: "This match isn't where it should be. It may have been deleted, or you might not have access.",
  },
  auth_expired: {
    headline: 'Session Expired',
    body: "You've been signed out. Sign in again to keep going.",
  },
  server_error: {
    headline: 'Something Broke On Our End',
    body: 'The server hit an error. Try again — if it keeps happening, ping support.',
  },
  unknown_status: {
    headline: 'Match State Unclear',
    body: "The match is in a state we don't recognize. Try again, or head back to the schedule.",
  },
};

interface MatchTransitionRecoveryProps {
  matchId: string;
  /** Used to build the Back-to-Schedule destination. NULL → /dashboard. */
  userTeamId: string | null;
  reason: RecoveryReason;
  /** Set true after a soft refetch fails — unlocks the destructive Hard Reset. */
  softRetryFailed: boolean;
  /** Soft refetch — preserves wrapped body's in-progress form state. */
  onTryAgainSoft: () => void;
  /** Hard Reset — bumps `recoveryEpoch` on the guard, full subtree remount. */
  onTryAgainHard: () => void;
  /** Whether the back-to-lineup button should render (false when on lineup). */
  availableActions: { canBackToLineup: boolean };
}

const MIN_DISABLED_MS = 400;

/**
 * Recovery surface rendered by `MatchPhaseGuard` on error/unknown states.
 */
export function MatchTransitionRecovery({
  matchId,
  userTeamId,
  reason,
  softRetryFailed,
  onTryAgainSoft,
  onTryAgainHard,
  availableActions,
}: MatchTransitionRecoveryProps) {
  const navigate = useNavigate();
  const [isReChecking, setIsReChecking] = useState(false);
  const [hardConfirmOpen, setHardConfirmOpen] = useState(false);

  const copy = RECOVERY_COPY[reason];
  const showTryAgain = reason !== 'auth_expired';
  const showHardReset = softRetryFailed && reason !== 'auth_expired';

  // Try Again button has a 400ms minimum disabled window so instant
  // resolves don't flicker the label. If the underlying refetch takes
  // longer than 400ms, the visible disable persists naturally because
  // the recovery surface stays mounted until the guard re-renders.
  useEffect(() => {
    if (!isReChecking) return;
    const t = window.setTimeout(() => setIsReChecking(false), MIN_DISABLED_MS);
    return () => window.clearTimeout(t);
  }, [isReChecking]);

  const handleSoftClick = useCallback(() => {
    setIsReChecking(true);
    onTryAgainSoft();
  }, [onTryAgainSoft]);

  const handleHardConfirm = useCallback(() => {
    setHardConfirmOpen(false);
    onTryAgainHard();
  }, [onTryAgainHard]);

  const handleBackToLineup = useCallback(() => {
    navigate(`/match/${matchId}/lineup`);
  }, [navigate, matchId]);

  const handleBackToSchedule = useCallback(() => {
    if (userTeamId) {
      navigate(`/team/${userTeamId}/schedule`);
    } else {
      navigate('/dashboard');
    }
  }, [navigate, userTeamId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <h1 className="text-xl font-semibold text-foreground">
            {copy.headline}
          </h1>
          <p className="text-sm text-muted-foreground">{copy.body}</p>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            {showTryAgain && (
              <Button
                variant="default"
                loadingText="none"
                onClick={handleSoftClick}
                disabled={isReChecking}
                className="flex-1"
              >
                {isReChecking ? 'Re-checking…' : 'Try Again'}
              </Button>
            )}

            {showHardReset && (
              <Button
                variant="destructive"
                loadingText="none"
                onClick={() => setHardConfirmOpen(true)}
                className="flex-1"
              >
                Hard Reset
              </Button>
            )}

            {availableActions.canBackToLineup && (
              <Button
                variant="outline"
                onClick={handleBackToLineup}
                className="flex-1"
              >
                Back to Lineup
              </Button>
            )}

            <Button
              variant="outline"
              onClick={handleBackToSchedule}
              className="flex-1"
            >
              Back to Schedule
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={hardConfirmOpen} onOpenChange={setHardConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset and try again?</AlertDialogTitle>
            <AlertDialogDescription>
              This clears any unsaved lineup changes and reloads the match
              from a clean slate. Use this only if Try Again isn't working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleHardConfirm}>
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
