/**
 * @fileoverview Games-Needed Chart — 3v3 Points-encoded variant.
 *
 * Per the locked 3v3 Games-Needed variant page
 * (`docs/league-system/modules/threshold-charts/3v3-games-needed.md`), this is
 * a discrete-table Chart calibrated for an 18-game match (5-man double
 * round-robin) consuming a Points-encoded handicap difference.
 *
 * Extracted in Phase A of the Threshold Charts extraction Unit. Implementation
 * delegates byte-identically to the existing `get3v3GamesNeeded` utility,
 * which remains the source of truth during the strangler-fig transition.
 *
 * @see docs/league-system/modules/threshold-charts/3v3-games-needed.md
 */

import { get3v3GamesNeeded } from '@/utils/handicap/get3v3GamesNeeded';
import type { GamesNeededChart } from './types';

/**
 * Games-Needed Chart — 3v3 Points variant (18-game match, double round-robin).
 *
 * Input: signed integer handicap difference in [-12, +12] (capped if outside).
 * Output: `HandicapThresholds { games_to_win, games_to_tie, games_to_lose }`
 *   — games_to_tie is non-null only at even handicap diffs (where ties are
 *   reachable in an 18-game match).
 */
export const gamesNeeded3v3Chart: GamesNeededChart = {
  kind: 'games_needed_3v3',
  compute: (handicapDiff) => get3v3GamesNeeded(handicapDiff),
};
