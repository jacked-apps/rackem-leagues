/**
 * @fileoverview QuestionStep Component
 * Reusable component for displaying individual survey questions with validation and formatting
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { InfoButton } from '../components/InfoButton';

interface QuestionStepProps {
  title: string;
  subtitle?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onNext: (formattedValue?: string) => void;
  onPrevious: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onFormat?: (value: string) => string;
  validator?: (value: string) => { isValid: boolean; error?: string };
  error?: string;
  canGoBack: boolean;
  isLastQuestion: boolean;
  infoTitle?: string;
  infoContent?: React.ReactNode;
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
  onKeyDown,
  onFormat,
  validator,
  error,
  canGoBack,
  isLastQuestion,
  infoTitle,
  infoContent
}) => {
  const [autoCapitalize, setAutoCapitalize] = useState(true);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Use external onKeyDown if provided, otherwise handle locally
    if (onKeyDown) {
      onKeyDown(e);
      return;
    }

    // Format when user presses Enter (if auto-capitalize is enabled)
    if (e.key === 'Enter' && autoCapitalize && onFormat) {
      const formatted = onFormat(value);
      onChange(formatted);
    }
  };

  const handleNext = () => {
    // Format before validation if auto-capitalize is enabled
    let valueToValidate = value;
    if (autoCapitalize && onFormat) {
      valueToValidate = onFormat(value);
      onChange(valueToValidate);
    }

    // Validate and proceed (if validator provided)
    if (validator) {
      const validation = validator(valueToValidate);
      if (validation.isValid) {
        onNext(valueToValidate);
      }
    } else {
      onNext(valueToValidate);
    }
  };

  return (
    <div className="bg-card rounded-xl shadow-lg p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-2xl font-bold text-foreground">
            {title}
          </h2>
          {infoTitle && infoContent && (
            <InfoButton title={infoTitle}>
              {infoContent}
            </InfoButton>
          )}
        </div>

        <p className="text-muted-foreground mb-6">
          {subtitle}
        </p>

        <div className="space-y-6">
          <div>
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg ${
                error ? 'border-red-500' : 'border-border'
              }`}
            />
            {error && (
              <p className="text-red-500 text-sm mt-2">{error}</p>
            )}
          </div>

          {/* Auto-Capitalize Toggle */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="autoCapitalize"
              checked={autoCapitalize}
              onChange={(e) => setAutoCapitalize(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-muted border-border rounded focus:ring-blue-500"
            />
            <label htmlFor="autoCapitalize" className="text-sm text-foreground">
              {autoCapitalize
                ? "Auto-capitalize (press Enter to format)"
                : "Auto-format off (text will appear exactly as entered)"
              }
            </label>
          </div>

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={onPrevious}
              disabled={!canGoBack}
            >
              Previous
            </Button>

            <Button
              loadingText="none"
              onClick={handleNext}
              disabled={!value || (typeof value === 'string' && !value.trim())}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isLastQuestion ? 'Continue' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};