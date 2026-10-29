/**
 * @fileoverview Record who won a tiebreaker — Unit 4 of
 * docs/plans/2026-10-28-001-feat-tiebreaker-record-plan.md.
 *
 * Replaces the old "overwrite all three tiebreak games as won by the winning
 * team" step. That overwrite existed only to smuggle handicap credit into the
 * game rows; it also made the per-game record untrue (requirement D2). Now the
 * game rows keep what actually happened at the table, and the credit lives
 * here: `winning_team_id` on the tiebreak record. The handicap calculator
 * credits the winning side's tiebreak lineup from it (Unit 5,
 * src/api/queries/tiebreakSlots.ts).
 */

import { supabase } from '@/supabaseClient';

/**
 * Stamp the tiebreak record with its winner and the time it was settled.
 *
 * Idempotent: only an UNRESOLVED record is written, so a re-fire (remount,
 * second verifier, realtime cycle) can never move a winner already recorded.
 *
 * @param matchId - The tied match whose tiebreaker just finished
 * @param winningTeamId - The team that reached games_needed
 * @throws On a database error — the caller must not complete the match then,
 *   or the handicap credit would be lost
 */
export async function resolveTiebreakerRecord(matchId: string, winningTeamId: string): Promise<void> {
  const { error } = await supabase
    .from('match_tiebreakers')
    .update({ winning_team_id: winningTeamId, resolved_at: new Date().toISOString() })
    .eq('match_id', matchId)
    .is('winning_team_id', null);
  if (error) throw error;
}
