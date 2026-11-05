/**
 * @fileoverview TypeScript types for the new player application form
 * Defines the shape of form state and actions for the useReducer pattern
 */

/**
 * Form state interface for the new player application
 * Contains all form fields plus error tracking for validation feedback
 */
export interface FormState {
  // Personal information
  firstName: string;
  lastName: string;
  nickname: string; // Optional display name

  // Contact information
  phone: string; // US format: XXX-XXX-XXXX
  // email is pulled from auth user, not form state

  // Address information
  address: string; // Street address
  city: string;
  state: string; // US state code (e.g., "CA", "NY")
  zipCode: string;

  // Other details
  dateOfBirth: string; // ISO date format from date input

  // UI state
  isLoading: boolean; // Loading state during form submission

  // Validation errors - optional fields that show error messages
  errors: {
    firstName?: string;
    lastName?: string;
    nickname?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    dateOfBirth?: string;
    general?: string; // For general errors like database issues
  };
}

/**
 * Action types for the form reducer
 * Supports updating individual fields, setting multiple errors, or clearing all errors
 */
export type FormAction =
  | { type: 'SET_FIELD'; field: keyof FormState; value: string } // Update a single form field
  | { type: 'SET_ERRORS'; errors: FormState['errors'] } // Set validation errors
  | { type: 'CLEAR_ERRORS' } // Clear all validation errors
  | { type: 'SET_LOADING'; loading: boolean }; // Set loading state