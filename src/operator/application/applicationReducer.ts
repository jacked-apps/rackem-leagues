/**
 * @fileoverview Application Reducer
 * State management logic for league operator application form
 */
import { logger } from '@/utils/logger';
import type {
  LeagueOperatorApplication as ApplicationData
} from '../../schemas/leagueOperatorSchema';
import type { ApplicationAction } from './types';

/**
 * LocalStorage key for persisting application state
 */
const STORAGE_KEY = 'leagueOperatorApplication';

/**
 * Default initial state for the league operator application form
 */
const defaultInitialState: ApplicationData = {
  leagueName: '',
  useProfileAddress: undefined,
  organizationAddress: '',
  organizationCity: '',
  organizationState: '',
  organizationZipCode: '',
  contactDisclaimerAcknowledged: undefined,
  useProfileEmail: undefined,
  leagueEmail: '',
  emailVisibility: undefined,
  useProfilePhone: undefined,
  leaguePhone: '',
  phoneVisibility: undefined,
  paymentToken: '',
  cardLast4: '',
  cardBrand: '',
  expiryMonth: undefined,
  expiryYear: undefined,
  billingZip: '',
  paymentVerified: undefined,
  venues: [],
  contactName: '',
  contactEmail: '',
  contactPhone: '',
};

/**
 * Load application state from localStorage
 * Returns default state if no saved state exists or if there's an error
 */
export const loadApplicationState = (): ApplicationData => {
  try {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      const parsed = JSON.parse(savedState);
      // Merge with default state to handle any new fields that might have been added
      const mergedState = { ...defaultInitialState, ...parsed };

      // Validate string fields to prevent [object Object] crashes
      // If any string field got corrupted to an object, reset it to default
      if (typeof mergedState.leagueName !== 'string') {
        mergedState.leagueName = '';
      }
      if (typeof mergedState.leagueEmail !== 'string') {
        mergedState.leagueEmail = '';
      }
      if (typeof mergedState.leaguePhone !== 'string') {
        mergedState.leaguePhone = '';
      }

      return mergedState;
    }
  } catch (error) {
    logger.warn('Failed to load saved application state', { error });
  }
  return defaultInitialState;
};

/**
 * Save application state to localStorage
 */
export const saveApplicationState = (state: ApplicationData): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    logger.warn('Failed to save application state', { error });
  }
};

/**
 * Clear saved application state from localStorage
 */
export const clearApplicationState = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    logger.warn('Failed to clear saved application state', { error });
  }
};

/**
 * Get initial state for the league operator application form
 * This function should be called each time the component mounts
 * to ensure fresh data is loaded from localStorage
 */
export const getInitialApplicationState = (): ApplicationData => loadApplicationState();

/**
 * Application state reducer for managing form data
 *
 * Handles all form field updates and venue management operations
 * using immutable state updates for predictable state changes.
 *
 * @param state - Current application state
 * @param action - Action object with type and payload
 * @returns Updated application state
 */
export function applicationReducer(
  state: ApplicationData,
  action: ApplicationAction
): ApplicationData {
  let newState: ApplicationData;

  switch (action.type) {
    case 'SET_LEAGUE_NAME':
      newState = { ...state, leagueName: action.payload };
      break;

    case 'SET_USE_PROFILE_ADDRESS':
      newState = { ...state, useProfileAddress: action.payload };
      break;

    case 'SET_ORGANIZATION_ADDRESS':
      newState = { ...state, organizationAddress: action.payload };
      break;

    case 'SET_ORGANIZATION_CITY':
      newState = { ...state, organizationCity: action.payload };
      break;

    case 'SET_ORGANIZATION_STATE':
      newState = { ...state, organizationState: action.payload };
      break;

    case 'SET_ORGANIZATION_ZIP_CODE':
      newState = { ...state, organizationZipCode: action.payload };
      break;

    case 'SET_CONTACT_DISCLAIMER_ACKNOWLEDGED':
      newState = { ...state, contactDisclaimerAcknowledged: action.payload };
      break;

    case 'SET_USE_PROFILE_EMAIL':
      newState = { ...state, useProfileEmail: action.payload };
      break;

    case 'SET_LEAGUE_EMAIL':
      newState = { ...state, leagueEmail: action.payload };
      break;

    case 'SET_EMAIL_VISIBILITY':
      newState = { ...state, emailVisibility: action.payload };
      break;

    case 'SET_USE_PROFILE_PHONE':
      newState = { ...state, useProfilePhone: action.payload };
      break;

    case 'SET_LEAGUE_PHONE':
      newState = { ...state, leaguePhone: action.payload };
      break;

    case 'SET_PHONE_VISIBILITY':
      newState = { ...state, phoneVisibility: action.payload };
      break;

    case 'SET_PAYMENT_INFO':
      newState = {
        ...state,
        paymentToken: action.payload.paymentToken,
        cardLast4: action.payload.cardLast4,
        cardBrand: action.payload.cardBrand,
        expiryMonth: action.payload.expiryMonth,
        expiryYear: action.payload.expiryYear,
        billingZip: action.payload.billingZip,
        paymentVerified: action.payload.paymentVerified
      };
      break;

    case 'ADD_VENUE':
      newState = { ...state, venues: [...state.venues, action.payload] };
      break;

    case 'UPDATE_VENUE':
      newState = {
        ...state,
        venues: state.venues.map((venue) =>
          venue.id === action.payload.id
            ? { ...venue, [action.payload.field]: action.payload.value }
            : venue
        ),
      };
      break;

    case 'SET_CONTACT_NAME':
      newState = { ...state, contactName: action.payload };
      break;

    case 'SET_CONTACT_EMAIL':
      newState = { ...state, contactEmail: action.payload };
      break;

    case 'SET_CONTACT_PHONE':
      newState = { ...state, contactPhone: action.payload };
      break;

    default:
      return state;
  }

  // Automatically save to localStorage on every state change
  saveApplicationState(newState);
  return newState;
}