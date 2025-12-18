/**
 * @fileoverview RadioChoiceStep Component
 * Reusable component for displaying questions with radio button choices
 * Uses SimpleRadioChoice for clean, consistent choice selection
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { SimpleRadioChoice } from './SimpleRadioChoice';
import { InfoButton } from '../InfoButton';

interface RadioChoiceOption {
  value: string;
  label: string;
  subtitle?: string;
  description?: string;
  warning?: string;
  icon?: string;
  infoTitle?: string;
  infoContent?: string | React.ReactElement;
}

interface RadioChoiceStepProps {
  title: string;
  subtitle?: string | React.ReactElement;
  choices: RadioChoiceOption[];
  selectedValue?: string;
  onSelect: (value: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  onCancel?: () => void;
  canGoBack: boolean;
  isLastQuestion: boolean;
  infoTitle?: string;
  infoContent?: React.ReactNode;
  infoLabel?: string;
  error?: string;
  isSubmitting?: boolean;
  /** Shows loading state during navigation (for lazy loading feedback) */
  isNavigating?: boolean;
}

/**
 * RadioChoiceStep Component
 *
 * Displays a question with radio button choices using the clean SimpleRadioChoice pattern:
 * - Simple list with radio buttons
 * - Explanation card appears when selection is made
 * - Navigation buttons
 * - Consistent with security choices pattern
 */
export const RadioChoiceStep: React.FC<RadioChoiceStepProps> = ({
  title,
  subtitle,
  choices,
  selectedValue,
  onSelect,
  onNext,
  onPrevious,
  onCancel,
  canGoBack,
  isLastQuestion,
  infoTitle,
  infoContent,
  infoLabel,
  error,
  isSubmitting,
  isNavigating
}) => {
  const canProceed = selectedValue && typeof selectedValue === 'string' && selectedValue.trim() !== '';

  return (
    <div className="bg-white rounded-xl shadow-lg p-4">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-2xl font-bold text-gray-900">
            {title}
          </h2>
          {infoTitle && infoContent && (
            <InfoButton title={infoTitle} label={infoLabel}>
              {infoContent}
            </InfoButton>
          )}
        </div>

        {/* Use the reusable SimpleRadioChoice component */}
        <SimpleRadioChoice
          title=""
          subtitle={subtitle}
          choices={choices}
          selectedValue={selectedValue}
          onSelect={onSelect}
        />

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between items-center">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onPrevious}
              disabled={!canGoBack}
            >
              Previous
            </Button>
            {onCancel && (
              <Button
                variant="outline"
                onClick={onCancel}
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                Cancel
              </Button>
            )}
          </div>

          <Button
            loadingText={isLastQuestion ? 'Creating League...' : 'Loading...'}
            isLoading={isSubmitting || isNavigating}
            onClick={onNext}
            disabled={!canProceed || isSubmitting || isNavigating}
          >
            {isLastQuestion ? 'Create League' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
};