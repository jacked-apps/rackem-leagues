/**
 * @fileoverview Writes to a tiebreak lineup — Unit 3 of
 * docs/plans/2026-10-28-001-feat-tiebreaker-record-plan.md.
 *
 * Every write here targets match_tiebreaker_lineups (and, on lock, the
 * tiebreak match_games rows). NOTHING here touches match_lineups: a tiebreaker
 * never unlocks, re-locks or rewrites the match lineup (requirement D0), which
 * is what made the old re-lock recalculate handicaps and the team bonus
 * (audit F1).
 */

import { supabase } from '@/supabaseClient';

/**
 * Put a player in one tiebreak slot (or clear it).
 *
 * @param lineupId - The match_tiebreaker_lineups row
 * @param position - Slot, 1-based
 * @param playerId - Member id, or null to clear
 * @param handicap - COPIED from the match lineup (never recalculated), or null
 * @throws On a database error
 */
export async function setTiebreakSlot(
  lineupId: string,
  position: number,
  playerId: string | null,
  handicap: number | null,
): Promise<void> {
  const { error } = await supabase
    .from('match_tiebreaker_lineups')
    .update({ [`player${position}_id`]: playerId, [`player${position}_handicap`]: handicap })
    .eq('id', lineupId);
  if (error) throw error;
}

export interface LockTiebreakParams {
  lineupId: string;
  isHomeTeam: boolean;
  /** Chosen order, index 0 = position 1. */
  order: string[];
  /** This match's tiebreak game rows (any order — sorted here). */
  games: { id: string; game_number: number }[];
}

/**
 * Lock a side's tiebreak order.
 *
 * Scoring reads WHO SHOOTS each tiebreak game from the game rows, so the order
 * is copied onto them first — game N gets position N (wrapping if a format
 * ever lays out more games than players). Then the lineup is locked; the lock
 * is what tells both devices this side is ready, so it must come last.
 *
 * @param params - Lineup, side, order, and the tiebreak games
 * @throws On a database error (lineup stays unlocked, so it can be retried)
 */
export async function lockTiebreakLineup(params: LockTiebreakParams): Promise<void> {
  const { lineupId, isHomeTeam, order, games } = params;
  const playerColumn = isHomeTeam ? 'home_player_id' : 'away_player_id';
  const sorted = [...games].sort((a, b) => a.game_number - b.game_number);

  for (const [index, game] of sorted.entries()) {
    const { error } = await supabase
      .from('match_games')
      .update({ [playerColumn]: order[index % order.length] })
      .eq('id', game.id);
    if (error) throw error;
  }

  const { error } = await supabase
    .from('match_tiebreaker_lineups')
    .update({ locked: true })
    .eq('id', lineupId);
  if (error) throw error;
}

/**
 * Unlock a side's tiebreak order so it can be changed.
 *
 * @param lineupId - The match_tiebreaker_lineups row
 * @throws On a database error
 */
export async function unlockTiebreakLineup(lineupId: string): Promise<void> {
  const { error } = await supabase
    .from('match_tiebreaker_lineups')
    .update({ locked: false, locked_at: null })
    .eq('id', lineupId);
  if (error) throw error;
}
