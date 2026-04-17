/**
 * @fileoverview ReviewStep — generic final confirmation step for any wizard
 *
 * Always the last step. Shows the wizard summary and asks the user to
 * confirm their choices before finishing. This means content steps always
 * show "Next" and only the review step shows "Finish".
 *
 * Reusable across all wizards — just add it as the last step in any config.
 */

import type { WizardStepProps } from './types';

export function ReviewStep<TFormData>(_props: WizardStepProps<unknown, TFormData>) {
  return (
    <div className="space-y-4">
      <p className="text-gray-700">
        Please check that the information below is correct.
      </p>
    </div>
  );
}
