/**
 * @fileoverview League Wizard State Management Hook
 *
 * Custom hook that manages all state for the League Creation Wizard.
 * Handles form data, validation, step navigation, and localStorage persistence.
 */
import { useState, useCallback, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { createWizardSteps, type WizardStep, type LeagueFormData } from '@/data/leagueWizardSteps.simple';
import { parseLocalDate } from '@/utils/formatters';

interface UseLeagueWizardParams {
  /** Callback when wizard is completed */
  onSubmit: () => void;
  /** Organization preferences for pre-filling defaults */
  orgPreferences?: {
    team_format: string | null;
    handicap_variant: string | null;
  } | null;
}

/**
 * League Wizard State Hook (Simplified)
 *
 * Provides centralized state management for the league creation wizard:
 * - Form data with localStorage persistence (core league identity only)
 * - Current step tracking
 * - Input and error state
 * - Validation functions
 * - Navigation handlers
 *
 * NOTE: Season length, tournament scheduling, and venues moved to separate wizards
 */
export const useLeagueWizard = ({ onSubmit, orgPreferences }: UseLeagueWizardParams) => {
  // Wizard step state with localStorage persistence
  const [currentStep, setCurrentStep] = useLocalStorage('league-wizard-step', 0);
  const [currentInput, setCurrentInput] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  // League form data with localStorage persistence (simplified)
  const [formData, setFormData] = useLocalStorage<LeagueFormData>('league-creation-wizard', {
    gameType: '',
    startDate: '',
    dayOfWeek: '',
    season: '',
    year: 0,
    qualifier: '',
    teamFormat: '',
    handicapSystem: '',
    handicapVariant: '',
    teamHandicapVariant: '',
  });

  /**
   * Update form data for a specific field
   */
  const updateFormData = (field: keyof LeagueFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  /**
   * Initialize form data with org preferences when they load
   * This ensures pre-selected values are saved to formData
   */
  useEffect(() => {
    if (!orgPreferences) return;

    // Only initialize if formData is still empty (first load)
    if (!formData.teamFormat && orgPreferences.team_format) {
      const handicapSystem = orgPreferences.team_format === '5_man' ? ('custom_5man' as const) : ('bca_standard' as const);
      setFormData(prev => ({
        ...prev,
        teamFormat: orgPreferences.team_format as '5_man' | '8_man',
        handicapSystem: handicapSystem,
      }));
    }

    if (!formData.handicapVariant && orgPreferences.handicap_variant) {
      setFormData(prev => ({
        ...prev,
        handicapVariant: orgPreferences.handicap_variant as 'standard' | 'reduced' | 'none',
        teamHandicapVariant: orgPreferences.handicap_variant as 'standard' | 'reduced' | 'none',
      }));
    }
  }, [orgPreferences]); // Only run when orgPreferences changes

  /**
   * Start date validation - must be a valid future date
   */
  const validateStartDate = (value: string): { isValid: boolean; error?: string } => {
    if (!value) {
      return { isValid: false, error: 'Start date is required' };
    }

    // Use parseLocalDate to handle timezone correctly
    const date = parseLocalDate(value);
    if (isNaN(date.getTime())) {
      return { isValid: false, error: 'Please enter a valid date' };
    }

    // Get today's date in local timezone at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (date < today) {
      return { isValid: false, error: 'Start date must be today or in the future' };
    }

    return { isValid: true };
  };

  /**
   * Clear all form data and reset wizard
   */
  const clearFormData = () => {
    localStorage.removeItem('league-creation-wizard');
    localStorage.removeItem('league-wizard-step');
  };

  /**
   * Create wizard steps with current form data and functions
   */
  const steps: WizardStep[] = createWizardSteps({
    formData,
    updateFormData,
    validateStartDate,
    orgPreferences,
  });

  /**
   * Get current step
   */
  const getCurrentStep = useCallback((): WizardStep => {
    return steps[currentStep];
  }, [currentStep, steps]);

  /**
   * Handle input changes with validation
   */
  const handleInputChange = useCallback((value: string) => {
    setCurrentInput(value);
    setError(undefined); // Clear error when user types
  }, []);

  /**
   * Handle choice selection
   */
  const handleChoiceSelect = useCallback((choiceId: string) => {
    const step = getCurrentStep();
    step.setValue(choiceId);
    setError(undefined);
  }, [getCurrentStep]);

  /**
   * Save current input to form data
   * @param valueToSave - Optional formatted value to save (e.g., from CapitalizeInput)
   */
  const saveCurrentInput = useCallback((valueToSave?: string): boolean => {
    const step = getCurrentStep();
    const finalValue = valueToSave ?? currentInput;

    if (step.validator) {
      const validation = step.validator(finalValue);
      if (!validation.isValid) {
        setError(validation.error || 'Invalid input');
        return false;
      }
    }

    step.setValue(finalValue);
    setCurrentInput('');
    return true;
  }, [getCurrentStep, currentInput]);

  /**
   * Navigate to next step (simplified - no conditional steps)
   * @param formattedValue - Optional formatted value from input component (e.g., CapitalizeInput)
   */
  const handleNext = useCallback((formattedValue?: string) => {
    const step = getCurrentStep();

    // For input steps, validate before proceeding
    if (step.type === 'input') {
      if (!saveCurrentInput(formattedValue)) return;
    }

    // For choice steps, ensure selection was made
    if (step.type === 'choice' && !step.getValue()) {
      setError('Please make a selection to continue');
      return;
    }

    // Simple linear navigation
    const nextStep = currentStep + 1;

    if (nextStep < steps.length) {
      setCurrentStep(nextStep);
      setCurrentInput('');
      setError(undefined);
      // Scroll to top so user sees the new question
      window.scrollTo(0, 0);
    } else {
      onSubmit();
    }
  }, [getCurrentStep, saveCurrentInput, currentStep, steps.length, onSubmit]);

  /**
   * Navigate to previous step (simplified)
   */
  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setCurrentInput('');
      setError(undefined);
      // Scroll to top so user sees the question
      window.scrollTo(0, 0);
    }
  }, [currentStep]);

  return {
    // State
    currentStep,
    currentInput,
    error,
    formData,
    steps,

    // State setters
    setCurrentInput,

    // Form data management
    updateFormData,

    // Validation functions
    validateStartDate,

    // Step navigation and handlers
    getCurrentStep,
    handleInputChange,
    handleChoiceSelect,
    handleNext,
    handlePrevious,

    // Utility functions
    clearFormData
  };
};
