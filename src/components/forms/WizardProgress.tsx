/**
 * @fileoverview WizardProgress Component
 * Reusable progress indicator for multi-step wizards
 * Shows step counter and visual progress bar
 */
import React from 'react';

interface WizardProgressProps {
  currentStep: number;
  totalSteps: number;
  stepLabel?: string; // Optional custom label (defaults to "Step")
  showStepCounter?: boolean; // Show "Step X of Y" text (default: true)
  showProgressBar?: boolean; // Show visual progress bar (default: true)
  progressBarColor?: string; // Custom progress bar color (default: blue-600)
  className?: string; // Additional CSS classes for container
}

/**
 * WizardProgress Component
 *
 * Displays step counter and progress bar for multi-step wizards.
 * Automatically calculates percentage based on current step and total steps.
 */
export const WizardProgress: React.FC<WizardProgressProps> = ({
  currentStep,
  totalSteps,
  stepLabel = 'Step',
  showStepCounter = true,
  showProgressBar = true,
  progressBarColor = 'bg-blue-600',
  className = ''
}) => {
  // Calculate progress percentage (currentStep is 0-indexed, so add 1)
  const progressPercentage = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Step Counter */}
      {showStepCounter && (
        <div className="text-center">
          <p className="text-muted-foreground">
            {stepLabel} {currentStep + 1} of {totalSteps}
          </p>
        </div>
      )}

      {/* Progress Bar */}
      {showProgressBar && (
        <div className="w-full bg-accent rounded-full h-2">
          <div
            className={`${progressBarColor} h-2 rounded-full transition-all duration-300`}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Utility function to calculate progress percentage
 * @param currentStep - Current step (0-indexed)
 * @param totalSteps - Total number of steps
 * @returns Progress percentage (0-100)
 */
export const calculateProgress = (currentStep: number, totalSteps: number): number => {
  return ((currentStep + 1) / totalSteps) * 100;
};