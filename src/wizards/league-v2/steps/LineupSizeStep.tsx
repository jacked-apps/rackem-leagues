/**
 * @fileoverview LineupSizeStep — custom path: how many players play per match
 *
 * Only shown when the user picks "Custom" on the LeagueFormatStep.
 * Uses NumberStepper with min 3, max 6.
 */

import { NumberStepper } from '@/components/wizard';
import type { WizardStepProps } from '@/components/wizard';
import type { LeagueWizardFormData } from '../leagueWizardTypes';

const DEFAULT_LINEUP = 3;

export function LineupSizeStep({
  value,
  onChange,
}: WizardStepProps<number | undefined, LeagueWizardFormData>) {
  return (
    <NumberStepper
      label="How many players play each match night?"
      labelInfoButton={{
        title: 'Lineup Size',
        content: (
          <p>
            The number of players from each team who actually play during
            a match night. Extra roster players act as substitutes.
          </p>
        ),
      }}
      value={value ?? DEFAULT_LINEUP}
      onChange={onChange}
      min={3}
      max={6}
    />
  );
}
