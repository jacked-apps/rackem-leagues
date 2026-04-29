/**
 * @fileoverview ScoringMethodStep — custom path: how each game/pairing scores
 *
 * Captures the per-game (or per-pairing) scoring unit:
 *   - winner_takes_all: the winner gets 1 game-win, loser gets 0 (BCA Classic)
 *   - points_10_7: winner gets winner_points, loser gets balls pocketed (Fargo 10-7)
 *   - race_winner: race winner takes the pairing (paired with race_to_n format)
 *
 * Phase 4 Unit 4.1 of the modular-league plan.
 */

import { CardSelector } from '@/components/wizard';
import type { SelectableCardOption } from '@/components/wizard';
import type { WizardStepProps } from '@/components/wizard';
import type { LeagueWizardFormData } from '../leagueWizardTypes';

const SCORING_METHOD_OPTIONS: SelectableCardOption<string>[] = [
  {
    value: 'winner_takes_all',
    title: 'Winner Takes All',
    description: 'Winner gets 1 game-win; loser gets 0',
    infoButton: {
      title: 'Winner Takes All',
      content:
        'Standard BCA scoring: each game has a single winner who earns one game-win toward the team total. Margin of victory does not affect points.',
    },
  },
  {
    value: 'points_10_7',
    title: 'Points (10-7 / customizable)',
    description: 'Winner gets winner_points; loser gets balls pocketed',
    infoButton: {
      title: 'Fargo-style Points Scoring',
      content:
        'Winner of each game gets a fixed point total (default 10, configurable). Loser gets points equal to the number of balls they legally pocketed during the game (0–7 for 8-ball). Total team points decide the match.',
    },
  },
  {
    value: 'race_winner',
    title: 'Race Winner',
    description: 'Whoever wins the race wins the pairing (use with Race-to-N)',
    infoButton: {
      title: 'Race Winner',
      content:
        'Pairs with the Race to N pairing format: the winner of the race takes one pairing-win for their team, regardless of margin within the race.',
    },
  },
];

export function ScoringMethodStep({
  value,
  onChange,
}: WizardStepProps<string | undefined, LeagueWizardFormData>) {
  return (
    <CardSelector
      label="How is each game scored?"
      labelInfoButton={{
        title: 'Scoring Method',
        content: (
          <p>
            Drives both the per-game scoring rules and what the standings
            track. Pairs with the Win Condition step which chooses when
            the match ends.
          </p>
        ),
      }}
      options={SCORING_METHOD_OPTIONS}
      value={value ?? ''}
      onChange={onChange}
    />
  );
}
