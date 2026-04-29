/**
 * @fileoverview WinConditionStep — custom path: when does the match end
 *
 * Captures the match-level win condition:
 *   - first_to_games: first team to a game-win threshold (BCA Classic)
 *   - first_to_pairings: first team to a pairing-win threshold (race format)
 *   - highest_after_all_games: play all games, highest total wins (Fargo 10-7)
 *   - total_points_target: first to a points target
 *
 * Phase 4 Unit 4.1 of the modular-league plan.
 */

import { CardSelector } from '@/components/wizard';
import type { SelectableCardOption } from '@/components/wizard';
import type { WizardStepProps } from '@/components/wizard';
import type { LeagueWizardFormData } from '../leagueWizardTypes';

const WIN_CONDITION_OPTIONS: SelectableCardOption<string>[] = [
  {
    value: 'first_to_games',
    title: 'First to N Games',
    description: 'First team to reach the game-win threshold wins the match',
    infoButton: {
      title: 'First to N Games',
      content:
        'BCA Classic. Each team has a target game-win count derived from the handicap chart. First team to hit their target wins; the match can end early once decided.',
    },
  },
  {
    value: 'first_to_pairings',
    title: 'First to N Pairings',
    description: 'First team to reach the pairing-win threshold wins',
    infoButton: {
      title: 'First to N Pairings',
      content:
        'Used with race-format pairings (one pairing-win per race). Match ends as soon as one team reaches the pairing threshold.',
    },
  },
  {
    value: 'highest_after_all_games',
    title: 'Highest After All Games',
    description: 'Play every scheduled game; highest team total wins',
    infoButton: {
      title: 'Highest After All Games',
      content:
        'Fargo 10-7 default. Every game on the schedule plays, and the team with more total points (or game-wins, depending on scoring method) wins the match. Even-game formats can end in a tie — pair with the Tiebreaker step to decide what to do.',
    },
  },
  {
    value: 'total_points_target',
    title: 'First to N Points',
    description: 'First team to reach a points target wins',
    infoButton: {
      title: 'First to N Points',
      content:
        'Less common; used by some points-based formats where the match ends as soon as one side accumulates the target. Pair with a points scoring method.',
    },
  },
];

export function WinConditionStep({
  value,
  onChange,
}: WizardStepProps<string | undefined, LeagueWizardFormData>) {
  return (
    <CardSelector
      label="When does the match end?"
      labelInfoButton={{
        title: 'Win Condition',
        content: (
          <p>
            Determines whether matches play to completion or end early
            once one team is decided. Combinations are reviewed for
            coherence before the league is created.
          </p>
        ),
      }}
      options={WIN_CONDITION_OPTIONS}
      value={value ?? ''}
      onChange={onChange}
    />
  );
}
