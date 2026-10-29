/**
 * @fileoverview State reducer for Season Creation Wizard
 *
 * Centralized state management for the season creation wizard using useReducer.
 * Handles all wizard state including UI, navigation, data loading, and schedule generation.
 * Provides predictable state updates through typed reducer actions.
 */
import type { League } from '@/types/league';
import type { Season, ChampionshipEvent, WeekEntry, Holiday } from '@/types/season';
import type { ChampionshipDateOption } from '@/utils/tournamentUtils';
import type { ChampionshipPreference } from '@/data/seasonWizardSteps';

/**
 * Wizard state shape
 * Contains all non-schedule-related state
 */
export interface WizardState {
  // Simple flags
  loading: boolean;
  error: string | null;
  validationError: string | null;
  isCreating: boolean;
  isEditingExistingSeason: boolean;

  // UI state
  refreshKey: number;
  dayOfWeekWarning: {
    show: boolean;
    oldDay: string;
    newDay: string;
    newDate: string;
  } | null;

  // Navigation
  currentStep: number;

  // Data loading
  league: League | null;
  existingSeasons: Season[];
  bcaDateOptions: ChampionshipDateOption[];
  apaDateOptions: ChampionshipDateOption[];
  savedChampionshipPreferences: ChampionshipPreference[];

  // Schedule-related data
  holidays: Holiday[];
  bcaChampionship: ChampionshipEvent | undefined;
  apaChampionship: ChampionshipEvent | undefined;
  seasonStartDate: string;
  schedule: WeekEntry[];
}

/**
 * Wizard action types
 */
export type WizardAction =
  // Simple flags
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_VALIDATION_ERROR'; payload: string | null }
  | { type: 'SET_IS_CREATING'; payload: boolean }
  | { type: 'SET_IS_EDITING_EXISTING_SEASON'; payload: boolean }
  // UI state
  | { type: 'INCREMENT_REFRESH_KEY' }
  | { type: 'SET_DAY_OF_WEEK_WARNING'; payload: WizardState['dayOfWeekWarning'] }
  // Navigation
  | { type: 'SET_CURRENT_STEP'; payload: number }
  // Data loading
  | { type: 'SET_LEAGUE'; payload: League | null }
  | { type: 'SET_EXISTING_SEASONS'; payload: Season[] }
  | { type: 'SET_BCA_DATE_OPTIONS'; payload: ChampionshipDateOption[] }
  | { type: 'SET_APA_DATE_OPTIONS'; payload: ChampionshipDateOption[] }
  | { type: 'SET_SAVED_CHAMPIONSHIP_PREFERENCES'; payload: ChampionshipPreference[] }
  // Schedule-related data
  | { type: 'SET_HOLIDAYS'; payload: Holiday[] }
  | { type: 'SET_BCA_CHAMPIONSHIP'; payload: ChampionshipEvent | undefined }
  | { type: 'SET_APA_CHAMPIONSHIP'; payload: ChampionshipEvent | undefined }
  | { type: 'SET_SEASON_START_DATE'; payload: string }
  | { type: 'SET_SCHEDULE'; payload: WeekEntry[] };

/**
 * Create initial wizard state
 * @param leagueId - League ID for localStorage key
 */
export function createInitialState(leagueId: string | undefined): WizardState {
  // Restore current step from localStorage
  const stored = leagueId ? localStorage.getItem(`season-wizard-step-${leagueId}`) : null;
  const currentStep = stored ? parseInt(stored, 10) : 0;

  return {
    // Simple flags
    loading: true,
    error: null,
    validationError: null,
    isCreating: false,
    isEditingExistingSeason: false,

    // UI state
    refreshKey: 0,
    dayOfWeekWarning: null,

    // Navigation
    currentStep,

    // Data loading
    league: null,
    existingSeasons: [],
    bcaDateOptions: [],
    apaDateOptions: [],
    savedChampionshipPreferences: [],

    // Schedule-related data
    holidays: [],
    bcaChampionship: undefined,
    apaChampionship: undefined,
    seasonStartDate: '',
    schedule: [],
  };
}

/**
 * Wizard state reducer
 * Handles all state updates in a predictable way
 */
export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    // Simple flags
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_VALIDATION_ERROR':
      return { ...state, validationError: action.payload };
    case 'SET_IS_CREATING':
      return { ...state, isCreating: action.payload };
    case 'SET_IS_EDITING_EXISTING_SEASON':
      return { ...state, isEditingExistingSeason: action.payload };

    // UI state
    case 'INCREMENT_REFRESH_KEY':
      return { ...state, refreshKey: state.refreshKey + 1 };
    case 'SET_DAY_OF_WEEK_WARNING':
      return { ...state, dayOfWeekWarning: action.payload };

    // Navigation
    case 'SET_CURRENT_STEP':
      return { ...state, currentStep: action.payload };

    // Data loading
    case 'SET_LEAGUE':
      return { ...state, league: action.payload };
    case 'SET_EXISTING_SEASONS':
      return { ...state, existingSeasons: action.payload };
    case 'SET_BCA_DATE_OPTIONS':
      return { ...state, bcaDateOptions: action.payload };
    case 'SET_APA_DATE_OPTIONS':
      return { ...state, apaDateOptions: action.payload };
    case 'SET_SAVED_CHAMPIONSHIP_PREFERENCES':
      return { ...state, savedChampionshipPreferences: action.payload };

    // Schedule-related data
    case 'SET_HOLIDAYS':
      return { ...state, holidays: action.payload };
    case 'SET_BCA_CHAMPIONSHIP':
      return { ...state, bcaChampionship: action.payload };
    case 'SET_APA_CHAMPIONSHIP':
      return { ...state, apaChampionship: action.payload };
    case 'SET_SEASON_START_DATE':
      return { ...state, seasonStartDate: action.payload };
    case 'SET_SCHEDULE':
      return { ...state, schedule: action.payload };

    default:
      return state;
  }
}
