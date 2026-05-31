/**
 * @fileoverview Captain re-up sheet — submit + dismiss mutations.
 *
 * Two write paths to the `season_reup_responses` table:
 *   - `submitCaptainReup` — captain answered ("returning + same captain"
 *     OR "make changes" form submit). UPSERTs the row with submitted_at
 *     set, clears any prior dismissed_at.
 *   - `dismissCaptainReup` — captain tapped "Not now". UPSERTs the row
 *     with dismissed_at set, leaves submitted_at NULL. The match-start
 *     trigger will clear dismissed_at when the captain's team plays
 *     its next match.
 *
 * Each mutation is scoped to one (season_id, team_id) — the modal's
 * combined-multi-team view fires one mutation per team.
 */

import { supabase } from '@/supabaseClient';

export interface SubmitCaptainReupParams {
  seasonId: string;
  teamId: string;
  captainId: string; // current captain (snapshot at time of modal-show)
  returningNextSeason: boolean;
  /** NULL = same captain returning. Non-null = captain change. */
  nextCaptainId: string | null;
  /** Audit: the member id of whoever clicked submit (usually = captainId). */
  submittedByCaptainId: string;
}

export async function submitCaptainReup(
  params: SubmitCaptainReupParams,
): Promise<void> {
  const { error } = await supabase
    .from('season_reup_responses')
    .upsert(
      {
        season_id: params.seasonId,
        team_id: params.teamId,
        captain_id: params.captainId,
        returning_next_season: params.returningNextSeason,
        next_captain_id: params.nextCaptainId,
        submitted_at: new Date().toISOString(),
        submitted_by_captain_id: params.submittedByCaptainId,
        dismissed_at: null, // clear any prior dismissal — they answered
      },
      { onConflict: 'season_id,team_id' },
    );

  if (error) {
    throw new Error(`Failed to submit re-up: ${error.message}`);
  }
}

export interface DismissCaptainReupParams {
  seasonId: string;
  teamId: string;
  captainId: string;
}

export async function dismissCaptainReup(
  params: DismissCaptainReupParams,
): Promise<void> {
  const { error } = await supabase
    .from('season_reup_responses')
    .upsert(
      {
        season_id: params.seasonId,
        team_id: params.teamId,
        captain_id: params.captainId,
        dismissed_at: new Date().toISOString(),
        // Leave returning + next_captain + submitted_at NULL — this is
        // only a defer, not an answer.
      },
      { onConflict: 'season_id,team_id' },
    );

  if (error) {
    throw new Error(`Failed to dismiss re-up: ${error.message}`);
  }
}

/**
 * LO-facing "Remind" — clears `dismissed_at` so a captain who tapped
 * "Not now" sees the modal again on their next login. Only updates
 * EXISTING rows where dismissed_at IS NOT NULL AND submitted_at IS NULL;
 * a no-op for captains who never opened the modal (no row) or already
 * answered (submitted_at set).
 *
 * Two shapes:
 *   - Single team: pass seasonId + teamId
 *   - Whole season: pass seasonId only — clears every dismissal for
 *     the league's active season at once.
 */
export interface ClearReupDismissalsParams {
  seasonId: string;
  /** Optional. Omit to clear every dismissal for the season. */
  teamId?: string;
}

export async function clearReupDismissals(
  params: ClearReupDismissalsParams,
): Promise<{ updated: number }> {
  let query = supabase
    .from('season_reup_responses')
    .update({ dismissed_at: null })
    .eq('season_id', params.seasonId)
    .is('submitted_at', null)
    .not('dismissed_at', 'is', null);
  if (params.teamId) {
    query = query.eq('team_id', params.teamId);
  }
  // .select() after .update() returns the affected rows so we can
  // report the count back to the LO ("3 reminders sent").
  const { data, error } = await query.select('id');
  if (error) {
    throw new Error(`Failed to clear re-up dismissal: ${error.message}`);
  }
  return { updated: data?.length ?? 0 };
}
