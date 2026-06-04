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
 * Can this match be manually scored in v1 (enter-from-blank)?
 *
 * True only when the match is `scheduled` (nothing recorded yet) AND both sides
 * are real teams (not a BYE).
 */
export function isMatchEligibleForManualScoring(match: MatchWithDetails): boolean {
  return (
    match.status === 'scheduled' &&
    !!match.home_team &&
    match.home_team.status !== 'bye' &&
    !!match.away_team &&
    match.away_team.status !== 'bye'
  );
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
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
