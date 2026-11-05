/**
 * @fileoverview Pure decision helpers for `MatchPhaseGuard`.
 *
 * Kept out of `MatchPhaseGuard.tsx` so that file exports only its component
 * (keeps React fast-refresh working). Both helpers are unit-tested directly.
 */

import type { RecoveryReason } from './matchRecoveryCopy';

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
 * Pure redirect decision for a match-scoped page. Returns the phase the user
 * should be on (`'lineup'` | `'score'`) when the current path disagrees with the
 * match state, or `null` when they're already in the right place.
 *
 * Rules:
 *   - `scheduled` / `updating` (lineup phase / operator hand-entry): a user on
 *     `/score` belongs on `/lineup`.
 *   - `in_progress` (scoring phase): a user on `/lineup` belongs on `/score` —
 *     EXCEPT during the tiebreaker window (`match_result === 'tie'`), when a
 *     games-tied match stays `in_progress` while captains re-pick + lock their
 *     tiebreak lineups on `/lineup` before scoring the tiebreaker. Forcing them
 *     to `/score` there lands on the scoring page with unlocked lineups ("Both
 *     team lineups must be locked before scoring can begin"). The lineup page's
 *     own prepare-and-navigate moves them to `/score` once both sides re-lock.
 *
 * Exported so the dispatch table is unit-testable without mounting the guard.
 *
 * @param status - `matches.status`.
 * @param matchResult - `matches.match_result` (null in normal play, `'tie'` in
 *   the tiebreaker window).
 * @param pathname - The current route path.
 * @returns `'lineup'` | `'score'` to redirect, or `null` to stay put.
 */
export function computePhaseRedirect(
  status: string | undefined,
  matchResult: string | null | undefined,
  pathname: string,
): 'lineup' | 'score' | null {
  if (!status) return null;
  const onLineup = pathname.endsWith('/lineup');
  const onScore = pathname.endsWith('/score');
  const operatorEditing = status === 'scheduled' || status === 'updating';
  const inTiebreakerLineup = matchResult === 'tie';

  if (operatorEditing && onScore) return 'lineup';
  if (status === 'in_progress' && onLineup && !inTiebreakerLineup) return 'score';
  return null;
}
