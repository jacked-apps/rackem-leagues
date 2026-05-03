/**
 * @fileoverview ChoiceStep Component
 * Reusable component for displaying questions with button choices (yes/no, multiple choice)
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { InfoButton } from '../components/InfoButton';

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
  error
}) => {
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

        {subtitle && (
          <p className="text-muted-foreground mb-6">
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
              {choices.map((choice) => (
                <Button
                  key={choice.value}
                  variant="outline"
                  onClick={() => onSelect(choice.value)}
                  className={`px-6 py-3 ${
                    selectedValue === choice.value
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'hover:bg-muted'
                  }`}
                >
                  {choice.label}
                </Button>
              ))}
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
              onClick={onNext}
              disabled={!selectedValue}
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