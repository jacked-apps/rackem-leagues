/**
 * @fileoverview Schedule Display Utilities
 *
 * Reusable utility functions for schedule display logic.
 * Keeps components clean and logic testable.
 */

import type { MatchWithDetails } from '@/types';
import type { SeasonWeek } from '@/types/season';

/**
 * Week type styling configuration
 */
interface WeekStyle {
  bgColor: string;
  badge: string;
  badgeColor: string;
}

/**
 * Get styling classes and label based on week type
 *
 * @param weekType - Type of week (regular, playoffs, blackout, season_end_break)
 * @returns Styling configuration for the week
 *
 * @example
 * const style = getWeekTypeStyle('playoffs');
 * // Returns: { bgColor: 'bg-purple-50', badge: '', badgeColor: '' }
 */
export function getWeekTypeStyle(weekType: string): WeekStyle {
  switch (weekType) {
    case 'playoffs':
      return {
        bgColor: 'bg-purple-50',
        badge: '',
        badgeColor: '',
      };
    case 'blackout':
      return {
        bgColor: 'bg-muted',
        badge: '',
        badgeColor: '',
      };
    case 'season_end_break':
      return {
        bgColor: 'bg-yellow-50',
        badge: 'BREAK',
        badgeColor: 'bg-yellow-600 text-white',
      };
    default:
      return {
        bgColor: 'bg-muted',
        badge: '',
        badgeColor: '',
      };
  }
}

/**
 * Get empty week message based on week type
 *
 * @param weekType - Type of week
 * @returns Appropriate message for empty week
 *
 * @example
 * getEmptyWeekMessage('playoffs'); // Returns: 'Matchups TBD'
 */
export function getEmptyWeekMessage(weekType: string): string {
  switch (weekType) {
    case 'playoffs':
      return 'Matchups TBD';
    case 'regular':
      return 'No matches scheduled';
    default:
      return 'No matches this week';
  }
}

/**
 * Calculate table numbers per venue within a week
 *
 * Each venue maintains its own table counter (1, 2, 3...).
 * Matches are sorted by match_number to maintain consistent ordering.
 *
 * @param matches - Array of matches for a week
 * @returns Map of match ID to venue-specific table number
 *
 * @example
 * const tableNumbers = calculateTableNumbers(matches);
 * const tableNum = tableNumbers.get(match.id); // Returns: 2
 */
export function calculateTableNumbers(matches: MatchWithDetails[]): Map<string, number> {
  const tableNumbers = new Map<string, number>();
  const venueCounters = new Map<string, number>();

  // Sort matches by match_number to maintain consistent ordering
  const sortedMatches = [...matches].sort((a, b) => a.match_number - b.match_number);

  for (const match of sortedMatches) {
    if (match.scheduled_venue_id) {
      // Get current counter for this venue (or start at 0)
      const currentCount = venueCounters.get(match.scheduled_venue_id) || 0;
      const tableNumber = currentCount + 1;

      // Store the table number for this match
      tableNumbers.set(match.id, tableNumber);

      // Increment the counter for this venue
      venueCounters.set(match.scheduled_venue_id, tableNumber);
    }
  }

  return tableNumbers;
}

/**
 * Derive every week's display label from the season's weeks — WITHOUT reading any
 * stored week number.
 *
 * This is the single source of truth for "Week N" labels. The number is NOT stored
 * anywhere; it is the week's position among the season's *play* weeks of its kind,
 * counted by date. Blackouts (and the legacy `season_end_break` skip) are never
 * numbered — they show their own label.
 *
 * Why derive instead of store: a stored number is written by several code paths that
 * disagree about how to count around blackouts, so it drifts (e.g. a season labeled
 * "Week 1, Week 3, Week 4…" that skips "Week 2", or a duplicate "Week 14" after a
 * length change). Counting from position can never drift or collide.
 *
 * Counting rule (the load-bearing invariant): regular weeks sorted by `scheduled_date`
 * ascending are in chart-round order, so the Nth-earliest regular week IS round N. The
 * UNIQUE(season_id, scheduled_date) DB constraint guarantees that order is total.
 *
 * Build this map ONCE per loaded set of weeks, then look up by week id — never call a
 * per-row deriver in a render loop (that would re-scan the whole season for each row).
 *
 * @param weeks - All `season_weeks` rows for one season (any order; this sorts a copy)
 * @returns Map of week id → display label ("Week 3", "Playoffs Week 2", "Christmas")
 *
 * @example
 * const labels = deriveWeekLabels(seasonWeeks);
 * const label = labels.get(week.id); // "Week 3"
 */
export function deriveWeekLabels(weeks: SeasonWeek[]): Map<string, string> {
  const labels = new Map<string, string>();

  // ISO date strings (YYYY-MM-DD) sort correctly as plain strings, so no Date parsing
  // is needed — this also sidesteps timezone off-by-one bugs.
  const byDate = (a: SeasonWeek, b: SeasonWeek) =>
    a.scheduled_date < b.scheduled_date ? -1 : a.scheduled_date > b.scheduled_date ? 1 : 0;

  // Regular weeks → "Week N" by 1-based position among regular weeks.
  const regular = weeks.filter(w => w.week_type === 'regular').sort(byDate);
  regular.forEach((week, i) => labels.set(week.id, `Week ${i + 1}`));

  // Playoff weeks → "Playoffs" (single) or "Playoffs Week k" (multi).
  const playoffs = weeks.filter(w => w.week_type === 'playoffs').sort(byDate);
  playoffs.forEach((week, i) =>
    labels.set(week.id, playoffs.length > 1 ? `Playoffs Week ${i + 1}` : 'Playoffs')
  );

  // Skip weeks (blackout, plus the legacy season_end_break during the transition) show
  // their own label. The label lives in `notes` going forward; fall back to `week_name`
  // until the data migration backfills it (this fallback is removed once week_name is
  // dropped).
  for (const week of weeks) {
    if (week.week_type === 'blackout' || week.week_type === 'season_end_break') {
      labels.set(week.id, week.notes ?? week.week_name);
    }
  }

  return labels;
}
