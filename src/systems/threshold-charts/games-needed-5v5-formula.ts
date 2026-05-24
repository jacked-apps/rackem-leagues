/**
 * @fileoverview Games-Needed Chart — 5v5 Percentage-encoded **formula** variant.
 *
 * Per the locked Percentage Games-Needed variant page
 * (`docs/league-system/modules/threshold-charts/5v5-games-needed.md`), this is
 * the FORMULA-shape Chart for Percentage encoding. Universal across team sizes
 * (parameterized by `game_count`). Calibrated to reproduce BCAPL's published
 * 7-bucket Standard Handicap Chart at game_count=25 row-for-row.
 *
 * Companion to the existing `gamesNeeded5v5Chart` (the TABLE-shape Chart
 * wrapping the hardcoded `BCA_5V5_RANGES` range-lookup).
 *
 * Formula source (locked spec — implemented BYTE-EXACT):
 *  - target_stronger_base = ⌈(game_count + 1) / 2⌉
 *  - target_weaker_base   = ⌊(game_count + 1) / 2⌋
 *  - bucket_width         = game_count + 1
 *  - first_bucket_end     = ⌊bucket_width / 2⌋ + 1
 *  - offset               = bucket_width − first_bucket_end − 1
 *  - max_gap_level        = ⌊(game_count − 1) / 4⌋
 *  - gap_cap              = max_gap_level × bucket_width − offset
 *  - effective_diff       = min(|diff|, gap_cap)
 *  - gap_level            = ⌊(effective_diff + offset) / bucket_width⌋
 *  - target_stronger      = target_stronger_base + gap_level
 *  - target_weaker        = target_weaker_base   − gap_level
 *
 * Validation: cross-audited against `get5v5GamesNeeded` across all 7 BCAPL
 * buckets in `__tests__/cross-audit-5v5-formula.test.ts`. Do NOT modify the
 * formula without re-running that audit.
 *
 * @see docs/league-system/modules/threshold-charts/5v5-games-needed.md
 * @see ./games-needed-5v5.ts — the TABLE-shape companion variant
 */

import type { HandicapThresholds } from '@/types/match';
import type { GamesNeededChart } from './types';

const GAME_COUNT_5V5 = 25;

interface FormulaTargets {
  target_stronger: number;
  target_weaker: number;
}

/**
 * Compute (target_stronger, target_weaker) from a signed handicap difference.
 * BYTE-EXACT from the locked 5v5-games-needed.md pseudocode.
 */
function computeTargets(diff: number, gameCount: number): FormulaTargets {
  const target_stronger_base = Math.ceil((gameCount + 1) / 2);
  const target_weaker_base = Math.floor((gameCount + 1) / 2);

  const bucket_width = gameCount + 1;
  const first_bucket_end = Math.floor(bucket_width / 2) + 1;
  const offset = bucket_width - first_bucket_end - 1;
  const max_gap_level = Math.floor((gameCount - 1) / 4);
  const gap_cap = max_gap_level * bucket_width - offset;

  const effective_diff = Math.min(Math.abs(diff), gap_cap);
  const gap_level = Math.floor((effective_diff + offset) / bucket_width);

  const target_stronger = target_stronger_base + gap_level;
  const target_weaker = target_weaker_base - gap_level;

  return { target_stronger, target_weaker };
}

/**
 * Project the (target_stronger, target_weaker) 2-tuple onto the legacy
 * HandicapThresholds 3-field shape for the requested perspective. Tie is
 * always null at game_count=25 (odd game count; ties not possible).
 */
function computeThresholds(diff: number, gameCount: number): HandicapThresholds {
  const { target_stronger, target_weaker } = computeTargets(diff, gameCount);

  // For diff >= 0 the requesting team is the stronger (or even); flip perspective for negative.
  // games_to_lose = game_count − opponent's games_to_win (when opponent reaches
  // their win, this team has at most gameCount − opponent_win wins remaining).
  if (diff >= 0) {
    return {
      games_to_win: target_stronger,
      games_to_tie: null,
      games_to_lose: gameCount - target_weaker,
    };
  }

  return {
    games_to_win: target_weaker,
    games_to_tie: null,
    games_to_lose: gameCount - target_stronger,
  };
}

/**
 * Games-Needed Chart — 5v5 Percentage formula variant (25-game match).
 *
 * Input: signed Percentage-encoded handicap difference (0–500 typical range;
 * formula caps internally at gap_cap = 145).
 * Output: `HandicapThresholds`; games_to_tie always null (25 games = odd).
 *
 * Cross-audited against the legacy chart in
 * `__tests__/cross-audit-5v5-formula.test.ts`.
 */
export const gamesNeeded5v5FormulaChart: GamesNeededChart = {
  kind: 'games_needed_5v5_formula',
  compute: (handicapDiff) => computeThresholds(handicapDiff, GAME_COUNT_5V5),
};
