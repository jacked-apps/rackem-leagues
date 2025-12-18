/**
 * @fileoverview League Operator Application Form - Main Component
 *
 * This is the main orchestrator component for the league operator application.
 * It's been heavily refactored to be clean and focused on just rendering
 * and coordinating between smaller, specialized components.
 *
 * COMPONENT STRUCTURE:
 * 1. Uses custom hook (useApplicationForm) for ALL state management
 * 2. Renders appropriate question component based on current step
 * 3. Shows live preview of application data
 * 4. Handles modal overlays for disclaimers and guides
 *
 * STATE MANAGEMENT:
 * - All complex state logic moved to useApplicationForm hook
 * - Question definitions moved to questionDefinitions.tsx
 * - Form reducer logic moved to applicationReducer.ts
 * - Modal components extracted to separate files
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QuestionStep } from '@/components/forms/QuestionStep';
import { ChoiceStep } from '@/components/forms/ChoiceStep';
import { ApplicationPreview } from '@/components/previews/ApplicationPreview';
import { Button } from '@/components/ui/button';
import { SecurityDisclaimerModal } from '@/components/modals/SecurityDisclaimerModal';
import { SetupGuideModal } from '@/components/modals/SetupGuideModal';
import { PageHeader } from '@/components/PageHeader';
import { useApplicationForm } from './useApplicationForm';
import { useUserProfile } from '@/api/hooks';
import { useCreateOrganization } from '@/api/hooks/useOrganizationMutations';
import { useUpdateMemberRole } from '@/api/hooks/useMemberMutations';
import { generateMockPaymentData } from '@/types/operator';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';

/**
 * League Operator Application Form Component
 *
 * Main entry point for the league operator onboarding survey.
 * Presents questions one at a time with dynamic preview and navigation.
 *
 * FLOW:
 * 1. Organization name input
 * 2. Address selection (profile vs custom)
 * 3. Contact information disclaimer and setup
 * 4. [Future] Venue information
 * 5. [Future] Contact method selection
 */
