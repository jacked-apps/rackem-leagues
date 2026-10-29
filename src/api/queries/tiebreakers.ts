/**
 * @fileoverview Read the tiebreak record for a match.
 *
 * The tiebreak record (match_tiebreakers + match_tiebreaker_lineups) is a
 * parallel mini-match beside the real one (requirement D0 in
 * docs/brainstorms/2026-10-28-tiebreaker-requirements.md). Its existence is the
 * signal that a tiebreaker is under way — the match lineups are never unlocked
 * for it any more.
 */

import { supabase } from '@/supabaseClient';
import type { Database } from '@/types/database.types';

export type TiebreakerRow = Database['public']['Tables']['match_tiebreakers']['Row'];
export type TiebreakerLineupRow = Database['public']['Tables']['match_tiebreaker_lineups']['Row'];

/** A tiebreaker plus its per-side lineups. */
export interface MatchTiebreaker extends TiebreakerRow {
  match_tiebreaker_lineups: TiebreakerLineupRow[];
}

/**
 * Fetch the tiebreak record for a match, with both lineups embedded.
 *
 * @param matchId - The tied match
 * @returns The record, or null when the match has no tiebreaker (the normal
 *   case — including tiebreakers resolved before records existed, D5)
 * @throws On a database error
 */
export async function getMatchTiebreaker(matchId: string): Promise<MatchTiebreaker | null> {
  const { data, error } = await supabase
    .from('match_tiebreakers')
    .select('*, match_tiebreaker_lineups(*)')
    .eq('match_id', matchId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Pick one side's lineup off a record.
 *
 * @param record - The tiebreak record (or null/undefined while loading)
 * @param teamId - The side wanted
 * @returns That side's tiebreak lineup, or undefined when it is not there yet
 */
export function tiebreakLineupFor(
  record: MatchTiebreaker | null | undefined,
  teamId: string | null | undefined,
): TiebreakerLineupRow | undefined {
  return record?.match_tiebreaker_lineups.find((l) => l.team_id === teamId);
}
