/**
 * @fileoverview Schedule Display Utilities
 *
 * Reusable utility functions for schedule display logic.
 * Keeps components clean and logic testable.
 */

import type { MatchWithDetails } from '@/types';

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
