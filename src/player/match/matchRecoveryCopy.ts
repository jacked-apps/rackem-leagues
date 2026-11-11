/**
 * @fileoverview Reason codes + user-facing copy for the match recovery surface.
 *
 * Lives apart from `MatchTransitionRecovery.tsx` so that file exports only
 * components (keeps React fast-refresh working); the copy table stays a pure,
 * separately testable mapping.
 */

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
