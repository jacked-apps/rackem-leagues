/**
 * @fileoverview ChoiceStep Component
 * Reusable component for displaying questions with button choices (yes/no, multiple choice)
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { InfoButton } from '../InfoButton';

interface ChoiceOption {
  value: string;
  label: string;
  variant?: 'default' | 'outline' | 'secondary';
}

interface ChoiceStepProps {
  title: string;
  subtitle?: string;
  content?: React.ReactNode;
  choices: ChoiceOption[];
  selectedValue?: string;
  onSelect: (value: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  canGoBack: boolean;
  isLastQuestion: boolean;
  infoTitle?: string;
  infoContent?: React.ReactNode;
  additionalContent?: React.ReactNode;
  error?: string;
  isSubmitting?: boolean;
  /** Shows loading state during navigation (for lazy loading feedback) */
  isNavigating?: boolean;
  /** Hides the navigation buttons (Previous/Next) when true */
  hideNavigation?: boolean;
}

/**
 * ChoiceStep Component
 *
 * Displays a question with button choices instead of text input:
 * - Custom content area (for displaying profile info, etc.)
 * - Button choices (yes/no, multiple choice)
 * - Navigation buttons
 * - Optional info popup
 */
export const ChoiceStep: React.FC<ChoiceStepProps> = ({
  title,
  subtitle,
  content,
  choices,
  selectedValue,
  onSelect,
  onNext,
  onPrevious,
  canGoBack,
  isLastQuestion,
  infoTitle,
  infoContent,
  additionalContent,
  error,
  isSubmitting,
  isNavigating,
  hideNavigation = false
}) => {
  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-2xl font-bold text-gray-900">
            {title}
          </h2>
          {infoTitle && infoContent && (
            <InfoButton title={infoTitle}>
              {infoContent}
            </InfoButton>
          )}
        </div>

        {subtitle && (
          <p className="text-gray-600 mb-6">
            {subtitle}
          </p>
        )}

        {content && (
          <div className="mb-6">
            {content}
          </div>
        )}

        <div className="space-y-6">
          {/* Choice Buttons - Only show if choices exist */}
          {choices.length > 0 && (
            <div className="flex gap-4">
              {choices.map((choice) => {
                const isSelected = selectedValue === choice.value;
                const variant = isSelected ? 'default' : (choice.variant || 'outline');
                return (
                  <Button
                    key={choice.value}
                    variant={variant as 'default' | 'outline' | 'secondary'}
                    loadingText="none"
                    onClick={() => onSelect(choice.value)}
                    className={`px-6 py-3 ${
                      isSelected
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {choice.label}
                  </Button>
                );
              })}
            </div>
          )}

          {/* Additional Content (shown based on selection) */}
          {additionalContent && (
            <div className="mt-6">
              {additionalContent}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <p className="text-red-500 text-sm mt-2">{error}</p>
          )}

          {!hideNavigation && (
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={onPrevious}
                disabled={!canGoBack}
              >
                Previous
              </Button>

              <Button
                loadingText={isLastQuestion ? 'Submitting...' : 'Loading...'}
                isLoading={isSubmitting || isNavigating}
                onClick={onNext}
                disabled={!selectedValue || isSubmitting || isNavigating}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isLastQuestion ? 'Submit Application' : 'Next'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};