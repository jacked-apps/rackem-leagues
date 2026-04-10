/**
 * @fileoverview MatchFormatStep — custom path: how games are structured
 *
 * Only shown when the user picks "Custom" on the LeagueFormatStep.
 * Offers single round robin, double round robin, and individual races
 * (coming soon).
 */

import { CardSelector } from '@/components/wizard';
import type { SelectableCardOption } from '@/components/wizard';
import type { WizardStepProps } from '@/components/wizard';
import type { LeagueWizardFormData } from '../leagueWizardTypes';

const MATCH_FORMAT_OPTIONS: SelectableCardOption<string>[] = [
  {
    value: 'double_round_robin',
    title: 'Double Round Robin',
    description: 'Each player plays each opponent twice',
  },
  {
    value: 'single_round_robin',
    title: 'Single Round Robin',
    description: 'Each player plays each opponent once',
  },
  {
    value: 'individual_races',
    title: 'Individual Races',
    disabled: true,
    disabledMessage: 'Coming soon',
    description: 'Each matchup is a race to X games',
  },
];

export function MatchFormatStep({
  value,
  onChange,
}: WizardStepProps<string | undefined, LeagueWizardFormData>) {
  return (
    <CardSelector
      label="How should matches be structured?"
      labelInfoButton={{
        title: 'Match Format',
        content: (
          <p>
            Determines how individual games are generated within a match.
            Round robin formats have each player face every opponent.
            Double means they play each opponent twice (once breaking,
            once racking).
          </p>
        ),
      }}
      options={MATCH_FORMAT_OPTIONS}
      value={value ?? ''}
      onChange={onChange}
    />
  );
}
