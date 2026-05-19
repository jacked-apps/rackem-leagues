/**
 * @fileoverview Age calculation utilities
 *
 * Small, pure helpers for computing age from a date-of-birth string.
 * Currently consumed by `useProfanityFilter` to force the profanity
 * filter on for minors (R4 — under-18 enforcement when DOB is known).
 *
 * Timezone safety: uses `parseLocalDate` from `@/utils/formatters` so a
 * DOB like "2010-04-15" anchors to local calendar 2010-04-15 regardless
 * of the user's timezone (preventing the off-by-one-day class of bugs
 * that comes from `new Date('2010-04-15')` interpreting the string as
 * UTC midnight).
 */

import { parseLocalDate } from './formatters';

/**
 * Compute integer years between two local dates, using the calendar
 * rule that birthdays haven't "happened yet" until both month+day land.
 */
function yearsBetween(from: Date, to: Date): number {
  let years = to.getFullYear() - from.getFullYear();
  const monthDelta = to.getMonth() - from.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && to.getDate() < from.getDate())) {
    years -= 1;
  }
  return years;
}

/**
 * Calculate a member's age in whole years, using local timezone.
 *
 * @param dateOfBirth - ISO date string (YYYY-MM-DD) or null/undefined.
 *   If absent or unparseable, returns `null` (age unknown).
 * @returns Age in whole years, or `null` if DOB is missing/invalid.
 *
 * @example
 * calculateAge('2010-04-15') // 16 (today's date dependent)
 * calculateAge(null) // null
 */
export function calculateAge(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;

  const dob = parseLocalDate(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;

  return yearsBetween(dob, new Date());
}

/**
 * Returns `true` when the member has a known date of birth and is
 * **strictly under 18** as of today. A member turning 18 today is an
 * adult (not a minor).
 *
 * Returns `false` for unknown DOB — under-18 enforcement only kicks
 * in when we have a positive signal. Use this rather than calling
 * `calculateAge` directly when the question is "should this user be
 * treated as a minor for content gating?"
 *
 * @param dateOfBirth - ISO date string (YYYY-MM-DD) or null/undefined.
 *
 * @example
 * isMinor(undefined) // false — unknown DOB
 * isMinor('2010-04-15') // true (today's date dependent)
 * isMinor('2000-01-01') // false
 */
export function isMinor(dateOfBirth: string | null | undefined): boolean {
  const age = calculateAge(dateOfBirth);
  if (age === null) return false;
  return age < 18;
}
