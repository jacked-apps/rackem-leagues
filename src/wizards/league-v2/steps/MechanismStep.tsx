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
    infoButton: {
      title: 'Extra Games Handicap',
      content:
        'BCA Classic. The handicap chart says: higher-rated team needs N games to win, lower-rated team needs M (where N > M). Skill differential is absorbed by an asymmetric games-to-win threshold.',
    },
  },
  {
    value: 'start_points',
    title: 'Start Points',
    description: 'Lower-rated team starts the match with bonus points',
    infoButton: {
      title: 'Start Points Handicap',
      content:
        'Fargo 10-7. Calculated from each team\'s rating sum, the weaker team begins with a points credit. The match plays all games and totals decide the winner.',
    },
  },
  {
    value: 'race_length_adjustment',
    title: 'Race Length Adjustment',
    description: 'Each pairing has a race length set by skill differential',
    infoButton: {
      title: 'Race Length Adjustment',
      content:
        'BCAPL Skill Level. The published handicap chart maps each (SL_home, SL_away) pair to a (race_home, race_away) target. The two players race to different targets, equalizing the matchup. Pair with the Race-to-N pairing format.',
    },
  },
  {
    value: 'none',
    title: 'No Handicap',
    description: 'Every player plays on equal terms',
    infoButton: {
      title: 'No Handicap',
      content:
        'No skill compensation. Suitable for tournaments or leagues where ratings are not tracked or used.',
    },
  },
];

export function MechanismStep({
  value,
  onChange,
}: WizardStepProps<string | undefined, LeagueWizardFormData>) {
  return (
    <CardSelector
      label="How is the handicap applied?"
      labelInfoButton={{
        title: 'Handicap Mechanism',
        content: (
          <p>
            Pairs with the handicap system to decide HOW skill differences
            are accounted for. Different mechanisms work better with
            different scoring methods — the review step will flag any
            unusual combinations.
          </p>
        ),
      }}
      options={MECHANISM_OPTIONS}
      value={value ?? ''}
      onChange={onChange}
    />
  );
}
