/**
 * @fileoverview Games-Needed Chart — 5v5 Percentage-encoded variant.
 *
 * Per the locked 5v5 Games-Needed variant page
 * (`docs/league-system/modules/threshold-charts/5v5-games-needed.md`), this is
 * a discrete-range Chart calibrated for a 25-game match (8-man single
 * round-robin) consuming a Percentage-encoded handicap difference (BCAPL chart).
 *
 * Extracted in Phase A of the Threshold Charts extraction Unit. Implementation
 * delegates byte-identically to the existing `get5v5GamesNeeded` utility.
 *
 * @see docs/league-system/modules/threshold-charts/5v5-games-needed.md
 */

import { get5v5GamesNeeded } from '@/utils/handicap/get5v5GamesNeeded';
import type { GamesNeededChart } from './types';

/**
 * Games-Needed Chart — 5v5 Percentage variant (25-game match, single round-robin).
 *
 * Input: percentage-based handicap difference (0–500 range). The chart looks
 * up the matching 7-range bucket and routes asymmetric values to the higher
 * vs. lower handicap team.
 *
 * Output: `HandicapThresholds { games_to_win, games_to_tie=null, games_to_lose }`
 *   — games_to_tie is always null (25 games is odd; no ties possible).
 */
export const gamesNeeded5v5Chart: GamesNeededChart = {
  kind: 'games_needed_5v5',
  compute: (handicapDiff) => get5v5GamesNeeded(handicapDiff),
};
