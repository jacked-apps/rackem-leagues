/**
 * @fileoverview Match-preparation gate — discriminated `PrepBlockedReason`.
 *
 * Combines the Step 1 completeness checks for both lineups with the Step 2
 * Fargo consensus state. Returns a single discriminated value that:
 *   - tells useMatchPreparation whether to run (null = ready, else blocked)
 *   - gives MatchLineup.tsx enough information to render the right waiting
 *     state (banner, modal, Fargo card, etc.)
 *   - surfaces the reason in logs for prod debugging
 *
 * Precedence when multiple variants could apply:
 *   lineup_incomplete  >  waiting_on_sub_resolution  >  fargo_pending  >  null
 *
 * Rationale: completeness is upstream of negotiation — you can't negotiate
 * Fargo start-points against an incomplete lineup. And "waiting on opposing
 * captain" is a specific sub-case of incompleteness, surfaced separately so
 * the UI can show the banner/modal instead of a generic message.
 */

import {
  computeLineupCompleteness,
  type LineupRowLike,
} from './lineupCompleteness';

export type PrepBlockedReason =
  | { kind: 'lineup_incomplete'; side: 'mine' | 'opponent'; reasons: string[] }
  | { kind: 'waiting_on_sub_resolution'; lineupWithPlaceholder: 'mine' | 'opponent' }
  | { kind: 'fargo_pending'; myConfirmed: boolean; oppConfirmed: boolean }
  | null;

export interface ComputePrepBlockedReasonParams {
  myLineup: LineupRowLike | null | undefined;
  opponentLineup: LineupRowLike | null | undefined;
  lineupSize: number;
  handicapType: string;
  /** Fargo state — ignored when handicapType !== 'fargo'. */
  confirmedByHome?: string | null;
  confirmedByAway?: string | null;
  /** Which side is "me" — used to label Fargo confirm flags. */
  isHomeTeam: boolean;
}

export function computePrepBlockedReason(
  params: ComputePrepBlockedReasonParams
): PrepBlockedReason {
  const {
    myLineup,
    opponentLineup,
    lineupSize,
    handicapType,
    confirmedByHome,
    confirmedByAway,
    isHomeTeam,
  } = params;

  // Step 1 — check both lineups. My side first so errors I can fix take priority.
  const mine = computeLineupCompleteness(myLineup, lineupSize);
  if (!mine.complete) {
    if (mine.onlyDoubleDutyWaiting) {
      return { kind: 'waiting_on_sub_resolution', lineupWithPlaceholder: 'mine' };
    }
    return { kind: 'lineup_incomplete', side: 'mine', reasons: mine.reasons };
  }

  const opp = computeLineupCompleteness(opponentLineup, lineupSize);
  if (!opp.complete) {
    if (opp.onlyDoubleDutyWaiting) {
      return { kind: 'waiting_on_sub_resolution', lineupWithPlaceholder: 'opponent' };
    }
    return { kind: 'lineup_incomplete', side: 'opponent', reasons: opp.reasons };
  }

  // Step 2 — Fargo agreement (other systems skip this step entirely).
  if (handicapType === 'fargo') {
    const myConfirmed = isHomeTeam ? !!confirmedByHome : !!confirmedByAway;
    const oppConfirmed = isHomeTeam ? !!confirmedByAway : !!confirmedByHome;
    if (!myConfirmed || !oppConfirmed) {
      return { kind: 'fargo_pending', myConfirmed, oppConfirmed };
    }
  }

  // All gates passed — ready for Step 3.
  return null;
}
