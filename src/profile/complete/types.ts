/**
 * @fileoverview TypeScript types for the short profile registration form
 *
 * Defines the shape of form state and actions for the useReducer pattern.
 * This is a minimal version of the full player form, collecting only
 * essential fields for initial registration.
 */

/**
 * Form state interface for the short profile form.
 * Contains minimal required fields plus error tracking.
 */
export interface ShortProfileFormState {
  // Required personal information
  firstName: string;
  lastName: string;
  nickname: string; // Optional - auto-generated if empty

  // Location for PP fuzzy matching
  city: string;
  state: string; // US state code (e.g., "CA", "NY")

  // PP detection question
  // null = not answered yet, true = yes on a team, false = not on a team
  isOnTeam: boolean | null;

  // UI state
  isLoading: boolean;

  // Validation errors
  errors: {
    firstName?: string;
    lastName?: string;
    nickname?: string;
    city?: string;
    state?: string;
    isOnTeam?: string;
    general?: string; // For general errors like database issues
  };
}

/**
 * Action types for the form reducer.
 * Supports updating fields, setting errors, and managing loading state.
 */
export type ShortProfileFormAction =
  | { type: 'SET_FIELD'; field: keyof Omit<ShortProfileFormState, 'isLoading' | 'errors' | 'isOnTeam'>; value: string }
  | { type: 'SET_IS_ON_TEAM'; value: boolean }
  | { type: 'SET_ERRORS'; errors: ShortProfileFormState['errors'] }
  | { type: 'CLEAR_ERRORS' }
  | { type: 'SET_LOADING'; loading: boolean };
