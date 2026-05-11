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
  /**
   * Win-condition axis from the resolved preferences. The Fargo
   * confirmation gate only applies to Fargo + win_condition='points'
   * (the start-points-negotiation flow). Fargo + win_condition='games'
   * skips negotiation — thresholds are computed deterministically from
   * lineup ratings via `computeFargoGamesWonThresholds` (Phase 3 Unit 3.2).
   * Defaults to 'games' when omitted (matches the typical BCA preset).
   */
  winCondition?: 'games' | 'points';
  /**
   * Fargo confirmation tracking — ignored when handicapType !== 'fargo'
   * OR when winCondition !== 'points'. Each captain stamps their
   * `system_player_number` into their side's `*_games_to_lose` when
   * they confirm. Both non-null = both confirmed.
   */
  homeGamesToLose?: number | null;
  awayGamesToLose?: number | null;
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
    winCondition,
    homeGamesToLose,
    awayGamesToLose,
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
  // Confirmation = captain's system_player_number written to their
  // side's *_games_to_lose. Both non-null = both confirmed.
  //
  // Phase 3 Unit 3.2: only apply this gate to Fargo + win_condition='points'
  // (the start-points-negotiation flow). Fargo + win_condition='games'
  // computes thresholds deterministically from lineup ratings and
  // doesn't need captain consensus.
  if (handicapType === 'fargo' && (winCondition ?? 'games') === 'points') {
    const myConfirmed = isHomeTeam
      ? homeGamesToLose !== null && homeGamesToLose !== undefined
      : awayGamesToLose !== null && awayGamesToLose !== undefined;
    const oppConfirmed = isHomeTeam
      ? awayGamesToLose !== null && awayGamesToLose !== undefined
      : homeGamesToLose !== null && homeGamesToLose !== undefined;
    if (!myConfirmed || !oppConfirmed) {
      return { kind: 'fargo_pending', myConfirmed, oppConfirmed };
    }
  }

  // All gates passed — ready for Step 3.
  return null;
}
