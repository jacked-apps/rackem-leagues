/**
 * @fileoverview Custom hook for auto-filling and auto-advancing championship steps
 *
 * When an operator has saved championship preferences (from a previous season),
 * this hook automatically populates the BCA/APA championship steps and advances
 * past them, creating a seamless "breeze through" experience.
 *
 * This improves UX by:
 * - Reducing repetitive data entry
 * - Speeding up season creation for repeat operators
 * - Maintaining consistency across seasons
 */
import { useEffect } from 'react';
import type { SeasonFormData, ChampionshipPreference } from '@/wizards/season-v1/seasonWizardSteps';
import type { League } from '@/types/league';
import type { Season } from '@/types/season';
import type { ChampionshipDateOption } from '@/utils/tournamentUtils';
import { getSeasonWizardSteps } from '@/wizards/season-v1/seasonWizardSteps';

/**
 * Parameters for the useChampionshipAutoFill hook
 */
export interface UseChampionshipAutoFillParams {
  /** Current wizard step number */
  currentStep: number;
  /** League ID for localStorage keys */
  leagueId: string | undefined;
  /** Whether initial data is still loading */
  loading: boolean;
  /** League data */
  league: League | null;
  /** Saved championship preferences from database */
  savedChampionshipPreferences: ChampionshipPreference[];
  /** Existing seasons (to determine if creating first season) */
  existingSeasons: Season[];
  /** BCA championship date options */
  bcaDateOptions: ChampionshipDateOption[];
  /** APA championship date options */
  apaDateOptions: ChampionshipDateOption[];
  /** Callback to update current step */
  onStepChange: (step: number) => void;
}

/**
 * Custom hook for auto-filling championship preferences
 *
 * Automatically populates and advances past BCA/APA championship steps
 * when the operator has saved preferences from previous seasons.
 *
 * @param params - Configuration and callbacks for auto-fill behavior
 *
 * @example
 * ```tsx
 * useChampionshipAutoFill({
 *   currentStep: state.currentStep,
 *   leagueId,
 *   loading: state.loading,
 *   league: state.league,
 *   savedChampionshipPreferences: state.savedChampionshipPreferences,
 *   existingSeasons: state.existingSeasons,
 *   bcaDateOptions: state.bcaDateOptions,
 *   apaDateOptions: state.apaDateOptions,
 *   onStepChange: (step) => {
 *     dispatch({ type: 'SET_CURRENT_STEP', payload: step });
 *     localStorage.setItem(`season-wizard-step-${leagueId}`, step.toString());
 *   },
 * });
 * ```
 */
export function useChampionshipAutoFill(params: UseChampionshipAutoFillParams) {
  const {
    currentStep,
    leagueId,
    loading,
    league,
    savedChampionshipPreferences,
    existingSeasons,
    bcaDateOptions,
    apaDateOptions,
    onStepChange,
  } = params;

  useEffect(() => {
    // Don't run if data isn't ready or no saved preferences
    if (!leagueId || loading || !league || savedChampionshipPreferences.length === 0) return;

    // Get current step configuration
    const steps = getSeasonWizardSteps(
      leagueId,
      existingSeasons.length > 0,
      existingSeasons.length > 0 ? undefined : league.league_start_date,
      league.day_of_week,
      () => {}, // handleDayOfWeekChange not needed for step detection
      bcaDateOptions,
      apaDateOptions,
      savedChampionshipPreferences
    );

    const currentStepData = steps[currentStep];
    if (!currentStepData) return;

    // Check if we're on BCA or APA choice step
    if (currentStepData.id === 'bcaChoice' || currentStepData.id === 'apaChoice') {
      const organization = currentStepData.id === 'bcaChoice' ? 'BCA' : 'APA';
      const preference = savedChampionshipPreferences.find(p => p.organization === organization);

      if (preference) {
        // Auto-populate localStorage with saved preference
        const STORAGE_KEY = `season-creation-${leagueId}`;
        const stored = localStorage.getItem(STORAGE_KEY);

        const formData: SeasonFormData = stored ? JSON.parse(stored) : {
          startDate: '',
          seasonLength: '16',
          isCustomLength: false,
          bcaChoice: '',
          bcaStartDate: '',
          bcaEndDate: '',
          bcaIgnored: false,
          apaChoice: '',
          apaStartDate: '',
          apaEndDate: '',
          apaIgnored: false,
        };

        if (organization === 'BCA') {
          formData.bcaChoice = 'saved-preference';
          formData.bcaStartDate = preference.startDate;
          formData.bcaEndDate = preference.endDate;
          formData.bcaIgnored = preference.ignored;
        } else {
          formData.apaChoice = 'saved-preference';
          formData.apaStartDate = preference.startDate;
          formData.apaEndDate = preference.endDate;
          formData.apaIgnored = preference.ignored;
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));

        // Auto-advance to next step
        const nextStep = currentStep + 1;
        onStepChange(nextStep);
      }
    }
  }, [
    currentStep,
    leagueId,
    loading,
    league,
    savedChampionshipPreferences,
    existingSeasons,
    bcaDateOptions,
    apaDateOptions,
    onStepChange,
  ]);
}
