/**
 * @fileoverview Custom hook for schedule generation in Season Creation Wizard
 *
 * Extracts the complex schedule generation logic from SeasonCreationWizard.
 * Handles:
 * - Loading schedule from localStorage or generating fresh
 * - Fetching holidays for the season
 * - Detecting conflicts with championships
 * - Setting schedule, seasonStartDate, holidays, and championship data
 *
 * Only runs once when entering schedule-review step to prevent infinite loops.
 */
import { useEffect, useRef } from 'react';
import type { SeasonFormData, ChampionshipPreference } from '@/data/seasonWizardSteps';
import type { League } from '@/types/league';
import type { Season, ChampionshipEvent, WeekEntry, Holiday } from '@/types/season';
import type { ChampionshipDateOption } from '@/utils/tournamentUtils';
import { formatDayOfWeek } from '@/types/league';
import { parseLocalDate } from '@/utils/formatters';
import { generateSchedule } from '@/utils/scheduleUtils';
import { fetchHolidaysForSeason } from '@/utils/holidayUtils';
import { detectScheduleConflicts } from '@/utils/conflictDetectionUtils';
import { getChampionshipPreferences } from '@/api/queries/seasons';

/**
 * Parameters for the useScheduleGeneration hook
 */
export interface UseScheduleGenerationParams {
  /** Current wizard step number */
  currentStep: number;
  /** Whether the current step is a schedule-review step */
  isScheduleReviewStep: boolean;
  /** League data */
  league: League | null;
  /** League ID for localStorage keys */
  leagueId: string | undefined;
  /** Whether initial data is still loading */
  loading: boolean;
  /** Operator ID for fetching preferences */
  operatorId: string | null;
  /** Existing seasons (to determine if editing) */
  existingSeasons: Season[];
  /** BCA championship date options */
  bcaDateOptions: ChampionshipDateOption[];
  /** APA championship date options */
  apaDateOptions: ChampionshipDateOption[];
  /** Saved championship preferences */
  savedChampionshipPreferences: ChampionshipPreference[];
  /** Callback to update schedule state */
  onScheduleUpdate: (schedule: WeekEntry[]) => void;
  /** Callback to update season start date */
  onSeasonStartDateUpdate: (startDate: string) => void;
  /** Callback to update holidays */
  onHolidaysUpdate: (holidays: Holiday[]) => void;
  /** Callback to update BCA championship event */
  onBcaChampionshipUpdate: (championship: ChampionshipEvent | undefined) => void;
  /** Callback to update APA championship event */
  onApaChampionshipUpdate: (championship: ChampionshipEvent | undefined) => void;
}

/**
 * Custom hook for schedule generation
 *
 * @param params - Configuration and callbacks for schedule generation
 *
 * @example
 * ```tsx
 * useScheduleGeneration({
 *   currentStep: state.currentStep,
 *   isScheduleReviewStep: currentStepData?.type === 'schedule-review',
 *   league: state.league,
 *   leagueId,
 *   loading: state.loading,
 *   operatorId,
 *   existingSeasons: state.existingSeasons,
 *   bcaDateOptions: state.bcaDateOptions,
 *   apaDateOptions: state.apaDateOptions,
 *   savedChampionshipPreferences: state.savedChampionshipPreferences,
 *   onScheduleUpdate: (schedule) => dispatch({ type: 'SET_SCHEDULE', payload: schedule }),
 *   onSeasonStartDateUpdate: (date) => dispatch({ type: 'SET_SEASON_START_DATE', payload: date }),
 *   onHolidaysUpdate: (holidays) => dispatch({ type: 'SET_HOLIDAYS', payload: holidays }),
 *   onBcaChampionshipUpdate: (champ) => dispatch({ type: 'SET_BCA_CHAMPIONSHIP', payload: champ }),
 *   onApaChampionshipUpdate: (champ) => dispatch({ type: 'SET_APA_CHAMPIONSHIP', payload: champ }),
 * });
 * ```
 */
