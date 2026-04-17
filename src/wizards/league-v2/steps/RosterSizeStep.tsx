/**
 * @fileoverview RosterSizeStep — custom path: max players on the team roster
 *
 * Only shown when the user picks "Custom" on the LeagueFormatStep.
 * Min is dynamic — must be at least the lineup size (read from formData).
 * Max is 12.
 */

import { NumberStepper } from '@/components/wizard';
import type { WizardStepProps } from '@/components/wizard';
import type { LeagueWizardFormData } from '../leagueWizardTypes';

const DEFAULT_ROSTER = 5;

export function RosterSizeStep({
  value,
  onChange,
  formData,
}: WizardStepProps<number | undefined, LeagueWizardFormData>) {
  const lineupSize = formData['lineup-size'] ?? 3;
  const currentValue = value ?? Math.max(DEFAULT_ROSTER, lineupSize);

  return (
    <NumberStepper
      label="What is the maximum roster size?"
      labelInfoButton={{
        title: 'Roster Size',
        content: (
          <p>
            The maximum number of players you can have on your team.
            Must be at least {lineupSize} (your lineup size). Extra
            players beyond the lineup act as substitutes.
          </p>
        ),
      }}
      value={currentValue}
      onChange={onChange}
      min={lineupSize}
      max={12}
    />
  );
}
