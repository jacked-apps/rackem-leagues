/**
 * @fileoverview Season schedule state + the pre-season "start over" actions.
 *
 * Ed's rule (2026-11-21): until a single game is played, adding or removing a
 * team throws the schedule away and the operator builds a brand-new one, so
 * every season starts from a "perfect" chart schedule (every pair the same
 * number of times, home and away balanced). Once any game is played, a drop
 * re-pairs instead (dropTeamOddLeague / drop_team_mid_season).
 */

import { supabase } from '@/supabaseClient';
import { clearSchedule } from '@/utils/scheduleGenerator';

/** Statuses that mean a match has begun or finished. */
const PLAYED_STATUSES = ['in_progress', 'awaiting_verification', 'completed', 'forfeited'];

export interface SeasonScheduleState {
  /** The season has at least one match. */
  hasSchedule: boolean;
  /** At least one match has begun, finished, or has a winner (incl. a settled bye). */
  started: boolean;
}

/**
 * @param seasonId - Season to inspect
 * @returns Whether it has a schedule and whether play has begun
 */
export async function fetchSeasonScheduleState(seasonId: string): Promise<SeasonScheduleState> {
  const [all, played] = await Promise.all([
    supabase.from('matches').select('id', { count: 'exact', head: true }).eq('season_id', seasonId),
    supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('season_id', seasonId)
      .or(`winner_team_id.not.is.null,status.in.(${PLAYED_STATUSES.join(',')})`),
  ]);
  const error = all.error ?? played.error;
  if (error) throw new Error(`Failed to check the schedule: ${error.message}`);
  return { hasSchedule: (all.count ?? 0) > 0, started: (played.count ?? 0) > 0 };
}

/**
 * Pre-season removal: delete the whole schedule (and its BYE), then the team.
 * Nothing has been played, so no history is lost. The schedule goes first
 * because a team with matches can't be deleted (FK RESTRICT). If the team
 * delete then fails, the operator is left with an empty schedule to rebuild,
 * the same next step they were going to take anyway.
 *
 * @param teamId - Team to remove
 * @param seasonId - Its season
 */
export async function removeTeamAndClearSchedule(teamId: string, seasonId: string): Promise<void> {
  const cleared = await clearSchedule(seasonId);
  if (!cleared.success) throw new Error(cleared.error ?? 'Failed to clear the schedule');
  const { error } = await supabase.from('teams').delete().eq('id', teamId);
  if (error) throw new Error(`Schedule cleared, but the team could not be deleted: ${error.message}`);
}
