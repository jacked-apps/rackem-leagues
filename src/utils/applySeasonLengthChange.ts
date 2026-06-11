/**
 * @fileoverview Apply a season-length change (lengthen / shorten) — persistence.
 *
 * Lengthen APPENDS regular weeks at the end (continuing the matchup rotation from the
 * teams' stored positions) and slides the season-end break + playoff weeks out.
 * Shorten TRIMS regular weeks off the end — but refuses if a removed week has a played
 * match (sacred games-won data) — and pulls the break + playoff in. Existing matches
 * are never touched; only the appended/removed tail weeks change.
 *
 * Dating is a length-aware routine (NOT the blackout re-flow, which pins the break as a
 * fixed skip): existing regular weeks keep their dates; new/trailing weeks are walked
 * forward from the last regular week, skipping blackout nights. Trailing rows are
 * "parked" on far-future dates then set to finals, so the UNIQUE(season_id, date)
 * constraint never trips regardless of direction.
 *
 * @see docs/plans/2026-06-11-002-feat-change-season-length-plan.md — Unit 3
 */
import { supabase } from '@/supabaseClient';
import { logger } from '@/utils/logger';
import { parseLocalDate, formatLocalDate } from '@/utils/formatters';
import { getMatchupTable } from '@/utils/matchupTables';
import { generateWeekMatches } from '@/utils/scheduleGenerator';
import { classifyLengthChange } from '@/utils/seasonLengthEdit';
import type { TeamWithPosition } from '@/types/schedule';

export interface LengthChangeResult {
  success: boolean;
  /** New season end date (YYYY-MM-DD) on success. */
  newEndDate?: string;
  /** Human-readable failure reason (generic error, pre-column, or guard block). */
  error?: string;
  /** Set when a shorten is blocked because a removed week already has a played match. */
  blockedWeekName?: string;
}

interface WeekRow {
  id: string;
  scheduled_date: string;
  week_name: string;
  week_type: 'regular' | 'blackout' | 'playoffs' | 'season_end_break';
}

const byDate = (a: { scheduled_date: string }, b: { scheduled_date: string }) =>
  a.scheduled_date.localeCompare(b.scheduled_date);

const addDays = (iso: string, days: number): string => {
  const d = parseLocalDate(iso);
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
};

/** Next weekly cadence night after `cursor` that isn't a blackout date. */
const nextPlayableNight = (cursor: string, blackoutDates: Set<string>): string => {
  let next = addDays(cursor, 7);
  while (blackoutDates.has(next)) next = addDays(next, 7);
  return next;
};

/** A far-future, unique parking date so trailing re-dates never collide mid-write. */
const parkingDate = (index: number): string => addDays('2999-01-01', index);

/** Move rows to far-future parking dates (frees their real nights). */
async function parkRows(rows: WeekRow[]): Promise<string | undefined> {
  for (let i = 0; i < rows.length; i++) {
    const { error } = await supabase
      .from('season_weeks')
      .update({ scheduled_date: parkingDate(i) })
      .eq('id', rows[i].id);
    if (error) return error.message;
  }
  return undefined;
}

/** Set rows to their final dates (rows must be on parking/free dates first). */
async function setRowDates(rows: WeekRow[], dates: string[]): Promise<string | undefined> {
  for (let i = 0; i < rows.length; i++) {
    const { error } = await supabase
      .from('season_weeks')
      .update({ scheduled_date: dates[i] })
      .eq('id', rows[i].id);
    if (error) return error.message;
  }
  return undefined;
}

