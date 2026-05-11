/**
 * @fileoverview SimpleRadioChoice Component
 * Clean, reusable radio button component that follows the security choices pattern
 * Simple list view with explanation card that appears when selection is made
 */
import React from 'react';
import { Card } from '@/components/ui/card';
import { InfoButton } from '../InfoButton';

interface SimpleChoiceOption {
  value: string;
  label: string;
  subtitle?: string;
  description?: string;
  warning?: string;
  icon?: string;
  infoTitle?: string;
  infoContent?: string | React.ReactElement;
}

interface SimpleRadioChoiceProps {
  title: string;
  subtitle?: string | React.ReactElement;
  choices: SimpleChoiceOption[];
  selectedValue?: string;
  onSelect: (value: string) => void;
  infoTitle?: string;
  infoContent?: React.ReactNode;
  infoLabel?: string;
}

/**
 * SimpleRadioChoice Component
 *
 * Clean radio choice component that shows:
 * 1. Simple list of radio options with icons and subtitles
 * 2. Explanation card appears below when selection is made
 * 3. Follows the same pattern as security/privacy choices
 */
export const SimpleRadioChoice: React.FC<SimpleRadioChoiceProps> = ({
  title,
  subtitle,
  choices,
  selectedValue,
  onSelect,
  infoTitle,
  infoContent,
  infoLabel
}) => {

  return (
    <div className="space-y-4">
      {/* Title and Info */}
      {(title || (infoTitle && infoContent)) && (
        <div className="flex items-center gap-3 mb-6">
          {title && (
            <h3 className="text-lg font-semibold text-foreground">
              {title}
            </h3>
          )}
          {infoTitle && infoContent && (
            <InfoButton title={infoTitle} label={infoLabel}>
              {infoContent}
            </InfoButton>
          )}
        </div>
      )}

      {subtitle && (
        <p className="text-muted-foreground mb-6">
          {subtitle}
        </p>
      )}

      {/* Simple Choice List */}
      <div className="space-y-6 mb-6">
        {choices.map((choice) => (
          <div key={choice.value} className="space-y-2">
            {/* Prominent info button above choice */}
            {choice.infoTitle && choice.infoContent && (
              <div className="flex items-center gap-2 px-1">
                <InfoButton title={choice.infoTitle}>
                  {choice.infoContent}
                </InfoButton>
                <span className="text-sm font-medium text-foreground">
                  {choice.label} Explanation
                </span>
              </div>
            )}

            {selectedValue === choice.value ? (
              // Selected: Show as card with blue background
              <Card
                className="border-blue-500 bg-blue-50 cursor-pointer transition-all duration-200"
                onClick={() => onSelect(choice.value)}
                role="radio"
                aria-checked={true}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(choice.value);
                  }
                }}
              >
                <div className="p-3">
                  <div className="flex items-center space-x-3">
                    {/* Radio Button - Selected */}
                    <div className="flex-shrink-0">
                      <div className="w-4 h-4 rounded-full border-2 border-blue-500 bg-blue-500 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-card"></div>
                      </div>
                    </div>

                    {/* Icon (if provided) */}
                    {choice.icon && (
                      <span className="text-lg">{choice.icon}</span>
                    )}

                    {/* Choice Label and Subtitle */}
                    <div className="flex items-center space-x-2 flex-1">
                      <span className="text-foreground font-medium">{choice.label}</span>
                      {choice.subtitle && (
                        <span className="text-sm text-blue-600 font-medium">
                          {choice.subtitle}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Explanation appears inside the selected card */}
                  {(choice.description || choice.warning) && (
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      {choice.description && (
                        <p className="text-blue-800 text-sm mb-2">
                          {choice.description}
                        </p>
                      )}
                      {choice.warning && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2">
                          <p className="text-yellow-800 text-sm font-medium">
                            ⚠️ {choice.warning}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            ) : (
              // Unselected: Plain text, no card
              <div
                className="p-3 cursor-pointer transition-all duration-200 rounded-md hover:bg-muted"
                onClick={() => onSelect(choice.value)}
                role="radio"
                aria-checked={false}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(choice.value);
                  }
                }}
              >
                <div className="flex items-center space-x-3">
                  {/* Radio Button - Unselected */}
                  <div className="flex-shrink-0">
                    <div className="w-4 h-4 rounded-full border-2 border-border bg-card flex items-center justify-center">
                    </div>
                  </div>

                  {/* Icon (if provided) */}
                  {choice.icon && (
                    <span className="text-lg">{choice.icon}</span>
                  )}

                  {/* Choice Label and Subtitle */}
                  <div className="flex items-center space-x-2 flex-1">
                    <span className="text-foreground font-medium">{choice.label}</span>
                    {choice.subtitle && (
                      <span className="text-sm text-blue-600 font-medium">
                        {choice.subtitle}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};