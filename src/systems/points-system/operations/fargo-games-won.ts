/**
 * @fileoverview Threshold operation: Fargo games-won win threshold.
 *
 * The OTHER Fargo threshold (alongside `fargo_start_points_for_side`): instead
 * of a start-points head-start, this derives each team's games-to-win/tie/lose
 * from the lineup's Fargo ratings (FargoRate's `T = 2^(rating/100)` win
 * expectancy, summed over the pairings). Size-agnostic.
 *
 * Wires the existing `computeFargoGamesWonThresholds` utility as a threshold
 * operation so it's a clonable workshop template. Built-in math — clone to use,
 * not editable in the arithmetic builder. Never throws (null + warn on bad
 * input, e.g. an empty synthetic lineup).
 *
 * @see src/utils/handicap/fargoGamesWonThresholds.ts
 */

import { computeFargoGamesWonThresholds } from '@/utils/handicap/fargoGamesWonThresholds';
import { registerThresholdOperation } from '../threshold-registry';
import type { ThresholdInputs, ThresholdOperation, ThresholdOutputSide } from '../types';

type GamesNeededField = 'games_to_win' | 'games_to_tie' | 'games_to_lose';

export const fargoGamesWonOp: ThresholdOperation = {
  name: 'fargo_games_won',
  consumesHandicapType: 'fargo',
  consumesSize: { kind: 'lineup_sizes', sizes: 'any' },
  producesOutputType: 'game_target',
  producesOutputSide: (args): ThresholdOutputSide => {
    const side = args.side;
    return side === 'home' || side === 'away' ? side : 'shared';
  },
  producesOutputRange: { min: 0, max: 'games_in_match' },
  compute: (args, inputs: ThresholdInputs) => {
    const field = args.output_field;
    if (field !== 'games_to_win' && field !== 'games_to_tie' && field !== 'games_to_lose') {
      console.warn(`fargo_games_won: output_field must be games_to_win|games_to_tie|games_to_lose; returning null`);
      return null;
    }
    if (inputs.homeRatings.length === 0 || inputs.awayRatings.length === 0) {
      console.warn('fargo_games_won: empty lineup ratings; returning null');
      return null;
    }
    try {
      const result = computeFargoGamesWonThresholds({
        homeRatings: inputs.homeRatings,
        awayRatings: inputs.awayRatings,
        totalGames: inputs.gameCount,
      });
      const side = args.side === 'away' ? 'away' : 'home';
      return result[side][field as GamesNeededField];
    } catch (err) {
      console.warn(
        `fargo_games_won: compute failed (${err instanceof Error ? err.message : String(err)}); returning null`,
      );
      return null;
    }
  },
};

export function registerFargoGamesWon(): void {
  registerThresholdOperation(fargoGamesWonOp);
}

registerFargoGamesWon();
