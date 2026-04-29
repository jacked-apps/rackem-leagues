/**
 * @fileoverview StandingsSortStep — custom path: standings sort priority
 *
 * Captures the season-long standings sort key priority. Three preset
 * orderings cover the common cases:
 *   - wins_first: [match_wins, games_won, points_earned] (BCA Classic default)
 *   - points_first: [points_earned, match_wins, games_won] (Fargo 10-7)
 *   - games_won_first: [games_won, match_wins, points_earned] (alternative)
 *
 * The wizard answer is a single key that maps to a fixed array in
 * useCreateLeagueV2 — avoids building a custom drag-to-reorder UI for v1.
 *
 * Phase 4 Unit 4.1 of the modular-league plan.
 */

import { CardSelector } from '@/components/wizard';
import type { SelectableCardOption } from '@/components/wizard';
import type { WizardStepProps } from '@/components/wizard';
import type { LeagueWizardFormData } from '../leagueWizardTypes';

const STANDINGS_SORT_OPTIONS: SelectableCardOption<string>[] = [
  {
    value: 'wins_first',
    title: 'Match Wins First',
    description: 'Match wins → games won → points (BCA Classic default)',
    infoButton: {
      title: 'Match Wins First',
      content:
        'Sort the season standings primarily by total match wins. Ties broken by total games won, then by total points. The expected default for most BCA-style leagues.',
    },
  },
  {
    value: 'points_first',
    title: 'Total Points First',
    description: 'Points → match wins → games won (Fargo 10-7 style)',
    infoButton: {
      title: 'Total Points First',
      content:
        'Sort primarily by accumulated points across the season. Match-win count and games-won are tiebreakers. Used by points-scoring leagues where dominant wins should outweigh narrow ones.',
    },
  },
  {
    value: 'games_won_first',
    title: 'Total Games Won First',
    description: 'Games won → match wins → points',
    infoButton: {
      title: 'Total Games Won First',
      content:
        'Sort primarily by total individual games won. Useful for leagues that emphasize game-level performance over match results.',
    },
  },
];

export function StandingsSortStep({
  value,
  onChange,
}: WizardStepProps<string | undefined, LeagueWizardFormData>) {
  return (
    <CardSelector
      label="How should season standings be sorted?"
      labelInfoButton={{
        title: 'Standings Sort Priority',
        content: (
          <p>
            Determines which stat appears in the leftmost standings column
            and breaks the most ties. You can change this later in the
            league settings.
          </p>
        ),
      }}
      options={STANDINGS_SORT_OPTIONS}
      value={value ?? ''}
      onChange={onChange}
    />
  );
}
