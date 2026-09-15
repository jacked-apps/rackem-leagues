/**
 * @fileoverview Human names for how a game ended.
 *
 * Deliberately game-type neutral. The scoring dialog says "9 on the Break" for
 * a 9-ball league because it knows what is being played; a stats page spanning
 * several leagues does not, and inventing a per-row label would mean carrying
 * game_type through every layer to change one word. "Golden break" is correct
 * everywhere and understood by anyone who plays.
 *
 * @see src/stats/playerGameRow.ts
 */

import type { GameEnding } from './playerGameRow';

/** Display name per ending. */
export const ENDING_LABELS: Record<GameEnding, string> = {
  break_and_run: 'Break & run',
  golden_break: 'Golden break',
  runout: 'Runout',
  early_eight: 'Early 8',
  forfeit: 'Forfeit',
  // Not "none" — most games end this way, and calling the normal case "none"
  // reads as missing data rather than as an ordinary game of pool.
  plain: 'Ordinary win',
};

/**
 * Label for one ending.
 *
 * @param ending - The ending to name.
 * @returns Its display name.
 */
export function endingLabel(ending: GameEnding): string {
  return ENDING_LABELS[ending] ?? ending;
}
