/**
 * @fileoverview Lineup completeness check (Step 1 of the match-prep readiness gate).
 *
 * Pure function over a persisted match_lineups row. Reports whether the lineup
 * is "complete enough" to proceed to handicap-system agreement (Step 2) and
 * eventual threshold + games writes (Step 3).
 *
 * Completeness rules (format-agnostic, handicap-system-agnostic):
 *   1. Every slot 1..lineupSize has a non-empty player_id
 *   2. Every slot has a non-null handicap value
 *   3. No slot holds an unresolved double-duty sentinel (those require
 *      the opposing captain's OpponentSubstituteModal to resolve)
 *   4. At most one slot holds any substitute sentinel (anonymous OR
 *      double-duty) — enforces the "one sub per match" rule
 *
 * Used by:
 *   - computePrepBlockedReason (the match-prep gate) for BOTH lineups
 *   - handleLockLineup UI gate as the lock-button eligibility signal
 */

import { isAnySubSentinel, isDoubleDutySentinel } from './substituteHelpers';

export interface LineupRowLike {
  [key: string]: unknown;
  player1_id?: string | null;
  player1_handicap?: number | null;
  player2_id?: string | null;
  player2_handicap?: number | null;
  player3_id?: string | null;
  player3_handicap?: number | null;
  player4_id?: string | null;
  player4_handicap?: number | null;
  player5_id?: string | null;
  player5_handicap?: number | null;
}

export interface LineupCompletenessResult {
  complete: boolean;
  reasons: string[];
  /**
   * True iff the only reason the lineup is incomplete is a pending
   * double-duty resolution. Lets UI surface the "waiting on opposing
   * captain" affordance distinct from generic incompleteness.
   */
  onlyDoubleDutyWaiting: boolean;
}

export function computeLineupCompleteness(
  lineupRow: LineupRowLike | null | undefined,
  lineupSize: number
): LineupCompletenessResult {
  const reasons: string[] = [];

  if (!lineupRow) {
    return {
      complete: false,
      reasons: ['Lineup not found'],
      onlyDoubleDutyWaiting: false,
    };
  }

  let subSentinelCount = 0;
  let doubleDutyCount = 0;

  for (let slot = 1; slot <= lineupSize; slot++) {
    const playerId = lineupRow[`player${slot}_id`] as string | null | undefined;
    const handicap = lineupRow[`player${slot}_handicap`] as number | null | undefined;

    if (!playerId) {
      reasons.push(`Slot ${slot} has no player selected`);
      continue;
    }

    if (handicap === null || handicap === undefined) {
      reasons.push(`Slot ${slot} is missing a handicap`);
    }

    if (isAnySubSentinel(playerId)) {
      subSentinelCount++;
      if (isDoubleDutySentinel(playerId)) doubleDutyCount++;
    }
  }

  if (subSentinelCount > 1) {
    reasons.push('At most one substitute per lineup is allowed');
  }

  // A DD sentinel means: awaiting opposing captain's pick.
  const hasDdWaiting = doubleDutyCount > 0;
  const hasOtherReasons =
    reasons.length > 0 &&
    reasons.some((r) => !r.startsWith('__dd__'));

  // Adding the DD reason last, so "only-DD-waiting" means reasons == [DD reason]
  if (hasDdWaiting) {
    reasons.push('Waiting for opposing captain to pick the double-duty player');
  }

  const complete = reasons.length === 0;
  const onlyDoubleDutyWaiting =
    !complete && hasDdWaiting && !hasOtherReasons;

  return { complete, reasons, onlyDoubleDutyWaiting };
}
