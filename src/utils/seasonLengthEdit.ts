/**
 * @fileoverview Season-length change eligibility + bounds (pure)
 *
 * Pure helpers for the "Change Season Length" feature: decide whether a season's
 * length is still editable (the week-5 lock), and validate/classify a requested new
 * length against the [10, 52] bounds.
 *
 * Kept I/O-free so the lock + classification logic is trivially testable; the wizard
 * and the apply layer call these before doing any DB work.
 *
 * @see docs/plans/2026-06-11-002-feat-change-season-length-plan.md — Unit 1
 */

/** Minimum / maximum regular-season length (mirrors the `seasons.season_length` CHECK). */
export const MIN_SEASON_LENGTH = 10;
export const MAX_SEASON_LENGTH = 52;

/** Minimal week shape the eligibility check needs. */
export interface LengthEditWeek {
  /** scheduled_date, YYYY-MM-DD. */
  date: string;
  /** DB week_type ('regular' | 'blackout' | 'playoffs'). */
  weekType: string;
}

/** Future seam: payment also locks the length once Jack's payment integration lands. */
export interface LengthEditOptions {
  /** When true (future), the season is paid → length is locked regardless of date. */
  paymentMade?: boolean;
}

/**
 * Whether a season's regular length is still editable.
 *
 * Editable while today is before the **5th regular week's** play-date (operators can
 * play through week 4, then it locks). Assumes a fully-created schedule; a season
 * still being built (fewer than 5 regular weeks) is treated as editable.
 *
 * @param weeks - All of the season's weeks.
 * @param today - Today as a YYYY-MM-DD string (local), e.g. `formatLocalDate(new Date())`.
 * @param opts - Future payment seam.
 * @returns True if the length may still be changed.
 */
export function isLengthEditable(
  weeks: LengthEditWeek[],
  today: string,
  opts: LengthEditOptions = {},
): boolean {
  // Future: a paid season is locked regardless of date.
  if (opts.paymentMade) return false;

  const regulars = weeks
    .filter((w) => w.weekType === 'regular')
    .sort((a, b) => a.date.localeCompare(b.date));

  // Not enough weeks yet to have reached week 5 → still editable.
  if (regulars.length < 5) return true;

  // ISO date strings compare lexicographically, so this is a safe local-date compare.
  return today < regulars[4].date;
}

/** The outcome of validating + classifying a requested length change. */
export type LengthChangeClass =
  | { kind: 'lengthen'; delta: number }
  | { kind: 'shorten'; delta: number }
  | { kind: 'noop' }
  | { kind: 'invalid'; reason: string };

/**
 * Validate a requested new length against [10, 52] and classify the direction.
 *
 * @param currentLen - The season's current regular-week count.
 * @param requestedLen - The operator's requested new count.
 * @returns `lengthen`/`shorten` with a positive delta, `noop` if unchanged, or
 *   `invalid` with a reason if out of bounds.
 */
export function classifyLengthChange(
  currentLen: number,
  requestedLen: number,
): LengthChangeClass {
  if (!Number.isInteger(requestedLen)) {
    return { kind: 'invalid', reason: 'Season length must be a whole number of weeks.' };
  }
  if (requestedLen < MIN_SEASON_LENGTH) {
    return { kind: 'invalid', reason: `Seasons must be at least ${MIN_SEASON_LENGTH} weeks.` };
  }
  if (requestedLen > MAX_SEASON_LENGTH) {
    return { kind: 'invalid', reason: `Seasons can be at most ${MAX_SEASON_LENGTH} weeks.` };
  }
  if (requestedLen === currentLen) return { kind: 'noop' };
  return requestedLen > currentLen
    ? { kind: 'lengthen', delta: requestedLen - currentLen }
    : { kind: 'shorten', delta: currentLen - requestedLen };
}
