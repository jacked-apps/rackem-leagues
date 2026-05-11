/**
 * @fileoverview League-wizard Review step (Phase 4 Unit 4.2 of the
 * modular-league-system v2 plan).
 *
 * Wraps the generic ReviewStep with combo-coherence findings rendered
 * inline. Errors render as destructive Alerts and block Save (the
 * wizard shell's Finish button consults `errors` from this step's
 * validate function — see leagueWizardConfig). Warnings render as
 * yellow Alerts and allow Save.
 *
 * The validator is pure (`evaluateCombo`); this component is the UI
 * surface for it.
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { WizardStepProps } from '@/components/wizard';
import { evaluateCombo } from '../comboCoherence';
import type { LeagueWizardFormData } from '../leagueWizardTypes';

export function ReviewStep({
  formData,
}: WizardStepProps<unknown, LeagueWizardFormData>) {
  const { errors, warnings } = evaluateCombo(formData);
  const isClean = errors.length === 0 && warnings.length === 0;

  return (
    <div className="space-y-4">
      <p className="text-gray-700">
        Please check that the information below is correct.
      </p>

      {errors.map((finding) => (
        <Alert key={finding.code} variant="destructive">
          <AlertTitle>This combination won't work</AlertTitle>
          <AlertDescription>{finding.message}</AlertDescription>
        </Alert>
      ))}

      {warnings.map((finding) => (
        <Alert key={finding.code} variant="warning">
          <AlertTitle>Heads up</AlertTitle>
          <AlertDescription>{finding.message}</AlertDescription>
        </Alert>
      ))}

      {isClean && formData['league-format'] === 'custom' && (
        <Alert>
          <AlertTitle>Looks good</AlertTitle>
          <AlertDescription>
            This combination matches a Tested Preset configuration.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
