/**
 * @fileoverview Match-completion scoring-consistency audit (Phase 5 Unit 5.6).
 *
 * Purpose: at match completion, compare the match row's stored running
 * totals against a fresh recompute from `match_games` rows. If they
 * diverge, the audit returns a structured discrepancy report that the
 * caller can write to `app_logs` for the dev to investigate. The match
 * record is NEVER modified — players' witnessed scoreboard remains the
 * source of truth.
 *
 * Why no auto-correction:
 *  - Player UX: scoreboard showed X live; if a recompute showed Y at
 *    match-end and we silently changed the stored value, players would
 *    see the mismatch and gripe about something they can't articulate.
 *  - Engineering: auto-correction hides the underlying bug. We want
 *    loud canaries, not silent recovery.
 *  - Investigation: with the original X stored AND the diff in
 *    `app_logs`, the dev knows exactly what happened. With auto-correct
 *    we'd never know which value was right.
 *
 * This file holds the PURE comparison logic. The IO wrapper that fetches
 * the match row + games and writes the divergence to `app_logs` lives in
 * `src/api/queries/matches.ts` (alongside `updateMatchRunningTotals`,
 * `populateMatchSnapshotIfNeeded`).
 *
 * @see docs/plans/2026-05-01-001-feat-modular-league-system-v2-plan.md (Unit 5.6)
 */

import type { MatchRunningTotals } from './computeMatchRunningTotals';

/** A single field-level mismatch between stored and recomputed totals. */
export interface RunningTotalDiscrepancy {
  field:
    | 'home_games_won'
    | 'away_games_won'
    | 'home_points_earned'
    | 'away_points_earned';
  /** What the recompute says the value should be. */
  expected: number;
  /** What the match row currently has. */
  actual: number;
  /** `actual - expected` — positive = stored too high, negative = stored too low. */
  diff: number;
}

/** Result of a running-totals audit. `ok: true` ⇒ `discrepancies` is empty. */
export interface MatchScoringAuditResult {
  ok: boolean;
  discrepancies: ReadonlyArray<RunningTotalDiscrepancy>;
}

/**
 * Compare a match row's stored running totals against a freshly-computed
 * expected snapshot. Returns a list of per-field mismatches.
 *
 * Pure function — no IO, no logging. The caller decides what to do with
 * the result (typically: write to `app_logs` if `!ok`, do nothing if
 * `ok`).
 *
 * @param actual   The match row's stored totals (read from the matches
 *                 table — `home_games_won` / `away_games_won` /
 *                 `home_points_earned` / `away_points_earned`).
 * @param expected The recomputed totals from
 *                 `computeMatchRunningTotals` over the current set of
 *                 `match_games` rows.
 */
export function compareRunningTotals(
  actual: MatchRunningTotals,
  expected: MatchRunningTotals,
): MatchScoringAuditResult {
  const discrepancies: RunningTotalDiscrepancy[] = [];

  const fields = [
    'home_games_won',
    'away_games_won',
    'home_points_earned',
    'away_points_earned',
  ] as const;

  for (const field of fields) {
    if (actual[field] !== expected[field]) {
      discrepancies.push({
        field,
        expected: expected[field],
        actual: actual[field],
        diff: actual[field] - expected[field],
      });
    }
  }

  return {
    ok: discrepancies.length === 0,
    discrepancies,
  };
}
