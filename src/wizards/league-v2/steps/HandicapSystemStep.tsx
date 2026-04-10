/**
 * @fileoverview HandicapSystemStep — custom path: handicap calculation method
 *
 * Only shown when the user picks "Custom" on the LeagueFormatStep.
 * Offers the existing systems plus a "Custom Formula Builder" card
 * that's disabled with a "Coming soon" toast.
 */

import { CardSelector } from '@/components/wizard';
import type { SelectableCardOption } from '@/components/wizard';
import type { WizardStepProps } from '@/components/wizard';
import type { LeagueWizardFormData } from '../leagueWizardTypes';

const HANDICAP_OPTIONS: SelectableCardOption<string>[] = [
  {
    value: 'points',
    title: 'Points',
    description: 'BCA Classic (max +2 min -2)',
    infoButton: {
      title: 'Points Handicap Formula',
      content: '(Wins - Losses) / Weeks Played. Produces a value from -2 to +2.',
    },
  },
  {
    value: 'percentage',
    title: 'Percentage',
    description: 'Percentage-based handicap calculation',
    infoButton: {
      title: 'Percentage Handicap Formula',
      content: 'Wins / Total Games Played. Produces a percentage (e.g., 55%).',
    },
  },
  {
    value: 'fargo',
    title: 'Fargo Rating',
    description: 'Uses Fargo ratings for handicap calculation',
    infoButton: {
      title: 'Fargo Rating System',
      content: 'FargoRate is the official rating system of the BCA and CSI. It assigns players a numeric rating based on their performance history, allowing fair handicap matchups across different skill levels. Ratings are maintained internationally and updated regularly.',
    },
  },
  {
    value: 'none',
    title: 'No Handicap',
    description: 'All players compete on equal terms',
  },
  {
    value: 'custom_formula',
    title: 'Custom Formula Builder',
    disabled: true,
    disabledMessage: 'Coming soon',
    description: 'Build your own handicap formula from available stats',
  },
];

export function HandicapSystemStep({
  value,
  onChange,
}: WizardStepProps<string | undefined, LeagueWizardFormData>) {
  return (
    <CardSelector
      label="What handicap system should this league use?"
      labelInfoButton={{
        title: 'Handicap System',
        content: (
          <p>
            The handicap system determines how player skill differences
            are accounted for. It affects how start points or thresholds
            are calculated each match night.
          </p>
        ),
      }}
      options={HANDICAP_OPTIONS}
      value={value ?? ''}
      onChange={onChange}
    />
  );
}
