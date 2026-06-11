/**
 * @fileoverview Schedule blackout re-flow (persistence)
 *
 * Applies a {@link ReflowPlan} (computed by `scheduleReflow.ts`) to the database.
 * Fetches the season's current weeks fresh, computes the plan, then writes it in a
 * fixed, collision-safe order:
 *
 *   1. delete removed skip rows        (frees their nights — needed for `remove`)
 *   2. re-date play rows, in plan order (DESC for add / ASC for remove → no transient
 *      UNIQUE(season_id, scheduled_date) violation)
 *   3. insert the new blackout row     (its night was vacated in step 2 for `add`)
 *   4. update seasons.end_date
 *
 * Matches are NEVER touched: play rows keep their `id`, so every bound match (and any
 * recorded result) survives. The writes are intentionally non-transactional — dates
 * are advisory, so a partial failure leaves a recoverable schedule (re-running the
 * toggle re-derives a clean walk). See the plan doc for the rationale.
 *
 * @see docs/plans/2026-06-11-001-fix-edit-page-blackout-reflow-plan.md — Unit 2
 */
import { supabase } from '@/supabaseClient';
import { logger } from '@/utils/logger';
import { parseLocalDate, formatLocalDate } from '@/utils/formatters';
import {
  computeBlackoutReflow,
  type ReflowWeek,
  type ReflowWeekType,
  type ReflowAction,
} from '@/utils/scheduleReflow';

export interface ApplyReflowResult {
  success: boolean;
  /** Present on success — the season's new last scheduled night (for UI messaging). */
  newSeasonEndDate?: string;
  /** Present on failure — a human-readable reason for a toast/log. */
  error?: string;
}

/**
 * Apply an add/remove-blackout re-flow to a season's schedule.
 *
 * @param seasonId - The season whose weeks are re-flowed.
 * @param action - Add a blackout on a play night, or remove an existing blackout.
 * @returns Success (with the new season end date) or a failure reason. Never throws —
 *   invalid actions and DB errors are returned as `{ success: false, error }`.
 */
export async function applyBlackoutReflow(
  seasonId: string,
  action: ReflowAction,
): Promise<ApplyReflowResult> {
  // Fetch current weeks fresh (never trust list cache for a structural mutation).
  const { data: weekRows, error: fetchError } = await supabase
    .from('season_weeks')
    .select('id, scheduled_date, week_name, week_type, week_completed')
    .eq('season_id', seasonId)
    .order('scheduled_date', { ascending: true });

  if (fetchError) {
    logger.error('Re-flow: failed to load season weeks', { seasonId, error: fetchError.message });
    return { success: false, error: 'Could not load the schedule. Please try again.' };
  }
  if (!weekRows || weekRows.length === 0) {
    return { success: false, error: 'This season has no schedule to edit.' };
  }

  const weeks: ReflowWeek[] = weekRows.map((r) => ({
    id: r.id,
    date: r.scheduled_date,
    weekType: r.week_type,
    weekName: r.week_name,
    weekCompleted: r.week_completed,
  }));

  // Compute the reconciliation plan (throws on an invalid action → surface as error).
  let plan;
  try {
    plan = computeBlackoutReflow(weeks, action);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }

  // 1. Delete removed skip rows (blackout rows carry no matches — safe to delete).
  for (const id of plan.deleteWeekIds) {
    const { error } = await supabase.from('season_weeks').delete().eq('id', id);
    if (error) {
      logger.error('Re-flow: failed to delete blackout row', { seasonId, id, error: error.message });
      return { success: false, error: 'Could not remove the week. The schedule may be partly changed.' };
    }
  }

  // 2. Re-date play rows in the plan's collision-safe order (one at a time).
  for (const u of plan.dateUpdates) {
    const { error } = await supabase
      .from('season_weeks')
      .update({ scheduled_date: u.date })
      .eq('id', u.id);
    if (error) {
      logger.error('Re-flow: failed to re-date week', { seasonId, id: u.id, date: u.date, error: error.message });
      return { success: false, error: 'Could not shift the schedule. The schedule may be partly changed.' };
    }
  }

  // 3. Insert the new blackout row on the now-vacated night (add only).
  if (plan.insertSkips.length > 0) {
    const rows = plan.insertSkips.map((s) => ({
      season_id: seasonId,
      scheduled_date: s.date,
      week_name: s.weekName,
      week_type: s.weekType,
      week_completed: false,
      notes: null,
    }));
    const { error } = await supabase.from('season_weeks').insert(rows);
    if (error) {
      logger.error('Re-flow: failed to insert blackout row', { seasonId, error: error.message });
      return { success: false, error: 'Could not add the blackout week. The schedule may be partly changed.' };
    }
  }

  // 4. Move the season end to the new last scheduled night.
  const { error: seasonError } = await supabase
    .from('seasons')
    .update({ end_date: plan.newSeasonEndDate })
    .eq('id', seasonId);
  if (seasonError) {
    logger.error('Re-flow: failed to update season end_date', { seasonId, error: seasonError.message });
    return { success: false, error: 'Schedule shifted, but the season end date did not update.' };
  }

  return { success: true, newSeasonEndDate: plan.newSeasonEndDate };
}

