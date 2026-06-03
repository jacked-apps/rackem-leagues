/**
 * @fileoverview Seed module: per-player lineup handicaps.
 *
 * Reads `context.homeLineup` and `context.awayLineup` (the
 * `match_lineups` rows) and writes two arrays to the bag:
 * `home_handicaps` and `away_handicaps`. Each array contains the
 * numeric handicap values for slots that have a value (nulls /
 * undefineds are filtered out so downstream sums stay clean).
 *
 * Lineup-shape covers both 3v3 (player1-3) and 5v5 (player1-5);
 * the filter handles the unused slots automatically.
 */

import type { Context, Module, StateBag } from '@/systems/chain-runtime/types';

/** A single lineup row's handicap-bearing fields. */
type LineupHandicaps = {
  readonly player1_handicap?: number | null;
  readonly player2_handicap?: number | null;
  readonly player3_handicap?: number | null;
  readonly player4_handicap?: number | null;
  readonly player5_handicap?: number | null;
};

type LineupContext = Context & {
  readonly homeLineup?: LineupHandicaps | null;
  readonly awayLineup?: LineupHandicaps | null;
};

/** Pull the up-to-5 handicap values from a lineup row, filtering nulls. */
function extractHandicaps(lineup: LineupHandicaps | null | undefined): number[] {
  if (!lineup) return [];
  const slots: Array<number | null | undefined> = [
    lineup.player1_handicap,
    lineup.player2_handicap,
    lineup.player3_handicap,
    lineup.player4_handicap,
    lineup.player5_handicap,
  ];
  return slots.filter((v): v is number => typeof v === 'number');
}

/**
 * Writes `home_handicaps: number[]` and `away_handicaps: number[]`.
 * Missing lineups produce empty arrays — never throws.
 */
export const seedLineupHandicaps: Module = {
  name: 'seedLineupHandicaps',
  run: (bag: StateBag, context: Context) => {
    const ctx = context as LineupContext;
    bag.home_handicaps = extractHandicaps(ctx.homeLineup);
    bag.away_handicaps = extractHandicaps(ctx.awayLineup);
  },
};