export const LeagueOperatorApplication: React.FC = () => {
  // Navigation hook for redirecting after completion
  const navigate = useNavigate();

  // Scroll to top on mount (fixes issue where page loads in middle)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Track submission state to prevent double-clicks
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get member profile data for pre-filling operator info
  const { member, refreshProfile } = useUserProfile();

  // TanStack Query mutations for creating organization and updating member role
  const createOrganization = useCreateOrganization();
  const updateMemberRole = useUpdateMemberRole();

  // Get all form state and handlers from custom hook
  const {
    // Application data
    state,

    // Current question navigation
    currentStep,
    currentQuestion,
    questions,
    isLastQuestion,
    canGoBack,

    // Input handling
    currentInput,
    error,
    handleInputChange,
    handleChoiceSelect,
    handleSaveCurrentInput,

    // Navigation
    handleNext,
    handlePrevious,

    // Modal states and controls
    showSecurityDisclaimer,
    setShowSecurityDisclaimer,
    showSetupGuide,
    setShowSetupGuide,

    // Utility functions
    setCurrentInput,
  } = useApplicationForm();

  /**
   * Sync input field with current question's value when navigating
   * This ensures the input shows the saved value when user goes back to a question
   * Only runs when the step changes, not on every render
   */
  useEffect(() => {
    if (currentQuestion?.getValue && currentQuestion.type !== 'choice') {
      const savedValue = currentQuestion.getValue();
      // Only set if we actually have a saved value, otherwise let user type freely
      if (savedValue) {
        setCurrentInput(savedValue);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]); // Only depend on currentStep - currentQuestion changes with currentStep, setCurrentInput is stable

  /**
   * Handle Enter key press in input fields
   * Saves current input and moves to next question if valid
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const success = handleSaveCurrentInput();
      if (success) {
        handleNext();
      }
    }
  };

  /**
   * Handle form submission (when user clicks Continue on last question)
   * 1. Creates organization record (via TanStack Query mutation)
   * 2. Creates organization_staff record (owner position - automatic via DB trigger)
   * 3. Upgrades user role from 'player' to 'league_operator' (via TanStack Query mutation)
   * 4. Clears form state
   * 5. Redirects to congratulations page
   */
  const handleSubmit = async () => {
    // Prevent double submission
    if (isSubmitting) return;

    if (!member) {
      logger.error('Cannot submit: No member profile found');
      return;
    }

    // Disable button immediately to prevent multiple clicks
    setIsSubmitting(true);

    try {
      // Generate mock payment data for testing
      const mockPayment = generateMockPaymentData();

      // Step 1: Create organization using TanStack Query mutation
      await createOrganization.mutateAsync({
        organization_name: state.leagueName,
        created_by: member.id,

        // Address - copy from member profile or custom
        organization_address: state.useProfileAddress ? (member.address ?? '') : state.organizationAddress || '',
        organization_city: state.useProfileAddress ? member.city : state.organizationCity || '',
        organization_state: state.useProfileAddress ? member.state : state.organizationState || '',
        organization_zip_code: state.useProfileAddress ? (member.zip_code ?? '') : state.organizationZipCode || '',

        // Contact information
        organization_email: state.useProfileEmail ? (member.email ?? '') : state.leagueEmail || '',
        organization_phone: state.useProfilePhone ? (member.phone ?? '') : state.leaguePhone || '',

        // Payment - use mock data for testing
        stripe_customer_id: mockPayment.stripe_customer_id,
        payment_method_id: mockPayment.payment_method_id,
        card_last4: mockPayment.card_last4,
        card_brand: mockPayment.card_brand,
        expiry_month: mockPayment.expiry_month,
        expiry_year: mockPayment.expiry_year,
        billing_zip: mockPayment.billing_zip,
      });

      // Step 2: Organization_staff record is automatically created by database trigger
      // (create_owner_staff_trigger adds the creator as owner)

      // Step 3: Update member role to league_operator using TanStack Query mutation
      await updateMemberRole.mutateAsync({
        memberId: member.id,
        role: 'league_operator',
      });

      // Refresh the user profile context so the new role is immediately available
      refreshProfile();
    } catch (error) {
      // Handle any errors from the mutations
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to submit application', { error: errorMessage });
      toast.error(`Failed to submit application: ${errorMessage}`);
      setIsSubmitting(false);
      return;
    }

    // Wait a moment for the profile to refresh before navigating
    await new Promise(resolve => setTimeout(resolve, 500));

    // Clear saved progress since form is submitted
    try {
      localStorage.removeItem('leagueOperatorApplication');
      localStorage.removeItem('leagueOperatorApplication_currentStep');
    } catch (error) {
      logger.warn('Failed to clear saved progress', { error: error instanceof Error ? error.message : String(error) });
    }

    // Navigate to congratulations page for new league operators
    navigate('/operator-welcome');
  };

  /**
   * Handle Next button click
   * For input questions: saves current input first, then navigates
   * For choice questions: just navigates (choice is already saved)
   * For last question: submits the application
   *
   * @param formattedValue - Optional pre-formatted value from QuestionStep (respects autoCapitalize checkbox)
   */
  const handleContinue = (formattedValue?: string) => {
    if (isLastQuestion) {
      handleSubmit();
      return;
    }

    // For input questions, save current input before proceeding
    if (currentQuestion.type !== 'choice') {
      const success = handleSaveCurrentInput(formattedValue);
      if (!success) return; // Don't proceed if validation failed
    }

    handleNext();
  };

  // Show loading state if no current question is available
  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading application form...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header with escape route */}
      <PageHeader
        backLabel="Exit Application"
        onBackClick={() => {
          // Clear saved progress when user exits
          try {
            localStorage.removeItem('leagueOperatorApplication');
            localStorage.removeItem('leagueOperatorApplication_currentStep');
          } catch (error) {
            logger.warn('Failed to clear saved progress on exit', { error: error instanceof Error ? error.message : String(error) });
          }
          navigate('/dashboard');
        }}
        title="Become a League Operator"
        subtitle={`Step ${currentStep + 1} of ${questions.length}`}
      />

      <div className="container mx-auto px-4 max-w-6xl py-8">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Question Area (2/3 width on large screens) */}
          <div className="lg:col-span-2">
            {/* Render appropriate question component based on type */}
            {currentQuestion.type === 'choice' ? (
              <ChoiceStep
                title={currentQuestion.title}
                subtitle={currentQuestion.subtitle}
                content={currentQuestion.content}
                choices={currentQuestion.choices || []}
                selectedValue={currentQuestion.getValue()}
                onSelect={handleChoiceSelect}
                onNext={handleContinue}
                onPrevious={handlePrevious}
                canGoBack={canGoBack}
                isLastQuestion={isLastQuestion}
                infoTitle={currentQuestion.infoTitle}
                infoContent={currentQuestion.infoContent}
                additionalContent={currentQuestion.additionalContent}
                error={error}
                isSubmitting={isSubmitting}
                hideNavigation={true}
              />
            ) : (
              <QuestionStep
                title={currentQuestion.title}
                subtitle={currentQuestion.subtitle || ''}
                placeholder={currentQuestion.placeholder || ''}
                value={currentInput}
                onChange={handleInputChange}
                onNext={handleContinue}
                onPrevious={handlePrevious}
                onKeyDown={handleKeyDown}
                onFormat={currentQuestion.formatter || undefined}
                error={error}
                canGoBack={canGoBack}
                isLastQuestion={isLastQuestion}
                infoTitle={currentQuestion.infoTitle}
                infoContent={currentQuestion.infoContent}
                isSubmitting={isSubmitting}
                hideNavigation={true}
              />
            )}
          </div>

          {/* Live Preview Panel (1/3 width on large screens) */}
          <div className="lg:col-span-1">
            <ApplicationPreview
              applicationData={state}
            />
          </div>
        </div>

        {/* Navigation Buttons - Below the grid */}
        <div className="flex justify-between items-center mt-8">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={!canGoBack}
          >
            Previous
          </Button>

          <Button
            loadingText={isLastQuestion ? 'Creating...' : 'Loading...'}
            isLoading={isSubmitting}
            onClick={() => handleContinue()}
            disabled={
              isSubmitting ||
              (currentQuestion.type === 'choice' && !currentQuestion.getValue()) ||
              (currentQuestion.type !== 'choice' && !currentInput.trim())
            }
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLastQuestion ? 'Create Organization' : 'Next'}
          </Button>
        </div>
      </div>

      {/* Modal Overlays */}

      {/* Security Warning Modal */}
      {/* TODO: Have a lawyer review this disclaimer to ensure it's legally enforceable and provides adequate protection */}
      <SecurityDisclaimerModal
        isOpen={showSecurityDisclaimer}
        onClose={() => setShowSecurityDisclaimer(false)}
      />

      {/* Professional Setup Guide Modal */}
      <SetupGuideModal
        isOpen={showSetupGuide}
        onClose={() => setShowSetupGuide(false)}
      />
    </div>
  );
};