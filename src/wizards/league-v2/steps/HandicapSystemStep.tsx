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
    description: 'Integer handicap, range −2 to +2',
    infoButton: { slug: 'points-handicap' },
  },
  {
    value: 'percentage',
    title: 'Percentage',
    description: 'Win-percentage-based handicap',
    infoButton: { slug: 'percentage-handicap' },
  },
  {
    value: 'fargo',
    title: 'Fargo Rating',
    description: 'Uses FargoRate ratings for handicap calculation',
    infoButton: { slug: 'fargorate' },
  },
  {
    value: 'skill_level',
    title: 'BCAPL Skill Level',
    description: 'Integer 1–9 skill level with race-length adjustment chart',
    infoButton: {
      title: 'BCAPL Skill Level',
      content:
        'The BCA Pool League\'s national headline handicap. Each player carries a Skill Level from 1 (beginner) to 9 (advanced). The published Playing Handicap Chart maps each (SL_home, SL_away) pair to the race lengths each player needs to win. Pair with the Race-to-N pairing format and Race Winner scoring.',
    },
  },
  {
    value: 'none',
    title: 'No Handicap',
    description: 'All players compete on equal terms',
    infoButton: { slug: 'no-handicap' },
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
      labelInfoButton={{ slug: 'handicap-system' }}
      options={HANDICAP_OPTIONS}
      value={value ?? ''}
      onChange={onChange}
    />
  );
}
