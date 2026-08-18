/**
 * @fileoverview Schedule week-off toggle decisions (pure)
 *
 * The pure decision logic behind the edit page's week-off toggle: given a week,
 * decide whether a toggle should remove a skip, insert a skip, or first prompt for a
 * blackout reason — and whether editing it should warn the operator (past/played).
 * Keeping this out of the component makes the routing trivially testable and the
 * handler a thin shell over {@link applyBlackoutReflow}.
 *
 * @see docs/plans/2026-06-11-001-fix-edit-page-blackout-reflow-plan.md — Unit 3
 */
import type { ReflowWeekType, SkipType } from '@/utils/scheduleReflow';

/** The slice of a loaded week the toggle decisions need. */
export interface ToggleWeek {
  /** scheduled_date, YYYY-MM-DD. */
  date: string;
  /** Whether the week has been played. */
  weekCompleted: boolean;
  /** Original DB week_type, if known. */
  dbWeekType?: ReflowWeekType;
}

/**
 * Whether editing this week should warn first. Dates are advisory, so a past or
 * already-played week is never blocked — only flagged so the toggle is deliberate.
 *
 * @param week - The week being toggled.
 * @param today - Today's date as YYYY-MM-DD (local).
 */
export function isPastOrPlayed(week: ToggleWeek, today: string): boolean {
  return week.date < today || week.weekCompleted === true;
}

/**
 * What a week-off toggle should do for a given week:
 * - `remove`: the week is a skip (blackout or season-end break) → drop it (re-flow
 *   pulls later play weeks in).
 * - `add`: ready-to-apply skip insert. Playoffs become a season-end break (a
 *   blackout labelled "Season End Break") — no reason needed.
 * - `prompt-blackout`: a regular play week → capture an operator reason (modal) before
 *   inserting the blackout.
 */
export type ToggleDecision =
  | { action: 'remove' }
  | { action: 'add'; skipType: SkipType; reason: string }
  | { action: 'prompt-blackout' };

/**
 * Decide what a week-off toggle should do, from the week's DB type.
 *
 * @param week - The week being toggled.
 * @returns The toggle decision the handler should carry out.
 */
export function decideToggle(week: ToggleWeek): ToggleDecision {
  if (week.dbWeekType === 'blackout') {
    return { action: 'remove' };
  }
  if (week.dbWeekType === 'playoffs') {
    // A season-end break is a blackout labelled "Season End Break".
    return { action: 'add', skipType: 'blackout', reason: 'Season End Break' };
  }
  return { action: 'prompt-blackout' };
}
