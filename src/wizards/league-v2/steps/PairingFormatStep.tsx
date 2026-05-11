/**
 * @fileoverview PairingFormatStep — custom path: per-pairing format
 *
 * Captures whether each player-vs-player matchup plays a single rack
 * (BCA / Fargo 10-7 default) or a race-to-N (BCAPL Skill Level format,
 * future scope for any system).
 *
 * Phase 4 Unit 4.1 of the modular-league plan.
 */

import { CardSelector } from '@/components/wizard';
import type { SelectableCardOption } from '@/components/wizard';
import type { WizardStepProps } from '@/components/wizard';
import type { LeagueWizardFormData } from '../leagueWizardTypes';

const PAIRING_FORMAT_OPTIONS: SelectableCardOption<string>[] = [
  {
    value: 'single_rack',
    title: 'Single Rack',
    description: 'One rack per matchup; winner of the rack takes the pairing',
    infoButton: {
      title: 'Single Rack',
      content:
        'The most common format. Each home player faces each away player in a single rack — the winner of that rack wins the pairing. Used by BCA Classic and Fargo 10-7.',
    },
  },
  {
    value: 'race_to_n',
    title: 'Race to N',
    description: 'Each pairing plays a race; winner of the race wins the pairing',
    infoButton: {
      title: 'Race to N',
      content:
        'Each player-vs-player pairing plays a race to N racks (e.g., race-to-7). Whoever reaches N first wins the pairing. Used by BCAPL Skill Level format and most pro tour formats.',
    },
  },
];

export function PairingFormatStep({
  value,
  onChange,
}: WizardStepProps<string | undefined, LeagueWizardFormData>) {
  return (
    <CardSelector
      label="How is each player-vs-player matchup decided?"
      labelInfoButton={{
        title: 'Pairing Format',
        content: (
          <p>
            Determines whether each pairing is a single rack or a race.
            This is independent from how the overall match is structured
            (round-robin etc.) — that's the next question.
          </p>
        ),
      }}
      options={PAIRING_FORMAT_OPTIONS}
      value={value ?? ''}
      onChange={onChange}
    />
  );
}
