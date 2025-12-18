/**
 * @fileoverview QuestionStep Component
 * Reusable component for displaying individual survey questions with validation and formatting
 */
import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { CapitalizeInput } from '@/components/ui/capitalize-input';
import { InfoButton } from '../InfoButton';

interface QuestionStepProps {
  title: string;
  subtitle?: string | React.ReactElement;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onNext: (formattedValue?: string) => void;
  onPrevious: () => void;
  onCancel?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onFormat?: (value: string) => string;
  error?: string;
  canGoBack: boolean;
  isLastQuestion: boolean;
  infoTitle?: string;
  infoContent?: React.ReactNode;
  inputType?: 'text' | 'date' | 'email' | 'tel'; // New prop to specify input type
  isSubmitting?: boolean;
  /** Shows loading state during navigation (for lazy loading feedback) */
  isNavigating?: boolean;
  /** Hides the navigation buttons (Previous/Next) when true */
  hideNavigation?: boolean;
}

/**
 * QuestionStep Component
 *
 * Displays a single survey question with:
 * - Input field with validation
 * - Auto-capitalize toggle
 * - Navigation buttons
 * - Optional info popup
 */
export const QuestionStep: React.FC<QuestionStepProps> = ({
  title,
  subtitle,
  placeholder,
  value,
  onChange,
  onNext,
  onPrevious,
  onCancel,
  onKeyDown,
  onFormat,
  error,
  canGoBack,
  isLastQuestion,
  infoTitle,
  infoContent,
  inputType = 'text',
  isSubmitting,
  isNavigating,
  hideNavigation = false
}) => {
  const capitalizeInputRef = useRef<{ getValue: () => string }>(null);

  /**
   * Default formatting function for auto-capitalization
   * Capitalizes first letter of each word
   */
  const defaultFormat = (text: string): string => {
    return text
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
      .trim();
  };

  // Use provided onFormat or default formatting
  const formatFunction = onFormat || defaultFormat;

  const handleNext = () => {
    // For text inputs, get the final value from CapitalizeInput
    // (formatted if auto-capitalize is on, raw if off)
    let finalValue = value;
    if (inputType === 'text' && capitalizeInputRef.current) {
      finalValue = capitalizeInputRef.current.getValue();
      // Update parent state with final value
      if (finalValue !== value) {
        onChange(finalValue);
      }
    }

    // Pass the final value to parent
    onNext(finalValue);
  };

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

        <p className="text-gray-600 mb-6">
          {subtitle}
        </p>

        <div className="space-y-6">
          {inputType === 'date' ? (
            <div>
              <Calendar
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                minDate={new Date().toISOString().split('T')[0]} // Today or future
              />
              {error && (
                <p className="text-red-500 text-sm mt-2">{error}</p>
              )}
            </div>
          ) : inputType === 'text' ? (
            <CapitalizeInput
              ref={capitalizeInputRef}
              value={value}
              onChange={onChange}
              placeholder={placeholder}
              error={!!error}
              errorMessage={error}
              formatFunction={formatFunction}
              defaultCapitalize={true}
            />
          ) : (
            <div>
              <input
                type={inputType}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg ${
                  error ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {error && (
                <p className="text-red-500 text-sm mt-2">{error}</p>
              )}
            </div>
          )}

          {!hideNavigation && (
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
                loadingText={isLastQuestion ? 'Submitting...' : 'Loading...'}
                isLoading={isSubmitting || isNavigating}
                onClick={handleNext}
                disabled={!value.trim() || isSubmitting || isNavigating}
              >
                {isLastQuestion ? 'Continue' : 'Next'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
