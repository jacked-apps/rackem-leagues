/**
 * @fileoverview League Utility Functions
 *
 * Reusable functions for league management including season detection,
 * league name generation, and date calculations.
 * Based on reference code patterns from globalFunctions.ts and dateFunctions.ts
 */
import { parseLocalDate, getDayOfWeekName } from './formatters';

/**
 * Determines the season based on a date
 * Spring: March, April, May (months 2-4)
 * Summer: June, July, August (months 5-7)
 * Fall: September, October, November (months 8-10)
 * Winter: December, January, February (months 11, 0, 1)
 *
 * @param date - The date to determine the season for
 * @returns The season name
 */
export const getTimeOfYear = (date: Date): string => {
  const month = date.getMonth();

  if (month >= 2 && month <= 4) {
    return 'Spring';
  } else if (month >= 5 && month <= 7) {
    return 'Summer';
  } else if (month >= 8 && month <= 10) {
    return 'Fall';
  } else {
    return 'Winter';
  }
};

/**
 * Gets the day of the week name from a date
 *
 * @param date - The date to get the day name for
 * @returns The day name (e.g., "Tuesday")
 */
export const getDayOfWeek = (date: Date): string => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
};

/**
 * Builds a league name from components
 * Format: "Game Day Season Year Venue/Organization"
 * Example: "9-Ball Tuesday Spring 2024 Acme Leagues"
 *
 * @param startDate - The league start date
 * @param gameType - The game type (8-ball, 9-ball, 10-ball)
 * @param organizationName - The organization name
 * @param qualifier - Optional qualifier (e.g., "West Side", "Blue")
 * @returns The formatted league name
 */
export const buildLeagueName = (
  startDate: string,
  gameType: string,
  organizationName: string,
  qualifier?: string
): string => {
  const parts: string[] = [];

  // Game type - use placeholder if missing
  const gameNames = {
    'eight_ball': '8-Ball',
    'nine_ball': '9-Ball',
    'ten_ball': '10-Ball'
  };
  const gameDisplay = gameType ? (gameNames[gameType as keyof typeof gameNames] || gameType) : '[Game]';
  parts.push(gameDisplay);

  // Day of week - use placeholder if no valid date
  let dayDisplay = '[Day]';
  if (startDate) {
    try {
      dayDisplay = typeof startDate === 'string' ? getDayOfWeekName(startDate) : getDayOfWeek(startDate);
    } catch {
      dayDisplay = '[Day]';
    }
  }
  parts.push(dayDisplay);

  // Season and year - use placeholder if no valid date
  let seasonDisplay = '[Season]';
  let yearDisplay = '[Year]';
  if (startDate) {
    try {
      const date = typeof startDate === 'string' ? parseLocalDate(startDate) : startDate;
      seasonDisplay = getTimeOfYear(date);
      yearDisplay = date.getFullYear().toString();
    } catch {
      seasonDisplay = '[Season]';
      yearDisplay = '[Year]';
    }
  }
  parts.push(seasonDisplay);
  parts.push(yearDisplay);

  // Organization name - use placeholder if missing or error
  const orgDisplay = (organizationName && organizationName.trim() && organizationName !== 'ORGANIZATION_NAME_ERROR')
    ? organizationName.trim()
    : '[Organization]';
  parts.push(orgDisplay);

  // Optional qualifier
  if (qualifier && qualifier.trim()) {
    parts.push(qualifier.trim());
  }

  return parts.join(' ');
};

/**
 * Builds a display-friendly league title from league components
 * Format: "9 Ball Tuesdays West Side Fall 2025"
 * Handles null/undefined values gracefully by skipping them
 *
 * @param options - League title components
 * @returns Formatted league title string
 *
 * @example
 * buildLeagueTitle({
 *   gameType: 'nine_ball',
 *   dayOfWeek: 'tuesday',
 *   division: 'West Side',
 *   season: 'Fall',
 *   year: 2025
 * })
 * // Returns: "9 Ball Tuesdays West Side Fall 2025"
 */
export const buildLeagueTitle = (options: {
  gameType?: string | null;
  dayOfWeek?: string | null;
  division?: string | null;
  season?: string | null;
  year?: number | null;
}): string => {
  const parts: string[] = [];

  // Game type: nine_ball -> 9 Ball
  if (options.gameType) {
    const gameTypeMap: Record<string, string> = {
      'eight_ball': '8 Ball',
      'nine_ball': '9 Ball',
      'ten_ball': '10 Ball'
    };
    parts.push(gameTypeMap[options.gameType] || options.gameType);
  }

  // Day of week: tuesday -> Tuesday (capitalize, no plural)
  if (options.dayOfWeek) {
    const dayName = options.dayOfWeek.charAt(0).toUpperCase() + options.dayOfWeek.slice(1);
    parts.push(dayName);
  }

  // Division/qualifier if exists
  if (options.division) {
    parts.push(options.division);
  }

  // Season
  if (options.season) {
    parts.push(options.season);
  }

  // Year
  if (options.year) {
    parts.push(options.year.toString());
  }

  return parts.join(' ');
};

/**
 * Generates all formatted league names for database storage
 *
 * @param components - The league components
 * @returns Object with all formatted name variations
 */
export const generateAllLeagueNames = (components: {
  organizationName: string;
  year: number;
  season: string;
  gameType: string;
  dayOfWeek: string;
  qualifier?: string;
}) => {
  const { organizationName, year, season, gameType, dayOfWeek, qualifier } = components;

  const gameDisplay = gameType.replace('_', '-').replace(/\b\w/g, l => l.toUpperCase());
  const qualifierPart = qualifier ? ` ${qualifier}` : '';

  return {
    // For reliable database sorting and parsing
    systematicName: `${organizationName} | ${year} | ${season} | ${gameDisplay} | ${dayOfWeek}${qualifier ? ` | ${qualifier}` : ''}`,

    // For player-friendly display
    playerFriendlyName: `${gameDisplay} ${dayOfWeek} ${season} ${year}${qualifierPart}`,

    // For operator management view
    operatorName: `${year} ${season} ${gameDisplay} ${dayOfWeek}${qualifierPart}`,

    // For mixed contexts with organization
    fullDisplayName: `${gameDisplay} ${dayOfWeek} ${season} ${year}${qualifierPart} (${organizationName})`
  };
};