export function useScheduleGeneration(params: UseScheduleGenerationParams) {
  const {
    currentStep,
    isScheduleReviewStep,
    league,
    leagueId,
    loading,
    operatorId,
    existingSeasons,
    bcaDateOptions,
    apaDateOptions,
    savedChampionshipPreferences,
    onScheduleUpdate,
    onSeasonStartDateUpdate,
    onHolidaysUpdate,
    onBcaChampionshipUpdate,
    onApaChampionshipUpdate,
  } = params;

  // Track if schedule has been generated for current step to prevent infinite loops
  const scheduleGeneratedForStep = useRef<number | null>(null);

  useEffect(() => {
    if (!league || !leagueId || loading) return;

    if (isScheduleReviewStep) {
      // Prevent infinite loop - only generate schedule once per step
      if (scheduleGeneratedForStep.current === currentStep) {
        return;
      }

      scheduleGeneratedForStep.current = currentStep;

      // Get form data from localStorage
      const stored = localStorage.getItem(`season-creation-${leagueId}`);
      if (!stored) {
        return;
      }

      const formData: SeasonFormData = JSON.parse(stored);

      // Check if we have a saved complete schedule (from Continue Setup)
      const savedSchedule = localStorage.getItem('season-schedule-review');

      const startDate = parseLocalDate(formData.startDate);
      const seasonLength = parseInt(formData.seasonLength);
      const leagueDayOfWeek = formatDayOfWeek(league.day_of_week);

      let initialSchedule: WeekEntry[];

      if (savedSchedule) {
        // Load saved schedule (from Continue Setup)
        initialSchedule = JSON.parse(savedSchedule);
      } else {
        // Generate fresh schedule
        initialSchedule = generateSchedule(
          startDate,
          leagueDayOfWeek,
          seasonLength
        );
      }

      // Fetch holidays for the season
      const holidays = fetchHolidaysForSeason(startDate, seasonLength);

      // Function to fetch operator's championship preferences and generate schedule with conflicts
      const generateScheduleWithPreferences = async () => {
        // Fetch operator's championship preferences from database to determine if they should be included in conflict detection
        let bcaShouldBeIncluded = !formData.bcaIgnored; // Default to wizard form data
        let apaShouldBeIncluded = !formData.apaIgnored; // Default to wizard form data

        // Fetch preferences using shared function
        const preferences = operatorId ? await getChampionshipPreferences(operatorId) : [];

        if (preferences.length > 0) {
          // Check if operator has set these championships to 'ignore'
          const bcaPref = preferences.find(p => p.organization === 'BCA');
          const apaPref = preferences.find(p => p.organization === 'APA');

          // Only include championships in conflict detection if NOT ignored
          if (bcaPref) {
            bcaShouldBeIncluded = !bcaPref.ignored;
          }
          if (apaPref) {
            apaShouldBeIncluded = !apaPref.ignored;
          }

        }

        // Build championship event objects for conflict detection
        // Only include if operator hasn't set them to 'ignore'
        const bcaChampionshipEvent: ChampionshipEvent | undefined =
          bcaShouldBeIncluded && formData.bcaStartDate && formData.bcaEndDate
            ? { start: formData.bcaStartDate, end: formData.bcaEndDate, ignored: false }
            : undefined;

        const apaChampionshipEvent: ChampionshipEvent | undefined =
          apaShouldBeIncluded && formData.apaStartDate && formData.apaEndDate
            ? { start: formData.apaStartDate, end: formData.apaEndDate, ignored: false }
            : undefined;

        // Detect conflicts using shared utility
        const scheduleWithConflicts = detectScheduleConflicts(
          initialSchedule,
          holidays,
          bcaChampionshipEvent,
          apaChampionshipEvent,
          leagueDayOfWeek
        );

        return { scheduleWithConflicts, bcaChampionshipEvent, apaChampionshipEvent };
      };

      // Execute the async function
      generateScheduleWithPreferences().then(({ scheduleWithConflicts, bcaChampionshipEvent, apaChampionshipEvent }) => {
        // Update state via callbacks
        onScheduleUpdate(scheduleWithConflicts);
        onSeasonStartDateUpdate(formData.startDate);
        onHolidaysUpdate(holidays);

        // Set championship data based on what was actually included in conflict detection
        onBcaChampionshipUpdate(bcaChampionshipEvent);
        onApaChampionshipUpdate(apaChampionshipEvent);
      });
    }
  }, [
    currentStep,
    isScheduleReviewStep,
    league,
    leagueId,
    loading,
    existingSeasons,
    bcaDateOptions,
    apaDateOptions,
    operatorId,
    savedChampionshipPreferences,
    onScheduleUpdate,
    onSeasonStartDateUpdate,
    onHolidaysUpdate,
    onBcaChampionshipUpdate,
    onApaChampionshipUpdate,
  ]);
}
