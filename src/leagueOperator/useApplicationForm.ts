/**
 * @fileoverview Custom Hook for League Operator Application Form
 * Centralizes all form state management and business logic
 */
import { useReducer, useState } from 'react';
import { applicationReducer, getInitialApplicationState } from './applicationReducer';
import { getQuestionDefinitions } from './questionDefinitions';
import { useUserProfile } from '@/api/hooks';
import { logger } from '@/utils/logger';

/**
 * Custom hook for managing league operator application form state
 *
 * Encapsulates all form-related state, navigation logic, and question configuration.
 * This hook centralizes complex state management to keep components clean and focused.
 *
 * @returns Object containing all form state and handlers
 */
export const useApplicationForm = () => {
  // Get user profile data for address pre-filling
  const { member } = useUserProfile();

  // Main form state using reducer for complex state updates
  // Load fresh state from localStorage on every mount
  const [state, dispatch] = useReducer(applicationReducer, getInitialApplicationState());

  // Navigation state - tracks which question user is currently on
  // Load saved step from localStorage or start at 0
  const [currentStep, setCurrentStep] = useState(() => {
    try {
      const savedStep = localStorage.getItem('leagueOperatorApplication_currentStep');
      return savedStep ? parseInt(savedStep, 10) : 0;
    } catch {
      return 0;
    }
  });

  // Current input value - what user is typing before hitting Enter/Next
  const [currentInput, setCurrentInput] = useState('');

  // Error state for validation feedback
  const [error, setError] = useState<string>('');

  // Custom address input states (when user chooses not to use profile address)
  const [customAddress, setCustomAddress] = useState('');
  const [customCity, setCustomCity] = useState('');
  const [customState, setCustomState] = useState('');
  const [customZip, setCustomZip] = useState('');


  // Modal visibility states for security disclaimer and setup guide
  const [showSecurityDisclaimer, setShowSecurityDisclaimer] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  // Generate question configurations with current state and handlers
  const questions = getQuestionDefinitions(
    state,
    dispatch,
    member,
    customAddress,
    setCustomAddress,
    customCity,
    setCustomCity,
    customState,
    setCustomState,
    customZip,
    setCustomZip,
    setShowSecurityDisclaimer,
    setShowSetupGuide
  );

  // Get current question based on step index
  const currentQuestion = questions[currentStep];

  /**
   * Navigate to the next question in the survey
   * Includes validation before allowing progression
   */
  const handleNext = () => {
    if (currentStep < questions.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      // Save current step to localStorage
      try {
        localStorage.setItem('leagueOperatorApplication_currentStep', nextStep.toString());
      } catch (error) {
        logger.warn('Failed to save current step', { error, step: nextStep });
      }
      setCurrentInput(''); // Clear input for next question
      setError(''); // Clear any previous errors
      // Scroll to top so user sees the new question
      window.scrollTo(0, 0);
    }
  };

  /**
   * Navigate to the previous question in the survey
   */
  const handlePrevious = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      // Save current step to localStorage
      try {
        localStorage.setItem('leagueOperatorApplication_currentStep', prevStep.toString());
      } catch (error) {
        logger.warn('Failed to save current step', { error, step: prevStep });
      }
      setCurrentInput(''); // Clear input when going back
      setError(''); // Clear any errors
      // Scroll to top so user sees the question
      window.scrollTo(0, 0);
    }
  };

  /**
   * Handle input changes for text-based questions
   * Updates current input state and validates in real-time
   */
  const handleInputChange = (value: string) => {
    setCurrentInput(value);
    setError(''); // Clear errors as user types
  };

  /**
   * Handle choice selection for choice-based questions
   * Directly updates the application state
   */
  const handleChoiceSelect = (value: string) => {
    if (currentQuestion.setValue) {
      currentQuestion.setValue(value);
      setError(''); // Clear any errors
    }
  };

  /**
   * Format and validate current input, then save to state
   * Called when user hits Enter or clicks Next
   *
   * @param preFormattedValue - Optional value already formatted by QuestionStep (respects autoCapitalize checkbox)
   */
  const handleSaveCurrentInput = (preFormattedValue?: string) => {
    if (!currentQuestion.setValue) return;

    try {
      // Use pre-formatted value if provided (from QuestionStep with autoCapitalize handling)
      // Otherwise apply formatter if available
      const formattedValue = preFormattedValue !== undefined
        ? preFormattedValue
        : currentQuestion.formatter
        ? currentQuestion.formatter(currentInput)
        : currentInput;

      // Validate if validator is available
      if (currentQuestion.validator) {
        const validation = currentQuestion.validator(formattedValue);
        if (!validation.isValid) {
          setError(validation.error || 'Invalid input');
          return false;
        }
      }

      // Save to state
      currentQuestion.setValue(formattedValue);
      setCurrentInput(''); // Clear input after saving
      setError(''); // Clear any errors
      return true;
    } catch (validationError) {
      setError('Please enter a valid value');
      return false;
    }
  };

  return {
    // Application state
    state,
    dispatch,

    // Navigation state
    currentStep,
    currentQuestion,
    questions,
    isLastQuestion: currentStep === questions.length - 1,
    canGoBack: currentStep > 0,

    // Input state
    currentInput,
    error,

    // Custom address states
    customAddress,
    setCustomAddress,
    customCity,
    setCustomCity,
    customState,
    setCustomState,
    customZip,
    setCustomZip,

    // Modal states
    showSecurityDisclaimer,
    setShowSecurityDisclaimer,
    showSetupGuide,
    setShowSetupGuide,

    // Navigation handlers
    handleNext,
    handlePrevious,

    // Input handlers
    handleInputChange,
    handleChoiceSelect,
    handleSaveCurrentInput,

    // Utility functions
    setError,
    setCurrentInput,
  };
};