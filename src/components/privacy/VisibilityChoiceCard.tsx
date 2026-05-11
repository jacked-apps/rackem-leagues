/**
 * @fileoverview VisibilityChoiceCard Component
 * Reusable card component for displaying contact visibility choices with explanations
 */
import React from 'react';
import type { ContactVisibilityLevel } from '../../schemas/leagueOperatorSchema';

/**
 * Contact visibility option configuration
 */
interface ContactVisibilityOption {
  value: ContactVisibilityLevel;
  label: string;
  description: string;
  icon?: string;
}

/**
 * Color scheme for visibility levels
 */
interface VisibilityColors {
  bg: string;
  border: string;
  text: string;
  accent: string;
}

/**
 * Props for VisibilityChoiceCard component
 */
interface VisibilityChoiceCardProps {
  /** The visibility option data */
  option: ContactVisibilityOption;
  /** Whether this option is currently selected */
  isSelected: boolean;
  /** Color scheme for this visibility level */
  colors: VisibilityColors;
  /** Callback when this option is selected */
  onSelect: (value: ContactVisibilityLevel) => void;
  /** Whether to show the explanation card below the choice */
  showExplanation?: boolean;
}

/**
 * VisibilityChoiceCard Component
 *
 * Reusable component that displays a single contact visibility choice option
 * with optional color-coded explanation card when selected.
 *
 * @param option - The visibility option data (value, label, description, icon)
 * @param isSelected - Whether this option is currently selected
 * @param colors - Color scheme for styling (background, border, text colors)
 * @param onSelect - Callback function when user selects this option
 * @param showExplanation - Whether to show explanation card below the choice
 */
export const VisibilityChoiceCard: React.FC<VisibilityChoiceCardProps> = ({
  option,
  isSelected,
  colors,
  onSelect,
  showExplanation = true
}) => {
  return (
    <div className="space-y-2">
      {/* Choice Option */}
      <div
        className={`p-2 cursor-pointer transition-all duration-200 rounded-md ${
          isSelected ? '' : 'hover:bg-muted'
        }`}
        onClick={() => onSelect(option.value)}
        role="radio"
        aria-checked={isSelected}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(option.value);
          }
        }}
      >
        <div className="flex items-center space-x-3">
          {/* Radio Button */}
          <div className="flex-shrink-0">
            <div
              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                isSelected
                  ? 'border-blue-500 bg-blue-500'
                  : 'border-border bg-card'
              }`}
            >
              {isSelected && (
                <div className="w-2 h-2 rounded-full bg-card"></div>
              )}
            </div>
          </div>

          {/* Icon and Label */}
          <div className="flex items-center space-x-2">
            {option.icon && (
              <span className="text-lg">{option.icon}</span>
            )}
            <span className="font-medium text-foreground">
              {option.label}
            </span>
          </div>
        </div>
      </div>

      {/* Explanation Card - Only show when selected and showExplanation is true */}
      {isSelected && showExplanation && (
        <div className={`ml-7 p-4 rounded-lg border-2 ${colors.bg} ${colors.border} animate-in slide-in-from-top-2 duration-300`}>
          <div className="flex items-start space-x-3">
            {option.icon && (
              <span className="text-2xl">{option.icon}</span>
            )}
            <div className="flex-1">
              <h4 className={`font-semibold ${colors.text} mb-2`}>
                Your Choice: {option.label}
              </h4>
              <p className={`text-sm ${colors.text} leading-relaxed`}>
                {option.description}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};