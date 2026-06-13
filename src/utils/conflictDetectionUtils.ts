/**
 * @fileoverview Conflict Detection Utilities
 *
 * Shared utilities for detecting and processing schedule conflicts with holidays/championships.
 * Used by both initial season creation and mid-season schedule modifications.
 */
import type { WeekEntry, ConflictFlag, ConflictSeverity, Holiday, ChampionshipEvent } from '@/types/season';
import { extractLeagueNights, isTravelHoliday } from './holidayUtils';
import { parseLocalDate } from './formatters';
import { CONFLICT_DETECTION_THRESHOLD_DAYS, SEVERITY_ORDER } from '@/constants/scheduleConflicts';

/**
 * Main entry point: Detects conflicts and adds them to schedule weeks
 *
 * @param schedule - Schedule weeks to check for conflicts
 * @param holidays - Array of holidays to check against
 * @param bcaChampionship - BCA championship dates (optional)
 * @param apaChampionship - APA championship dates (optional)
 * @param leagueDayOfWeek - Day of week league plays (e.g., 'tuesday')
 * @returns Schedule with conflicts detected and added to each week
 */
export function detectScheduleConflicts(
  schedule: WeekEntry[],
  holidays: Holiday[],
  bcaChampionship: ChampionshipEvent | undefined,
  apaChampionship: ChampionshipEvent | undefined,
  leagueDayOfWeek: string
): WeekEntry[] {
  // Build unified conflict list: holidays + championship league nights
  const allConflicts = buildConflictList(
    holidays,
    bcaChampionship,
    apaChampionship,
    leagueDayOfWeek
  );

  // Map each conflict to its closest week
  const conflictToClosestWeek = mapConflictsToClosestWeeks(allConflicts, schedule);

  // Build conflicts array for each week
  return schedule.map((week, weekIndex) => {
    const conflicts: ConflictFlag[] = [];
    const weekDate = parseLocalDate(week.date);

    // Check all conflicts that selected this week as closest
    allConflicts.forEach((conflict) => {
      const conflictDateStr = conflict.date.split(' ')[0];

      // Only add conflict if this is the closest week
      if (conflictToClosestWeek.get(conflictDateStr) !== weekIndex) return;

      const conflictDate = parseLocalDate(conflictDateStr);
      const daysAway = Math.floor((conflictDate.getTime() - weekDate.getTime()) / (1000 * 60 * 60 * 24));
      const absDaysAway = Math.abs(daysAway);

      const isTravel = isTravelHoliday(conflict.name, leagueDayOfWeek);
      const severity = calculateConflictSeverity(absDaysAway, isTravel);
      const timingDesc = formatTimingDescription(daysAway, absDaysAway, conflictDate);

      conflicts.push({
        type: conflict.type === 'championship' ? 'championship' : 'holiday',
        name: `${conflict.name} (${timingDesc})`,
        reason: isTravel ? 'Travel week - plan for reduced attendance' : `${absDaysAway} day${absDaysAway !== 1 ? 's' : ''} from league night`,
        severity,
        daysAway: absDaysAway,
      });
    });

    return { ...week, conflicts };
  });
}

/**
 * Build unified list of all conflicts (holidays + championship league nights)
 *
 * @param holidays - Array of holidays
 * @param bcaChampionship - BCA championship dates (optional)
 * @param apaChampionship - APA championship dates (optional)
 * @param leagueDayOfWeek - Day of week league plays
 * @returns Combined array of all conflicts
 */
export function buildConflictList(
  holidays: Holiday[],
  bcaChampionship: ChampionshipEvent | undefined,
  apaChampionship: ChampionshipEvent | undefined,
  leagueDayOfWeek: string
): Holiday[] {
  const allConflicts: Holiday[] = [...holidays];

  // Extract BCA championship league nights
  if (bcaChampionship && bcaChampionship.start && bcaChampionship.end) {
    const bcaWeeks = extractLeagueNights(
      bcaChampionship.start,
      bcaChampionship.end,
      leagueDayOfWeek,
      'BCA National Tournament'
    );
    allConflicts.push(...bcaWeeks);
  }

  // Extract APA championship league nights
  if (apaChampionship && apaChampionship.start && apaChampionship.end) {
    const apaWeeks = extractLeagueNights(
      apaChampionship.start,
      apaChampionship.end,
      leagueDayOfWeek,
      'APA National Tournament'
    );
    allConflicts.push(...apaWeeks);
  }

  return allConflicts;
}

