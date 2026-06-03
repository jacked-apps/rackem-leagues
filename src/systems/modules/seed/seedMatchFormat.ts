/**
 * @fileoverview Seed module: match format basics.
 *
 * Reads `context.prefs` (or whatever resolved-preferences shape the
 * caller provides) and writes `lineup_size`, `game_generation`, and
 * the derived `total_games` count to the bag. Downstream threshold
 * modules (esp. Fargo games-won) read these from the bag.
 */

import { computeGameCount } from '@/systems/team-geometry';
import type { Context, Module, StateBag } from '@/systems/chain-runtime/types';

type MatchFormatContext = Context & {
  readonly prefs?: {
    readonly lineupSize?: number | null;
    readonly gameGeneration?: string | null;
  } | null;
};

/**
 * Writes `lineup_size`, `game_generation`, `total_games` to the bag.
 *
 * If prefs are missing, writes sensible defaults: lineup_size=0,
 * game_generation='single_round_robin', total_games=0. Threshold
 * modules that need a meaningful value handle the zero case
 * themselves — this module never throws.
 */
export const seedMatchFormat: Module = {
  name: 'seedMatchFormat',
  run: (bag: StateBag, context: Context) => {
    const ctx = context as MatchFormatContext;
    const prefs = ctx.prefs ?? null;
    const lineupSize = prefs?.lineupSize ?? 0;
    const gameGeneration = prefs?.gameGeneration ?? 'single_round_robin';
    bag.lineup_size = lineupSize;
    bag.game_generation = gameGeneration;
    bag.total_games = lineupSize > 0 ? computeGameCount(lineupSize, gameGeneration) : 0;
  },
};
