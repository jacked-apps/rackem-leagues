/**
 * @fileoverview Eligibility + status-label helpers for the LO manual-scoring
 * match picker.
 *
 * The authoritative eligibility predicate is `status === 'scheduled'` — the same
 * condition `prep_match` guards on, so the picker and the RPC can never disagree
 * (a match that's already started or scored is off-limits to v1's enter-from-blank
 * flow). A BYE (a side with no real team) is also ineligible — there's nothing to
 * score.
 *
 * @see docs/plans/2026-06-03-001-feat-lo-manual-match-scoring-plan.md — Unit 4 / R11
 */

import type { MatchWithDetails } from '@/types/schedule';

/**
 * Can this match be opened in the manual-scoring (enter/continue) surface?
 *
 * True for a `scheduled` match (start fresh → Setup) OR an `updating` match (a
 * manual entry the operator already set up but hasn't finalized → resume scoring),
 * with two real teams (not a BYE). Both route to the same page, which dispatches
 * on status. An `updating` match is what lets an operator walk away mid-entry and
 * come back to it from the picker.
 */
export function isMatchEligibleForManualScoring(match: MatchWithDetails): boolean {
  return (
    (match.status === 'scheduled' || match.status === 'updating') &&
    hasTwoRealTeams(match)
  );
}

/**
 * Can this match be opened in the v2 review/correct surface?
 *
 * True for finished matches (`completed` / `awaiting_verification`) with two real
 * teams. Also true for a **reopened-not-refinalized** match (`in_progress` but with
 * a `completed_at` still set — an abandoned correction), so it's recoverable.
 * Plain `in_progress` (actively being scored), `scheduled`, `forfeited`, and
 * `postponed` are NOT openable here.
 */
export function isMatchEligibleForReview(match: MatchWithDetails): boolean {
  const finished = match.status === 'completed' || match.status === 'awaiting_verification';
  const reopenedAbandoned =
    match.status === 'in_progress' &&
    !!(match as { completed_at?: unknown }).completed_at;
  return (finished || reopenedAbandoned) && hasTwoRealTeams(match);
}

/** Both sides are real teams (not a BYE). */
function hasTwoRealTeams(match: MatchWithDetails): boolean {
  return (
    !!match.home_team &&
    match.home_team.status !== 'bye' &&
    !!match.away_team &&
    match.away_team.status !== 'bye'
  );
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  updating: 'Updating',
  in_progress: 'In Progress',
  awaiting_verification: 'Awaiting Verification',
  completed: 'Completed',
  forfeited: 'Forfeited',
  postponed: 'Postponed',
};

/** Human-readable badge label for a match status (falls back to the raw value). */
export function manualScoringStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}
