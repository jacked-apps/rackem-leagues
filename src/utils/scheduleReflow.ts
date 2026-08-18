/**
 * @fileoverview Schedule blackout re-flow (pure logic)
 *
 * Computes how an active season's weeks must be re-dated when an operator adds or
 * removes a blackout on the edit page. This is the pure, I/O-free heart of the
 * re-flow: it takes the current `season_weeks` rows plus an add/remove action and
 * returns a {@link ReflowPlan} describing exactly which rows to insert, delete, or
 * re-date — and the season's new end date. `scheduleReflowApply.ts` applies it.
 *
 * THE MODEL (locked — see docs/plans/2026-06-11-001-fix-edit-page-blackout-reflow-plan.md):
 *  - A match is position-only; it never stores a date. The schedule is an ordered
 *    run of weekly play-nights, and the Nth play week resolves to the Nth play-night
 *    once skips are removed from the calendar walk.
 *  - PLAY weeks = `regular` + `playoffs` (playoffs are "an extra regular play week
 *    with a different label" — they shift with the season).
 *  - SKIP weeks = `blackout` (a "week off" / season-end break is a blackout with a
 *    label — fixed calendar nights the walk flows around).
 *  - Re-flow RE-DATES play rows in place and NEVER touches matches: a play week keeps
 *    its row id (and its bound matches/results) and simply slides to the next open
 *    night, so the stranded-games bug is structurally impossible.
 *
 * All date math is timezone-safe via `@/utils/formatters` + `formatDateForDB`.
 */
import { parseLocalDate, formatLocalDate } from '@/utils/formatters';

/** Database `week_type` values, mirrored from the `season_weeks` CHECK constraint. */
export type ReflowWeekType =
  | 'regular'
  | 'blackout'
  | 'playoffs';

/**
 * Minimal projection of a `season_weeks` row the re-flow needs. Kept decoupled from
 * the DB row / `WeekEntry` shape so this function stays pure and trivially testable.
 */
export interface ReflowWeek {
  /** `season_weeks.id` — preserved across re-flow; matches stay bound to it. */
  id: string;
  /** `scheduled_date`, YYYY-MM-DD. */
  date: string;
  weekType: ReflowWeekType;
  weekName: string;
  weekCompleted: boolean;
}

/** Skip kind the re-flow inserts: a skip night with a label. A holiday and a
 *  season-end break are both `blackout` now (distinguished only by their label /
 *  notes), so there is a single skip type. */
export type SkipType = 'blackout';

/**
 * The edit-page action driving the re-flow.
 * - `add`: turn `date` (currently a PLAY week's night) into a skip. That play week
 *   re-dates to the next open night; a new skip row (`skipType`, labeled `reason`) is
 *   born on `date`.
 * - `remove`: drop the skip currently sitting on `date` (blackout or season-end
 *   break); later play weeks pull in.
 */
export type ReflowAction =
  | { kind: 'add'; date: string; reason: string; skipType: SkipType }
  | { kind: 'remove'; date: string };

/** A single row's date change, pre-ordered for collision-safe application. */
export interface ReflowDateUpdate {
  id: string;
  date: string;
}

/** A new skip row to create (blackout or season-end break). */
export interface ReflowInsert {
  date: string;
  weekType: SkipType;
  weekName: string;
}

/**
 * The full reconciliation plan. `scheduleReflowApply.ts` applies it in this fixed
 * order — deletes → dateUpdates (already ordered) → inserts → season end — which is
 * collision-safe against `UNIQUE(season_id, scheduled_date)` for both directions.
 */
export interface ReflowPlan {
  insertSkips: ReflowInsert[];
  deleteWeekIds: string[];
  /**
   * Date changes in apply order: DESCENDING new-date for `add` (rows shift later, so
   * vacate from the back first), ASCENDING for `remove` (rows pull earlier).
   */
  dateUpdates: ReflowDateUpdate[];
  /** New `seasons.end_date` — the latest scheduled night after the re-flow. */
  newSeasonEndDate: string;
}

const PLAY_TYPES: ReflowWeekType[] = ['regular', 'playoffs'];

const isPlay = (w: ReflowWeek): boolean => PLAY_TYPES.includes(w.weekType);

/** Advance an ISO date string by whole weeks, timezone-safe. */
const addWeeks = (isoDate: string, weeks: number): string => {
  const d = parseLocalDate(isoDate);
  d.setDate(d.getDate() + weeks * 7);
  return formatLocalDate(d);
};

