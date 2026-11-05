import { useReducer } from 'react';
import type { FormState, FormAction } from './types';

// Initial state
const initialState: FormState = {
  firstName: '',
  lastName: '',
  nickname: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  dateOfBirth: '',
  isLoading: false,
  errors: {},
};

// Reducer function
function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_FIELD':
      return {
        ...state,
        [action.field]: action.value,
        errors: {
          ...state.errors,
          [action.field]: undefined, // Clear error when user types
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
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.loading,
      };
    default:
      return state;
  }
}

// Custom hook for player form state management
export const usePlayerForm = () => {
  const [state, dispatch] = useReducer(formReducer, initialState);

  return { state, dispatch };
};