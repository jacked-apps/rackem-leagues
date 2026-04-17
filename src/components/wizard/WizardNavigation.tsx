/**
 * @fileoverview WizardNavigation — Back / Next / Cancel button bar
 *
 * Extracted from WizardShell to keep files small. Pure presentation:
 * renders the appropriate buttons based on the wizard's current state.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface WizardNavigationProps {
  isFirstStep: boolean;
  isLastStep: boolean;
  /** When true and step is optional, show "Skip" instead of "Next" */
  showSkip?: boolean;
  /** When true, suppress the Back button even when not on the first step */
  hideBack?: boolean;
  /** When true, suppress the Cancel / "Finish Later" button */
  hideCancel?: boolean;
  onBack: () => void;
  onNext: () => void;
  onCancel?: () => void;
}

export function WizardNavigation({
  isFirstStep,
  isLastStep,
  showSkip,
  hideBack,
  hideCancel,
  onBack,
  onNext,
  onCancel,
}: WizardNavigationProps) {
  const nextLabel = isLastStep ? 'Finish' : showSkip ? 'Skip' : 'Next';
  const showBack = !isFirstStep && !hideBack;
  const showCancel = onCancel && !hideCancel;

  // Track pending state locally so the Next button disables itself while the
  // async onNext chain (validation → confirm dialog → stage handler → DB) is
  // still resolving. Prevents double-click from firing duplicate writes.
  const [pending, setPending] = useState(false);
  const handleNextClick = async () => {
    if (pending) return;
    setPending(true);
    try {
      await onNext();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex justify-between pt-4 border-t">
      <div className="flex gap-2">
        {showCancel && (
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        )}
        {showBack && (
          <Button variant="outline" onClick={onBack} disabled={pending}>
            Back
          </Button>
        )}
      </div>
      <Button
        onClick={handleNextClick}
        disabled={pending}
        isLoading={pending}
        loadingText="Saving..."
      >
        {nextLabel}
      </Button>
    </div>
  );
}
