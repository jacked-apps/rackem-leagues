/**
 * @fileoverview WizardNavigation — Back / Next / Cancel button bar
 *
 * Extracted from WizardShell to keep files small. Pure presentation:
 * renders the appropriate buttons based on the wizard's current state.
 */

import { Button } from '@/components/ui/button';

interface WizardNavigationProps {
  isFirstStep: boolean;
  isLastStep: boolean;
  /** When true and step is optional, show "Skip" instead of "Next" */
  showSkip?: boolean;
  onBack: () => void;
  onNext: () => void;
  onCancel?: () => void;
}

export function WizardNavigation({
  isFirstStep,
  isLastStep,
  showSkip,
  onBack,
  onNext,
  onCancel,
}: WizardNavigationProps) {
  const nextLabel = isLastStep ? 'Finish' : showSkip ? 'Skip' : 'Next';
  return (
    <div className="flex justify-between pt-4 border-t">
      <div className="flex gap-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {!isFirstStep && (
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
        )}
      </div>
      <Button onClick={onNext} loadingText="none">
        {nextLabel}
      </Button>
    </div>
  );
}
