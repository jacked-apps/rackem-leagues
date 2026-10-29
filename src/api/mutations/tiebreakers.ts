/**
 * @fileoverview Create the tiebreak record when a match ties — Unit 2 of
 * docs/plans/2026-10-28-001-feat-tiebreaker-record-plan.md.
 *
 * Replaces the old "unlock both match lineups" step. The match lineups are
 * never touched (requirement D0): instead a separate mini-match record is
 * written, with one EMPTY lineup per side. Ed (2026-10-29): the order starts
 * blank — a pre-filled order meant removing players just to reorder them. Only
 * players who played the match can be picked, because the lineup page builds
 * its dropdown list from the match lineup (src/utils/tiebreaker/tiebreakPicks.ts);
 * each pick copies that player's handicap from the match lineup.
 *
 * Idempotent by design: the completion effect can re-fire (remount, realtime
 * cycle, the second verifier), and every re-fire must create nothing new. Both
 * inserts lean on the tables' UNIQUE keys with ignoreDuplicates, so a partial
 * first attempt (tiebreaker row written, a lineup insert failed) is completed
 * by the next attempt rather than left half-built.
 */

import { supabase } from '@/supabaseClient';
import type { TiebreakerShape } from '@/utils/tiebreaker/tiebreakerShape';

export interface CreateTiebreakerParams {
  matchId: string;
  /** Frozen on the record so credited handicap wins can be routed (D1). */
  gameType: string;
  shape: TiebreakerShape;
  homeTeamId: string;
  awayTeamId: string;
}

/**
 * Create the tiebreak record (tiebreaker + one lineup per side) for a tied
 * match. Safe to call any number of times.
 *
 * @param params - Match, game type, frozen shape, and the two teams
 * @returns The tiebreaker id
 * @throws On a database error
 */
export async function createTiebreakerRecord(params: CreateTiebreakerParams): Promise<string> {
  const { matchId, gameType, shape, homeTeamId, awayTeamId } = params;

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

  // 2. One EMPTY lineup per side. UNIQUE(tiebreaker_id, team_id) makes a
  //    re-fire a no-op — and never wipes an order a team has already chosen.
  const { error: lineupError } = await supabase.from('match_tiebreaker_lineups').upsert(
    [
      { tiebreaker_id: tiebreaker.id, team_id: homeTeamId },
      { tiebreaker_id: tiebreaker.id, team_id: awayTeamId },
    ],
    { onConflict: 'tiebreaker_id,team_id', ignoreDuplicates: true },
  );
  if (lineupError) throw lineupError;

  return tiebreaker.id;
}
