/**
 * @fileoverview Games-Needed Chart — 3v3 Points-encoded **formula** variant.
 *
 * Per the locked Points Games-Needed variant page
 * (`docs/league-system/modules/threshold-charts/3v3-games-needed.md`), this is
 * the FORMULA-shape Chart for the 3v3 (Points encoding) handicap scheme,
 * calibrated for an 18-game match (5-man double round-robin).
 *
 * Companion to the existing `gamesNeeded3v3Chart` (the TABLE-shape Chart
 * wrapping the hardcoded `HANDICAP_CHART_3V3` lookup). Per the locked
 * Threshold Charts README, formula and table are interchangeable shapes of
 * the same Chart kind — both are first-class deployment options. This file
 * ships the formula shape so leagues can pick either as their Chart.
 *
 * Formula (Ed, 2026-06-07 — simplified; reproduces the table chart exactly and
 * scales to any game count, where the prior two-branch form broke on odd ones):
 *  - tie amount (midpoint): m = (game_count + diff) / 2, diff clamped to ±12
 *  - m whole → tie = m,  win = m + 1,        lose = m − 1
 *  - m a .5  → no tie,    win = ⌈m⌉ (round up), lose = ⌊m⌋ (round down)
 *  Symmetric in diff, so the two sides' bands reconcile at every game count.
 *
 * Validation: cross-audited against `get3v3GamesNeeded` row-for-row across the
 * entire input range in `__tests__/cross-audit-3v3-formula.test.ts`.
 * Do NOT modify the formula without re-running that audit.
 *
 * @see docs/league-system/modules/threshold-charts/3v3-games-needed.md
 * @see ./games-needed-3v3.ts — the TABLE-shape companion variant
 */

import type { HandicapThresholds } from '@/types/match';
import type { GamesNeededChart } from './types';

const GAME_COUNT_3V3 = 18;
const DIFF_CAP_3V3 = 12;

/**
 * Compute the (target_stronger, target_weaker tier) thresholds from a signed
 * handicap difference, parameterized by `game_count`.
 *
 * Implementation is BYTE-EXACT from Ed's formulas. Do not "simplify" or
 * "unify" with related formulas — the form is load-bearing for future
 * handicap features even where rounding makes alternate forms equivalent
 * at the current parameters.
 */
export function computeThresholds(diff: number, gameCount: number): HandicapThresholds {
  // The TIE amount is the midpoint: m = (game_count + diff) / 2, with the
  // (signed) diff clamped to ±12. Then:
  //   - m a whole number → a tie is possible: tie = m, win = m + 1, lose = m − 1
  //   - m a .5           → no tie: win rounds up, lose rounds down
  // Symmetric in diff (home uses +diff, away uses −diff), so the two sides'
  // win/lose bands always reconcile at ANY game count — even, odd, large, or
  // small. (The earlier two-branch derivation only reconciled for even counts;
  // it broke on odd/short matches.)
  const d = Math.max(-DIFF_CAP_3V3, Math.min(DIFF_CAP_3V3, diff));
  const midpoint = (gameCount + d) / 2;

  if (Number.isInteger(midpoint)) {
    return {
      games_to_win: midpoint + 1,
      games_to_tie: midpoint,
      games_to_lose: midpoint - 1,
    };
  }
  return {
    games_to_win: Math.ceil(midpoint),
    games_to_tie: null,
    games_to_lose: Math.floor(midpoint),
  };
}

/**
 * Games-Needed Chart — 3v3 Points formula variant (18-game match).
 *
 * Input: signed integer handicap difference. Capped to ±12 internally.
 * Output: `HandicapThresholds { games_to_win, games_to_tie, games_to_lose }`,
 * same shape as the legacy chart for drop-in compatibility.
 *
 * Cross-audited against the legacy chart in
 * `__tests__/cross-audit-3v3-formula.test.ts`.
 */
export const gamesNeeded3v3FormulaChart: GamesNeededChart = {
  kind: 'games_needed_3v3_formula',
  compute: (handicapDiff) => computeThresholds(handicapDiff, GAME_COUNT_3V3),
};
