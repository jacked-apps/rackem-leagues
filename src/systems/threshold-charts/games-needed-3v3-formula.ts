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
 * Formula source (Ed-provided, 2026-05-18 — implemented BYTE-EXACT):
 *  - target_stronger = ⌈(game_count + 2) / 2⌉ + ⌊|effective_diff| / 2⌋
 *  - target_weaker derived from midpoint: remaining = game_count − |effective_diff|.
 *    Round (remaining even): tie = remaining/2; win = tie + 1; lose = tie − 1.
 *    Half (remaining odd):   tie = null; win = ⌈remaining/2⌉; lose = ⌊remaining/2⌋.
 *  - Cap: |diff| clamped to 12 at the input (important for future handicap features).
 *  - Sum invariant: tie situation → winning thresholds sum to game_count;
 *    non-tie situation → winning thresholds sum to game_count + 1.
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
function computeThresholds(diff: number, gameCount: number): HandicapThresholds {
  // Cap |diff| at DIFF_CAP_3V3 per Ed's rule.
  const cappedAbsDiff = Math.min(Math.abs(diff), DIFF_CAP_3V3);

  // Ed's stronger-side formula, byte-exact.
  const stronger_win =
    Math.ceil((gameCount + 2) / 2) + Math.floor(cappedAbsDiff / 2);

  // Ed's weaker-side formulation: (game_count − |diff|) / 2.
  // Round → tie; .5 → round-up for win, round-down for lose, no tie.
  const remaining = gameCount - cappedAbsDiff;
  const remainingIsEven = remaining % 2 === 0;

  let weaker_win: number;
  let weaker_tie: number | null;
  let weaker_lose: number;

  if (remainingIsEven) {
    const tie = remaining / 2;
    weaker_tie = tie;
    weaker_win = tie + 1;
    weaker_lose = tie - 1;
  } else {
    weaker_tie = null;
    weaker_win = (remaining + 1) / 2;
    weaker_lose = (remaining - 1) / 2;
  }

  // Pick the perspective based on the sign of diff:
  //  - diff >= 0: this team is the stronger (or even). Return their thresholds.
  //  - diff <  0: this team is the weaker. Return their thresholds.
  //
  // Stronger-side tie/lose derivation:
  //  - stronger_lose = game_count − weaker_win
  //    (when opponent reaches their win threshold, this team has at most
  //     game_count − opponent's win count remaining)
  //  - stronger_tie = game_count − weaker_tie when tie exists; null otherwise
  //    (per Ed's sum invariant: tie thresholds sum to game_count)
  if (diff >= 0) {
    const stronger_lose = gameCount - weaker_win;
    const stronger_tie = weaker_tie === null ? null : gameCount - weaker_tie;
    return {
      games_to_win: stronger_win,
      games_to_tie: stronger_tie,
      games_to_lose: stronger_lose,
    };
  }

  return {
    games_to_win: weaker_win,
    games_to_tie: weaker_tie,
    games_to_lose: weaker_lose,
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