/** Read the season's latest scheduled night (the new end_date) and persist length+end. */
async function syncSeasonMeta(seasonId: string, newLength: number): Promise<{ endDate?: string; error?: string }> {
  const { data, error } = await supabase
    .from('season_weeks')
    .select('scheduled_date')
    .eq('season_id', seasonId)
    .order('scheduled_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return { error: error?.message ?? 'Could not read the new season end date.' };
  const endDate = data.scheduled_date;
  const { error: seasonError } = await supabase
    .from('seasons')
    .update({ season_length: newLength, end_date: endDate })
    .eq('id', seasonId);
  if (seasonError) return { error: seasonError.message };
  return { endDate };
}

/**
 * Apply a change to a season's regular-season length.
 *
 * @param seasonId - The season to change.
 * @param requestedLength - The new regular-week count (validated to [10, 52]).
 * @returns Success (with the new end date), a generic/pre-column error, or a shorten
 *   guard block naming the played week. Never throws.
 */
export async function applySeasonLengthChange(
  seasonId: string,
  requestedLength: number,
): Promise<LengthChangeResult> {
  const { data: weekData, error: weeksError } = await supabase
    .from('season_weeks')
    .select('id, scheduled_date, week_name, week_type')
    .eq('season_id', seasonId)
    .order('scheduled_date', { ascending: true });
  if (weeksError || !weekData) {
    return { success: false, error: 'Could not load the schedule. Please try again.' };
  }
  const weeks = weekData as WeekRow[];

  const regulars = weeks.filter((w) => w.week_type === 'regular').sort(byDate);
  const currentLen = regulars.length;

  const cls = classifyLengthChange(currentLen, requestedLength);
  if (cls.kind === 'invalid') return { success: false, error: cls.reason };
  if (cls.kind === 'noop') return { success: true };

  return cls.kind === 'lengthen'
    ? lengthen(seasonId, weeks, regulars, cls.delta)
    : shorten(seasonId, weeks, regulars, cls.delta);
}

async function lengthen(
  seasonId: string,
  weeks: WeekRow[],
  regulars: WeekRow[],
  delta: number,
): Promise<LengthChangeResult> {
  // Freeze the team count + chart to the STORED positions (incl. bye, incl. any
  // withdrawn team) — never the live active count, or a withdrawal would re-key the
  // chart and silently mis-pair the new weeks.
  const { data: teamRows, error: teamError } = await supabase
    .from('teams')
    .select('id, team_name, home_venue_id, schedule_position')
    .eq('season_id', seasonId)
    .not('schedule_position', 'is', null);
  if (teamError) return { success: false, error: 'Could not load teams. Please try again.' };

  const positioned = (teamRows ?? []) as TeamWithPosition[];
  if (positioned.length === 0) {
    return {
      success: false,
      error:
        'This season was created before season-length editing was supported. ' +
        'Please regenerate it to change the length.',
    };
  }
  const chart = getMatchupTable(positioned.length);
  if (!chart) {
    return { success: false, error: `No matchup chart for ${positioned.length} teams.` };
  }
  const cycleLength = chart.length;
  const teamsByPosition = new Map<number, TeamWithPosition>(
    positioned.map((t) => [t.schedule_position, t]),
  );

  const blackoutDates = new Set(weeks.filter((w) => w.week_type === 'blackout').map((w) => w.scheduled_date));
  const trailing = weeks
    .filter((w) => w.week_type === 'season_end_break' || w.week_type === 'playoffs')
    .sort(byDate);

  // Walk forward from the last regular week: new regular weeks, then break/playoff.
  let cursor = regulars[regulars.length - 1].scheduled_date;
  const newRegularDates: string[] = [];
  for (let j = 0; j < delta; j++) {
    cursor = nextPlayableNight(cursor, blackoutDates);
    newRegularDates.push(cursor);
  }
  const trailingDates: string[] = [];
  for (let i = 0; i < trailing.length; i++) {
    cursor = nextPlayableNight(cursor, blackoutDates);
    trailingDates.push(cursor);
  }

  // 1. Park trailing rows so the new regular weeks can take the freed nights.
  const parkErr = await parkRows(trailing);
  if (parkErr) return failPartial(seasonId, parkErr);

  // 2. Insert each new regular week + its matches (continuing the rotation).
  for (let j = 0; j < delta; j++) {
    const weekNumber = regulars.length + j + 1;
    const { data: newWeek, error: insErr } = await supabase
      .from('season_weeks')
      .insert({
        season_id: seasonId,
        scheduled_date: newRegularDates[j],
        week_name: `Week ${weekNumber}`,
        week_type: 'regular',
        week_completed: false,
      })
      .select('id')
      .single();
    if (insErr || !newWeek) return failPartial(seasonId, insErr?.message ?? 'insert week failed');

    const weekIndex = regulars.length + j; // 0-based index in the full regular sequence
    const matchups = chart[weekIndex % cycleLength] as [number, number][];
    const matchRows = generateWeekMatches(newWeek.id, matchups, teamsByPosition, seasonId);
    if (matchRows.length > 0) {
      const { error: matchErr } = await supabase.from('matches').insert(matchRows);
      if (matchErr) return failPartial(seasonId, matchErr.message);
    }
  }

  // 3. Move trailing rows from parking to their final (later) dates.
  const setErr = await setRowDates(trailing, trailingDates);
  if (setErr) return failPartial(seasonId, setErr);

  // 4. Re-run table assignment for the appended weeks (non-fatal).
  await supabase.rpc('assign_tables_for_season', { p_season_id: seasonId });

  // 5. Sync season_length + end_date.
  const meta = await syncSeasonMeta(seasonId, regulars.length + delta);
  if (meta.error) return { success: false, error: meta.error };
  return { success: true, newEndDate: meta.endDate };
}

async function shorten(
  seasonId: string,
  weeks: WeekRow[],
  regulars: WeekRow[],
  delta: number,
): Promise<LengthChangeResult> {
  const toRemove = regulars.slice(regulars.length - delta);
  const removeIds = toRemove.map((w) => w.id);

  // GUARD: fresh-read the tail's matches; refuse if any isn't still 'scheduled'.
  const { data: tailMatches, error: matchReadErr } = await supabase
    .from('matches')
    .select('status, season_week_id')
    .in('season_week_id', removeIds);
  if (matchReadErr) return { success: false, error: 'Could not check the weeks to remove. Please try again.' };

  const played = (tailMatches ?? []).find((m) => m.status !== 'scheduled');
  if (played) {
    const wk = toRemove.find((w) => w.id === played.season_week_id);
    const name = wk?.week_name ?? 'a removed week';
    return {
      success: false,
      blockedWeekName: name,
      error: `Can't shorten — ${name} already has a match that's been played.`,
    };
  }

  // Delete the tail's matches, then the week rows.
  const { error: delMatchErr } = await supabase.from('matches').delete().in('season_week_id', removeIds);
  if (delMatchErr) return failPartial(seasonId, delMatchErr.message);
  const { error: delWeekErr } = await supabase.from('season_weeks').delete().in('id', removeIds);
  if (delWeekErr) return failPartial(seasonId, delWeekErr.message);

  // Pull break/playoff in, dated from the new last regular week.
  const blackoutDates = new Set(weeks.filter((w) => w.week_type === 'blackout').map((w) => w.scheduled_date));
  const trailing = weeks
    .filter((w) => w.week_type === 'season_end_break' || w.week_type === 'playoffs')
    .sort(byDate);

  let cursor = regulars[regulars.length - delta - 1].scheduled_date;
  const trailingDates: string[] = [];
  for (let i = 0; i < trailing.length; i++) {
    cursor = nextPlayableNight(cursor, blackoutDates);
    trailingDates.push(cursor);
  }

  // Park then set, so the moves can't collide with each other.
  const parkErr = await parkRows(trailing);
  if (parkErr) return failPartial(seasonId, parkErr);
  const setErr = await setRowDates(trailing, trailingDates);
  if (setErr) return failPartial(seasonId, setErr);

  const meta = await syncSeasonMeta(seasonId, regulars.length - delta);
  if (meta.error) return { success: false, error: meta.error };
  return { success: true, newEndDate: meta.endDate };
}

/** Log + return a generic recoverable failure for a mid-sequence DB error. */
function failPartial(seasonId: string, detail: string): LengthChangeResult {
  logger.error('Season length change failed mid-apply', { seasonId, error: detail });
  return {
    success: false,
    error: 'The schedule may be partly changed. Re-open the schedule and try again.',
  };
}
