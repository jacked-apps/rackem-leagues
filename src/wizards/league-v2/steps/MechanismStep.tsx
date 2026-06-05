/**
 * @fileoverview MechanismStep — custom path: shape of the handicap output
 *
 * Captures the handicap mechanism (R8 of modular-league plan):
 *   - extra_games: higher-rated team must win more games (BCA Classic)
 *   - start_points: lower-rated team starts with bonus points (Fargo 10-7)
 *   - race_length_adjustment: per-pairing race length differs by rating (BCAPL SL)
 *   - none: no handicap applied
 *
 * Phase 4 Unit 4.1 of the modular-league plan.
 */

import { CardSelector } from '@/components/wizard';
import type { SelectableCardOption } from '@/components/wizard';
import type { WizardStepProps } from '@/components/wizard';
import type { LeagueWizardFormData } from '../leagueWizardTypes';

const MECHANISM_OPTIONS: SelectableCardOption<string>[] = [
  {
    value: 'extra_games',
    title: 'Extra Games',
    description: 'Higher-rated team has to win more games to compensate',
    infoButton: { slug: 'extra-games' },
  },
  {
    value: 'start_points',
    title: 'Start Points',
    description: 'Lower-rated team starts the match with bonus points',
    infoButton: { slug: 'start-points' },
  },
  {
    value: 'race_length_adjustment',
    title: 'Race Length Adjustment',
    description: 'Each pairing has a race length set by skill differential',
    infoButton: { slug: 'race-length-adjustment' },
  },
  {
    value: 'none',
    title: 'No Handicap',
    description: 'Every player plays on equal terms',
    infoButton: { slug: 'no-handicap' },
  },
];

export function MechanismStep({
  value,
  onChange,
}: WizardStepProps<string | undefined, LeagueWizardFormData>) {
  return (
    <CardSelector
      label="How is the handicap applied?"
      labelInfoButton={{ slug: 'handicap-mechanism' }}
      options={MECHANISM_OPTIONS}
      value={value ?? ''}
      onChange={onChange}
    />
  );
}