/**
 * Compute the re-flow plan for adding or removing a blackout.
 *
 * Walks the weekly cadence from the season's first night, skipping every skip-date,
 * and re-assigns each play week (in its established order) to the next open night.
 * Play-week count is invariant; matches are never referenced.
 *
 * @param weeks - All `season_weeks` rows for the season (any order).
 * @param action - The add/remove blackout action.
 * @returns The reconciliation plan to persist.
 * @throws If `weeks` is empty, or the action's date does not name the expected kind
 *   of week (add → a play week; remove → a blackout).
 *
 * @example
 * // 3 regular + 1 playoff, Wednesdays; black out week 2's night (7/08):
 * computeBlackoutReflow(weeks, { kind: 'add', date: '2026-07-08', reason: 'Holiday' })
 * // → inserts a blackout on 7/08; weeks 2/3/playoff each slide +1 week; season end +1.
 */
export function computeBlackoutReflow(
  weeks: ReflowWeek[],
  action: ReflowAction,
): ReflowPlan {
  if (weeks.length === 0) {
    throw new Error('Cannot re-flow an empty schedule.');
  }

  // Validate the action targets the right kind of week.
  const targetRow = weeks.find((w) => w.date === action.date);
  if (action.kind === 'add') {
    if (!targetRow || !isPlay(targetRow)) {
      throw new Error(
        `Cannot black out ${action.date}: it is not a play week in this season.`,
      );
    }
  } else {
    // Remove targets any skip row (blackout or season-end break) — both are skips.
    if (!targetRow || isPlay(targetRow)) {
      throw new Error(
        `Cannot remove a week off on ${action.date}: no skip week is scheduled there.`,
      );
    }
  }

  // Build the new set of skip dates (fixed calendar nights the walk flows around).
  const skipDates = new Set<string>(
    weeks.filter((w) => !isPlay(w)).map((w) => w.date),
  );
  let deleteWeekIds: string[] = [];
  let insertSkips: ReflowInsert[] = [];

  if (action.kind === 'add') {
    // The chosen night becomes a skip; its play week re-dates below.
    skipDates.add(action.date);
    insertSkips = [
      { date: action.date, weekType: action.skipType, weekName: action.reason },
    ];
  } else {
    // The removed skip stops being a skip; its row is deleted.
    skipDates.delete(action.date);
    deleteWeekIds = [targetRow!.id];
  }

  // Play weeks keep their established order (ascending current date): regular weeks
  // 1..N then playoff week(s). Their identity/rows are preserved; only dates change.
  const playOrder = weeks
    .filter(isPlay)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Walk the weekly grid from the season's first night, assigning play weeks to the
  // next non-skip night. All existing dates sit on this weekly grid (generated by
  // scheduleUtils.generateSchedule with +7 steps), so skip dates are hit exactly.
  const anchor = weeks
    .map((w) => w.date)
    .reduce((min, d) => (d < min ? d : min));

  const dateUpdates: ReflowDateUpdate[] = [];
  let cursor = anchor;
  for (const pw of playOrder) {
    while (skipDates.has(cursor)) {
      cursor = addWeeks(cursor, 1);
    }
    if (pw.date !== cursor) {
      dateUpdates.push({ id: pw.id, date: cursor });
    }
    cursor = addWeeks(cursor, 1);
  }

  // Apply order is collision-safe against UNIQUE(season_id, date):
  //  - add  → rows shift LATER  → write largest new date first (DESC).
  //  - remove → rows pull EARLIER → write smallest new date first (ASC).
  dateUpdates.sort((a, b) =>
    action.kind === 'add' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date),
  );

  // Season end = the latest scheduled night across every surviving/added row.
  const finalDates: string[] = [
    // play weeks at their post-walk dates
    ...playOrder.map((pw) => {
      const upd = dateUpdates.find((u) => u.id === pw.id);
      return upd ? upd.date : pw.date;
    }),
    // surviving skip rows keep their dates
    ...weeks
      .filter((w) => !isPlay(w) && !deleteWeekIds.includes(w.id))
      .map((w) => w.date),
    // the newly inserted blackout (add only)
    ...insertSkips.map((s) => s.date),
  ];
  const newSeasonEndDate = finalDates.reduce((max, d) => (d > max ? d : max));

  return { insertSkips, deleteWeekIds, dateUpdates, newSeasonEndDate };
}
