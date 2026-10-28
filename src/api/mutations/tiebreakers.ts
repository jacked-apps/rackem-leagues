/**
 * @fileoverview Create the tiebreak record when a match ties — Unit 2 of
 * docs/plans/2026-10-28-001-feat-tiebreaker-record-plan.md.
 *
 * Replaces the old "unlock both match lineups" step. The match lineups are
 * never touched (requirement D0): instead a separate mini-match record is
 * written, with its own lineups seeded FROM the match lineups — so only players
 * who actually played the match can appear in the tiebreaker.
 *
 * Idempotent by design: the completion effect can re-fire (remount, realtime
 * cycle, the second verifier), and every re-fire must create nothing new. Both
 * inserts lean on the tables' UNIQUE keys with ignoreDuplicates, so a partial
 * first attempt (tiebreaker row written, a lineup insert failed) is completed
 * by the next attempt rather than left half-built.
 */

import { supabase } from '@/supabaseClient';
import type { Lineup } from '@/types/match';
import type { TiebreakerShape } from '@/utils/tiebreaker/tiebreakerShape';

/** The match-lineup fields a tiebreak lineup is seeded from. */
type SeedLineup = Pick<
  Lineup,
  | 'team_id'
  | 'player1_id' | 'player1_handicap'
  | 'player2_id' | 'player2_handicap'
  | 'player3_id' | 'player3_handicap'
  | 'player4_id' | 'player4_handicap'
  | 'player5_id' | 'player5_handicap'
>;

export interface CreateTiebreakerParams {
  matchId: string;
  /** Frozen on the record so credited handicap wins can be routed (D1). */
  gameType: string;
  shape: TiebreakerShape;
  homeLineup: SeedLineup;
  awayLineup: SeedLineup;
}

/**
 * Build one tiebreak lineup row: the first `playersPerSide` match-lineup slots
 * (players + their handicaps) in the match order; the rest left null. On the
 * lineup page anyone on the team may rearrange that order — but never swap a
 * player in or out (Ed's rule, see the plan's Unit 3).
 */
function seedRow(tiebreakerId: string, lineup: SeedLineup, playersPerSide: number) {
  const row: Record<string, string | number | null> = {
    tiebreaker_id: tiebreakerId,
    team_id: lineup.team_id,
  };
  for (let slot = 1; slot <= playersPerSide; slot++) {
    const key = `player${slot}` as 'player1';
    row[`${key}_id`] = lineup[`${key}_id`] ?? null;
    row[`${key}_handicap`] = lineup[`${key}_handicap`] ?? null;
  }
  return row as { tiebreaker_id: string; team_id: string };
}

/**
 * Create the tiebreak record (tiebreaker + one lineup per side) for a tied
 * match. Safe to call any number of times.
 *
 * @param params - Match, game type, frozen shape, and both MATCH lineups to seed from
 * @returns The tiebreaker id
 * @throws On a database error
 */
export async function createTiebreakerRecord(params: CreateTiebreakerParams): Promise<string> {
  const { matchId, gameType, shape, homeLineup, awayLineup } = params;

  // 1. The tiebreaker itself. UNIQUE(match_id) makes a re-fire a no-op.
  const { error: insertError } = await supabase.from('match_tiebreakers').upsert(
    {
      match_id: matchId,
      games_needed: shape.gamesNeeded,
      game_count: shape.gameCount,
      players_per_side: shape.playersPerSide,
      game_type: gameType,
    },
    { onConflict: 'match_id', ignoreDuplicates: true },
  );
  if (insertError) throw insertError;

  // ignoreDuplicates returns no row on conflict, so read the id back either way.
  const { data: tiebreaker, error: readError } = await supabase
    .from('match_tiebreakers')
    .select('id')
    .eq('match_id', matchId)
    .single();
  if (readError) throw readError;

  // 2. One lineup per side. UNIQUE(tiebreaker_id, team_id) makes a re-fire a
  //    no-op — and never overwrites an order a captain has already chosen.
  const { error: lineupError } = await supabase.from('match_tiebreaker_lineups').upsert(
    [
      seedRow(tiebreaker.id, homeLineup, shape.playersPerSide),
      seedRow(tiebreaker.id, awayLineup, shape.playersPerSide),
    ],
    { onConflict: 'tiebreaker_id,team_id', ignoreDuplicates: true },
  );
  if (lineupError) throw lineupError;

  return tiebreaker.id;
}
