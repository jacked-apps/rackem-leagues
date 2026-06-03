/**
 * @fileoverview Seed module: per-slot player IDs and lineup row IDs.
 *
 * Reads `context.homeLineup` and `context.awayLineup` (the
 * `match_lineups` rows) and writes:
 * - `home_player_ids: (string | null)[]` — 5-element array, slot
 *   position preserved; nulls represent empty slots
 * - `away_player_ids: (string | null)[]` — same shape
 * - `home_lineup_id: string | null` — the home lineup row's ID
 * - `away_lineup_id: string | null` — the away lineup row's ID
 *
 * The arrays are null-preserving (unlike `seedLineupHandicaps` which
 * filters nulls for clean math) because downstream consumers like the
 * scoreboard need to know which slot a player is in.
 *
 * Not used by today's threshold modules, but seeded anyway: the
 * scoreboard module, the confirm flow, and the swap flow will all
 * need this. State bag is shared infrastructure for the life of the
 * match — bloat is fine.
 */

import type { Context, Module, StateBag } from '@/systems/chain-runtime/types';

/** A single lineup row's player-ID-bearing fields plus its row ID. */
type LineupPlayers = {
  readonly id?: string | null;
  readonly player1_id?: string | null;
  readonly player2_id?: string | null;
  readonly player3_id?: string | null;
  readonly player4_id?: string | null;
  readonly player5_id?: string | null;
};

type LineupPlayersContext = Context & {
  readonly homeLineup?: LineupPlayers | null;
  readonly awayLineup?: LineupPlayers | null;
};

/** Pull the 5 player-ID slots from a lineup row, preserving null slots. */
function extractPlayerIds(lineup: LineupPlayers | null | undefined): Array<string | null> {
  if (!lineup) return [null, null, null, null, null];
  return [
    lineup.player1_id ?? null,
    lineup.player2_id ?? null,
    lineup.player3_id ?? null,
    lineup.player4_id ?? null,
    lineup.player5_id ?? null,
  ];
}

/**
 * Writes per-slot player IDs (null-preserving, 5 slots) and the
 * lineup row IDs to the bag. Missing lineups produce all-null arrays
 * and null row IDs — never throws.
 */
export const seedLineupPlayers: Module = {
  name: 'seedLineupPlayers',
  run: (bag: StateBag, context: Context) => {
    const ctx = context as LineupPlayersContext;
    bag.home_player_ids = extractPlayerIds(ctx.homeLineup);
    bag.away_player_ids = extractPlayerIds(ctx.awayLineup);
    bag.home_lineup_id = ctx.homeLineup?.id ?? null;
    bag.away_lineup_id = ctx.awayLineup?.id ?? null;
  },
};