/** One week row in a pre-edit snapshot. */
export interface SnapshotWeek {
  id: string;
  date: string;
  weekType: ReflowWeekType;
  weekName: string;
}

/** A captured pre-edit schedule the operator can revert to. */
export interface ScheduleSnapshot {
  weeks: SnapshotWeek[];
  endDate: string;
}

const isSnapshotPlay = (w: SnapshotWeek): boolean =>
  w.weekType === 'regular' || w.weekType === 'playoffs';

/** A far-future, unique parking date so re-dates never collide mid-restore. */
const tempParkingDate = (index: number): string => {
  const d = parseLocalDate('2999-01-01');
  d.setDate(d.getDate() + index);
  return formatLocalDate(d);
};

/**
 * Restore a season's schedule to a captured snapshot (the Revert action).
 *
 * Play rows are never deleted (matches bind to them), so they are re-dated back in
 * place; skip rows are delete-and-reinserted (nothing references them). To dodge the
 * UNIQUE(season_id, scheduled_date) constraint regardless of how the schedule was
 * edited, play rows first park on far-future unique dates, then move to their snapshot
 * dates once every real date is free.
 *
 * @param seasonId - The season to restore.
 * @param snapshot - The pre-edit schedule captured on the first change.
 * @returns Success or a failure reason. Never throws.
 */
export async function restoreScheduleSnapshot(
  seasonId: string,
  snapshot: ScheduleSnapshot,
): Promise<ApplyReflowResult> {
  const playRows = snapshot.weeks.filter(isSnapshotPlay);
  const skipRows = snapshot.weeks.filter((w) => !isSnapshotPlay(w));

  const fail = (where: string, message: string, error?: string): ApplyReflowResult => {
    logger.error(`Revert: ${where}`, { seasonId, error });
    return { success: false, error: message };
  };

  // 1. Park every play row on a unique far-future date (frees all real dates).
  for (let i = 0; i < playRows.length; i++) {
    const { error } = await supabase
      .from('season_weeks')
      .update({ scheduled_date: tempParkingDate(i) })
      .eq('id', playRows[i].id);
    if (error) return fail('park play rows', 'Could not revert the schedule. Please try again.', error.message);
  }

  // 2. Delete all current skip rows (blackout + season-end break carry no matches).
  const { error: delError } = await supabase
    .from('season_weeks')
    .delete()
    .eq('season_id', seasonId)
    .in('week_type', ['blackout', 'season_end_break']);
  if (delError) return fail('delete skips', 'Could not revert the schedule. Please try again.', delError.message);

  // 3. Move play rows back to their snapshot dates / names / types.
  for (const row of playRows) {
    const { error } = await supabase
      .from('season_weeks')
      .update({ scheduled_date: row.date, week_name: row.weekName, week_type: row.weekType })
      .eq('id', row.id);
    if (error) return fail('restore play rows', 'Could not revert the schedule. Please try again.', error.message);
  }

  // 4. Re-insert the snapshot's skip rows (new ids — nothing references them).
  if (skipRows.length > 0) {
    const rows = skipRows.map((s) => ({
      season_id: seasonId,
      scheduled_date: s.date,
      week_name: s.weekName,
      week_type: s.weekType,
      week_completed: false,
      notes: null,
    }));
    const { error } = await supabase.from('season_weeks').insert(rows);
    if (error) return fail('reinsert skips', 'Could not revert the schedule. Please try again.', error.message);
  }

  // 5. Restore the season end date.
  const { error: seasonError } = await supabase
    .from('seasons')
    .update({ end_date: snapshot.endDate })
    .eq('id', seasonId);
  if (seasonError) return fail('restore end_date', 'Schedule reverted, but the season end date did not reset.', seasonError.message);

  return { success: true, newSeasonEndDate: snapshot.endDate };
}