/**
 * Two-pass algorithm: Find closest league night for each conflict
 *
 * Pass 1: For each conflict, find all weeks within threshold and determine closest
 * Pass 2: Return map of conflict date -> closest week index
 *
 * @param conflicts - Array of all conflicts to map
 * @param schedule - Schedule weeks to check against
 * @returns Map of conflict date string -> closest week index
 */
export function mapConflictsToClosestWeeks(
  conflicts: Holiday[],
  schedule: WeekEntry[]
): Map<string, number> {
  const conflictToClosestWeek = new Map<string, number>();

  conflicts.forEach((conflict) => {
    const conflictDateStr = conflict.date.split(' ')[0];
    const conflictDate = parseLocalDate(conflictDateStr);

    let closestWeekIndex = -1;
    let closestDistance = Infinity;

    schedule.forEach((week, weekIndex) => {
      const weekDate = parseLocalDate(week.date);
      const daysAway = Math.floor((conflictDate.getTime() - weekDate.getTime()) / (1000 * 60 * 60 * 24));
      const absDaysAway = Math.abs(daysAway);

      // Only consider weeks within threshold
      if (absDaysAway > CONFLICT_DETECTION_THRESHOLD_DAYS) return;

      // Track closest week (if tie, prefer week BEFORE the holiday)
      if (absDaysAway < closestDistance || (absDaysAway === closestDistance && daysAway > 0)) {
        closestDistance = absDaysAway;
        closestWeekIndex = weekIndex;
      }
    });

    if (closestWeekIndex !== -1) {
      conflictToClosestWeek.set(conflictDateStr, closestWeekIndex);
    }
  });

  return conflictToClosestWeek;
}

/**
 * Calculate conflict severity based on distance and travel status
 *
 * Severity levels:
 * - Critical (red): Same day OR travel holiday within threshold
 * - High (orange): 1 day away
 * - Medium (yellow): 2 days away
 * - Low (blue): 3-4 days away
 *
 * @param absDaysAway - Absolute days between conflict and league night
 * @param isTravel - Whether this is a travel holiday
 * @returns ConflictSeverity level
 */
export function calculateConflictSeverity(
  absDaysAway: number,
  isTravel: boolean
): ConflictSeverity {
  if (isTravel && absDaysAway <= CONFLICT_DETECTION_THRESHOLD_DAYS) {
    return 'critical';
  } else if (absDaysAway === 0) {
    return 'critical';
  } else if (absDaysAway === 1) {
    return 'high';
  } else if (absDaysAway === 2) {
    return 'medium';
  } else {
    // 3-4 days
    return 'low';
  }
}

/**
 * Format timing description with day of week
 *
 * Examples:
 * - "same day"
 * - "Wednesday 2 days before"
 * - "Friday 3 days after"
 *
 * @param daysAway - Signed days (negative = before, positive = after)
 * @param absDaysAway - Absolute days
 * @param conflictDate - Date of the conflict
 * @returns Formatted timing description string
 */
export function formatTimingDescription(
  daysAway: number,
  absDaysAway: number,
  conflictDate: Date
): string {
  if (absDaysAway === 0) {
    return 'same day';
  }

  const dayOfWeek = conflictDate.toLocaleDateString('en-US', { weekday: 'long' });
  const direction = daysAway > 0 ? 'after' : 'before';
  const dayText = absDaysAway === 1 ? 'day' : 'days';

  return `${dayOfWeek} ${absDaysAway} ${dayText} ${direction}`;
}

/**
 * Strip the timing description from a conflict's name, leaving the bare label.
 *
 * Conflict names carry a parenthetical timing suffix (see `buildConflictList`):
 * e.g. "Christmas (Saturday 2 days before)" → "Christmas". Used to seed a
 * human-friendly week-off reason from a conflict flag.
 *
 * @param conflictName - the full ConflictFlag.name (may or may not have a suffix).
 * @returns the label with any " (...)" timing suffix removed.
 */
export function extractHolidayName(conflictName: string): string {
  const parenIndex = conflictName.indexOf(' (');
  return parenIndex !== -1 ? conflictName.substring(0, parenIndex) : conflictName;
}

/**
 * Get the highest severity conflict from an array of conflicts
 *
 * Used to determine what severity badge to show when multiple conflicts exist
 *
 * @param conflicts - Array of conflicts to check
 * @returns Highest severity level, or null if no conflicts
 */
export function getHighestSeverity(
  conflicts: ConflictFlag[]
): ConflictSeverity | null {
  if (conflicts.length === 0) return null;

  return conflicts.reduce((highest, conflict) => {
    return SEVERITY_ORDER[conflict.severity] < SEVERITY_ORDER[highest]
      ? conflict.severity
      : highest;
  }, conflicts[0].severity);
}
