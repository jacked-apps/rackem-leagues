/**
 * @fileoverview Holiday Utility Functions
 *
 * Functions for fetching US holidays and determining which ones should be flagged
 * for league scheduling conflicts based on league day of week and holiday type.
 */
import Holidays from 'date-holidays';
import type { Holiday } from '@/types/season';
import { parseLocalDate } from './formatters';

// Re-export Holiday type for convenience
export type { Holiday };

/**
 * Fetches US holidays for a season's date range
 * Includes buffer before/after to account for playoff delays from week-offs
 *
 * @param startDate - Season start date
 * @param seasonLength - Number of weeks in season
 * @returns Array of Holiday objects within the buffered date range
 */
export function fetchHolidaysForSeason(startDate: Date, seasonLength: number): Holiday[] {
  const hd = new Holidays();
  hd.init('US');

  // Calculate buffered date range
  // 2 weeks before season start
  const bufferStart = new Date(startDate);
  bufferStart.setDate(bufferStart.getDate() - 14);

  // Season weeks + 8 week buffer for potential playoff delays
  const estimatedEnd = new Date(startDate);
  estimatedEnd.setDate(estimatedEnd.getDate() + ((seasonLength + 8) * 7));

  // Get all years that fall within the date range
  const yearStart = bufferStart.getFullYear();
  const yearEnd = estimatedEnd.getFullYear();

  // Fetch holidays for all years in range
  const allHolidays = [];
  for (let year = yearStart; year <= yearEnd; year++) {
    const yearHolidays = hd.getHolidays(year);
    allHolidays.push(...yearHolidays);
  }

  // Filter to only holidays within buffered range
  return allHolidays
    .filter((holiday) => {
      const holidayDate = new Date(holiday.date);
      return holidayDate >= bufferStart && holidayDate <= estimatedEnd;
    })
    .map((holiday) => ({
      date: holiday.date,
      name: holiday.name,
      start: holiday.start || holiday.date,
      end: holiday.end || holiday.date,
      rule: holiday.rule,
      type: holiday.type,
    }));
}

/**
 * Check if a holiday/conflict is a travel holiday that affects the entire week
 * Travel holidays: Christmas, New Year's, BCA, APA, Thanksgiving (for Wed-Sun leagues)
 */
export function isTravelHoliday(conflictName: string, leagueDayOfWeek?: string): boolean {
  const name = conflictName.toLowerCase();

  // Christmas and New Year's always travel holidays
  if (name.includes('christmas') || name.includes('new year')) {
    return true;
  }

  // BCA and APA championships are travel holidays
  if (name.includes('bca') || name.includes('apa')) {
    return true;
  }

  // Thanksgiving only for Wed-Sun leagues
  if (name.includes('thanksgiving') && leagueDayOfWeek) {
    const leagueDay = leagueDayToNumber(leagueDayOfWeek);
    return leagueDay === 0 || leagueDay >= 3; // Sunday or Wed-Sat
  }

  return false;
}

/**
 * Extract each occurrence of league night from a date range
 * Used to split multi-week championships into individual week conflicts
 *
 * @param startDate - Championship start date
 * @param endDate - Championship end date
 * @param leagueDayOfWeek - Day of week league plays (e.g., 'tuesday')
 * @param championshipName - Name for the conflict (e.g., 'BCA National Tournament')
 * @returns Array of Holiday objects, one for each league night in the range
 */
export function extractLeagueNights(
  startDate: string,
  endDate: string,
  leagueDayOfWeek: string,
  championshipName: string
): Holiday[] {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const leagueDay = leagueDayToNumber(leagueDayOfWeek);

  const leagueNights: Holiday[] = [];
  let weekNumber = 1;

  // Find first league night in range
  const currentDate = new Date(start);
  const startDay = currentDate.getDay();

  // Calculate days until first league night
  let daysUntilLeagueNight = leagueDay - startDay;
  if (daysUntilLeagueNight < 0) {
    daysUntilLeagueNight += 7;
  }

  currentDate.setDate(currentDate.getDate() + daysUntilLeagueNight);

  // Extract each league night until past end date
  while (currentDate <= end) {
    const dateStr = currentDate.toISOString().split('T')[0] + ' 00:00:00';
    leagueNights.push({
      date: dateStr,
      name: `${championshipName} Week ${weekNumber}`,
      start: dateStr,
      end: dateStr,
      type: 'championship'
    });

    weekNumber++;
    currentDate.setDate(currentDate.getDate() + 7); // Next week
  }

  return leagueNights;
}

/**
 * Convert league day string to day number
 * Used internally by extractLeagueNights and isTravelHoliday
 */
function leagueDayToNumber(day: string): number {
  const dayMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };
  return dayMap[day.toLowerCase()] ?? 1; // Default to Monday if not found
}

/**
 * Filter holidays by type. When showAll is false, only returns 'public'
 * holidays (federal holidays). When true, returns everything including
 * observances like Easter, Halloween, Mother's Day, etc.
 *
 * Call this BEFORE passing holidays to ScheduleReview or conflict detection
 * so the filtering happens upstream and doesn't touch existing components.
 */
export function filterHolidaysByType(
  holidays: Holiday[],
  showAll: boolean,
): Holiday[] {
  const filtered = showAll
    ? holidays
    : holidays.filter((h) => h.type === 'public' || h.type === 'optional');

  return deduplicateHolidays(filtered);
}

/**
 * Remove duplicate entries for the same holiday event.
 * The date-holidays package returns both the actual date and the
 * observed/substitute date as separate entries (e.g., "Independence Day"
 * AND "Independence Day (substitute day)"). We keep the actual holiday.
 */
function deduplicateHolidays(holidays: Holiday[]): Holiday[] {
  const byBaseName = new Map<string, Holiday>();

  for (const h of holidays) {
    // "Independence Day (substitute day)" → "Independence Day"
    const baseName = h.name.replace(/\s*\(.*\)$/, '').trim();
    const existing = byBaseName.get(baseName);
    // Keep shorter name = actual holiday, not the substitute
    if (!existing || h.name.length < existing.name.length) {
      byBaseName.set(baseName, h);
    }
  }

  return Array.from(byBaseName.values());
}

/**
 * Get formatted date string for display
 */
export function formatHolidayDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseLocalDate(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
