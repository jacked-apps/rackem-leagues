/**
 * @fileoverview Custom hook for short profile form state management
 *
 * Uses useReducer pattern to manage form state for the minimal registration form.
 * Handles field updates, error management, and loading state.
 */
import { useReducer } from 'react';
import type { ShortProfileFormState, ShortProfileFormAction } from './types';

/**
 * Initial state for the short profile form.
 * All fields start empty, errors are empty object.
 */
const initialState: ShortProfileFormState = {
  firstName: '',
  lastName: '',
  nickname: '',
  city: '',
  state: '',
  isOnTeam: null,
  isLoading: false,
  errors: {},
};

/**
 * Reducer function for form state management.
 * Handles field updates, error management, and loading state.
 *
 * @param state - Current form state
 * @param action - Action to perform on state
 * @returns Updated form state
 */
function formReducer(
  state: ShortProfileFormState,
  action: ShortProfileFormAction
): ShortProfileFormState {
  switch (action.type) {
    case 'SET_FIELD':
      return {
        ...state,
        [action.field]: action.value,
        errors: {
          ...state.errors,
          [action.field]: undefined, // Clear field error when user types
        },
      };
    case 'SET_ERRORS':
      return {
        ...state,
        errors: action.errors,
      };
    case 'CLEAR_ERRORS':
      return {
        ...state,
        errors: {},
      };
    case 'SET_IS_ON_TEAM':
      return {
        ...state,
        isOnTeam: action.value,
        errors: {
          ...state.errors,
          isOnTeam: undefined,
        },
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.loading,
      };
    default:
      return state;
  }
}

/**
 * Custom hook for short profile form state management.
 *
 * @returns Object containing form state and dispatch function
 *
 * @example
 * const { state, dispatch } = useShortProfileForm();
 *
 * // Update a field
 * dispatch({ type: 'SET_FIELD', field: 'firstName', value: 'John' });
 *
 * // Set validation errors
 * dispatch({ type: 'SET_ERRORS', errors: { firstName: 'Required' } });
 */
export const useShortProfileForm = () => {
  const [state, dispatch] = useReducer(formReducer, initialState);

  return { state, dispatch };
};
