/**
 * @fileoverview Formatting utilities for form inputs
 * Functions to format user input for consistent display and storage
 */

/**
 * Format phone number to XXX-XXX-XXXX format
 */
export const formatPhoneNumber = (input: string): string => {
  // Remove all non-digit characters
  const digits = input.replace(/\D/g, '');

  // Format based on length
  if (digits.length === 0) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

/**
 * Known acronyms that should stay uppercase
 */
const ACRONYMS = ['BCA', 'CSI', 'APA', 'VNEA', 'TAP', 'UPA', 'WPBA', 'WPA'];

/**
 * Capitalize a single word with special handling for:
 * - Acronyms (BCA, CSI, etc.) - kept uppercase
 * - "Mc" names (McDonald, McCormick) - capitalize after Mc
 * - "O'" names (O'Brien, O'Connor) - capitalize after O'
 */
const capitalizeWord = (word: string): string => {
  const upper = word.toUpperCase();

  // Check if it's a known acronym
  if (ACRONYMS.includes(upper)) {
    return upper;
  }

  // Handle "Mc" names (e.g., mcdonald -> McDonald)
  if (upper.startsWith('MC') && word.length > 2) {
    return 'Mc' + word.charAt(2).toUpperCase() + word.slice(3).toLowerCase();
  }

  // Handle "O'" names (e.g., o'brien -> O'Brien)
  if (upper.startsWith("O'") && word.length > 2) {
    return "O'" + word.charAt(2).toUpperCase() + word.slice(3).toLowerCase();
  }

  // Standard capitalization
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
};

/**
 * Capitalize words - shared utility for names, addresses, etc.
 * Handles acronyms (BCA, CSI) and special names (McDonald, O'Brien)
 */
export const capitalizeWords = (input: string): string => {
  // Handle non-string values gracefully
  if (typeof input !== 'string') return '';

  return input
    .trim()
    .split(' ')
    .map(capitalizeWord)
    .join(' ');
};

/**
 * Format final phone number for storage
 */
export const formatFinalPhoneNumber = (input: string): string => {
  // Remove all non-digit characters and return clean number
  return input.replace(/\D/g, '');
};

/**
 * Format league name with proper capitalization
 */
export const formatLeagueName = (input: string): string => {
  return capitalizeWords(input);
};

/**
 * Format venue name with proper capitalization
 */
export const formatVenueName = (input: string): string => {
  return capitalizeWords(input);
};

/**
 * Format contact name with proper capitalization
 */
export const formatContactName = (input: string): string => {
  return capitalizeWords(input);
};

/**
 * Format address with proper capitalization
 */
export const formatAddress = (input: string): string => {
  return input
    .trim()
    .split(' ')
    .map(word => {
      // Handle special cases like street abbreviations
      const upperWord = word.toUpperCase();
      if (['ST', 'AVE', 'BLVD', 'RD', 'DR', 'LN', 'CT', 'PL'].includes(upperWord)) {
        return upperWord;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
};

/**
 * Format number of tables input
 */
export const formatNumberOfTables = (input: string): string => {
  // Only allow digits
  const digits = input.replace(/\D/g, '');

  // Limit to reasonable range
  const num = parseInt(digits);
  if (isNaN(num)) return '';
  if (num > 50) return '50';

  return digits;
};

/**
 * Format city name with proper capitalization
 */
export const formatCity = (input: string): string => {
  return capitalizeWords(input);
};

/**
 * Format ZIP code to standard format
 */
export const formatZipCode = (input: string): string => {
  // Remove all non-digit characters except hyphens
  const cleaned = input.replace(/[^\d-]/g, '');

  // Handle 5+4 format (12345-6789) or just 5 digit (12345)
  if (cleaned.includes('-')) {
    const parts = cleaned.split('-');
    const zip5 = parts[0].slice(0, 5);
    const zip4 = parts[1] ? parts[1].slice(0, 4) : '';
    return zip4 ? `${zip5}-${zip4}` : zip5;
  }

  // For input without hyphen, add it if more than 5 digits
  const digits = cleaned.replace(/-/g, '');
  if (digits.length > 5) {
    return `${digits.slice(0, 5)}-${digits.slice(5, 9)}`;
  }

  return digits.slice(0, 5);
};

/**
 * Format credit card number with spaces for readability
 */
export const formatCardNumber = (input: string): string => {
  // Remove all non-digit characters
  const digits = input.replace(/\D/g, '');

  // Add spaces every 4 digits
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
};

/**
 * Format expiry date to MM/YY format
 */
export const formatExpiryDate = (input: string): string => {
  // Remove all non-digit characters
  const digits = input.replace(/\D/g, '');

  // Format as MM/YY
  if (digits.length >= 2) {
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
  }
  return digits;
};

/**
 * Format CVV to digits only
 */
export const formatCVV = (input: string): string => {
  // Only allow digits, max 4 characters
  return input.replace(/\D/g, '').slice(0, 4);
};

/**
 * Get card brand from card number
 */
export const getCardBrand = (cardNumber: string): string => {
  const number = cardNumber.replace(/\D/g, '');

  if (/^4/.test(number)) return 'visa';
  if (/^5[1-5]/.test(number)) return 'mastercard';
  if (/^3[47]/.test(number)) return 'amex';
  if (/^6/.test(number)) return 'discover';
  return 'unknown';
};

/**
 * Convert ISO date string (YYYY-MM-DD) to local date object without timezone offset
 *
 * IMPORTANT: HTML date inputs and Postgres DATE fields use YYYY-MM-DD format
 * without timezone info. When you create a Date object from this string using
 * `new Date('2024-01-15')`, JavaScript treats it as UTC midnight, which may be
 * the previous day in your local timezone.
 *
 * This function creates a Date object in the local timezone so the day number
 * matches the ISO string.
 *
 * @param isoDate - ISO date string (YYYY-MM-DD)
 * @returns Date object in local timezone representing that calendar date
 */
export const parseLocalDate = (isoDate: string): Date => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Convert Date object to ISO date string (YYYY-MM-DD) using local timezone
 *
 * This ensures the string represents the calendar date in the user's timezone,
 * not UTC. Use this when saving dates to the database or setting input values.
 *
 * @param date - Date object
 * @returns ISO date string (YYYY-MM-DD) in local timezone
 */
export const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get day of week from ISO date string, handling timezone correctly
 *
 * @param isoDate - ISO date string (YYYY-MM-DD)
 * @returns Day of week (0 = Sunday, 6 = Saturday)
 */
export const getDayOfWeek = (isoDate: string): number => {
  return parseLocalDate(isoDate).getDay();
};

/**
 * Get day of week name from ISO date string
 *
 * @param isoDate - ISO date string (YYYY-MM-DD)
 * @returns Day name (e.g., "Monday", "Tuesday")
 */
export const getDayOfWeekName = (isoDate: string): string => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[getDayOfWeek(isoDate)];
};

/**
 * Format timestamp to relative time (e.g., "5 minutes ago", "2 hours ago")
 *
 * @param dateString - ISO date string
 * @returns Formatted relative time string
 */
export const formatRelativeTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return date.toLocaleDateString();
  } catch {
    return '';
  }
};

/**
 * Check if a person is 18 years or older based on their date of birth
 *
 * Calculates age accounting for whether their birthday has occurred this year.
 * Used for age-restricted features like profanity filter settings.
 *
 * @param dateOfBirth - ISO date string (YYYY-MM-DD) or Date object
 * @returns true if 18 or older, false otherwise
 *
 * @example
 * isEighteenOrOlder('2000-01-15'); // true (if current date is past their 18th birthday)
 * isEighteenOrOlder('2010-06-20'); // false (under 18)
 */
export const isEighteenOrOlder = (dateOfBirth: string | Date): boolean => {
  const dob = typeof dateOfBirth === 'string' ? parseLocalDate(dateOfBirth) : dateOfBirth;
  const today = new Date();

  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  const dayDiff = today.getDate() - dob.getDate();

  // Adjust age if birthday hasn't occurred yet this year
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age--;
  }

  return age >= 18;
};

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, etc.)
 *
 * Handles special cases for 11th, 12th, 13th and standard suffixes.
 * Used for displaying rankings, seeds, and positions.
 *
 * @param n - The number to format
 * @returns The number with its ordinal suffix
 *
 * @example
 * getOrdinal(1);  // "1st"
 * getOrdinal(2);  // "2nd"
 * getOrdinal(3);  // "3rd"
 * getOrdinal(4);  // "4th"
 * getOrdinal(11); // "11th"
 * getOrdinal(21); // "21st"
 * getOrdinal(22); // "22nd"
 */
export const getOrdinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};