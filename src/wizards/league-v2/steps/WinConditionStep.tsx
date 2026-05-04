/**
 * @fileoverview WinConditionStep — custom path: how the match is decided.
 *
 * Phase 4 Unit 4.1 collapse: 4 values → binary `'games' | 'points'`.
 * The original options conflated "early-end vs play-all-out" (a UX detail)
 * with "decide-by-games vs decide-by-points" (the architectural axis).
 * The v2 plan unwinds that conflation: only the win axis lives here;
 * early-end behavior is implicit from the points calculator + thresholds.
 *
 *   - games:  the team that wins more games wins the match (BCA-style;
 *             tie band possible at the threshold which triggers
 *             tiebreaker flow).
 *   - points: the team with more points wins the match (Fargo-style;
 *             never a true tie because points include partial credit).
 *
 * Combo coherence (Unit 4.2): when `points_calculator = null` ("don't
 * track points"), this step's value MUST be `'games'` — that rule fires
 * in the combo validator + as a hard error on Save. This step's UI
 * doesn't enforce it directly; the LO can pick either card and the
 * validator catches the inconsistency at review time.
 */

import { CardSelector } from '@/components/wizard';
import type { SelectableCardOption } from '@/components/wizard';
import type { WizardStepProps } from '@/components/wizard';
import type { LeagueWizardFormData } from '../leagueWizardTypes';

const WIN_CONDITION_OPTIONS: SelectableCardOption<string>[] = [
  {
    value: 'games',
    title: 'Games decide the winner',
    description:
      'Whichever team wins more games wins the match (BCA-style). Ties at the threshold trigger the tiebreaker flow.',
    infoButton: {
      title: 'Games-condition matches',
      content: (
        <div className="space-y-2">
          <p>
            The team with the higher games-won count wins. If both teams
            land in the tie band (between the win and tie thresholds),
            the match goes to the tiebreaker step you configure later.
          </p>
          <p className="text-xs text-gray-600">
            Used by all classic BCA formats (3v3, 5v5, etc.). Pairs
            naturally with Linear Above Threshold or Accumulate with
            Milestone Jumps points calculators.
          </p>
        </div>
      ),
    },
  },
  {
    value: 'points',
    title: 'Points decide the winner',
    description:
      'Whichever team accumulated more points wins. Never a true tie. Fargo-style.',
    infoButton: {
      title: 'Points-condition matches',
      content: (
        <div className="space-y-2">
          <p>
            All scheduled games play, then totals are compared. Whichever
            team has more points wins outright; the partial-credit
            structure of points-mode calculators means exact ties are
            functionally impossible.
          </p>
          <p className="text-xs text-gray-600">
            Used by Fargo 10-7. Requires a points calculator that's NOT
            "None — don't track points." Otherwise this option will be
            blocked at the review step.
          </p>
        </div>
      ),
    },
  },
];

export function WinConditionStep({
  value,
  onChange,
}: WizardStepProps<'games' | 'points' | undefined, LeagueWizardFormData>) {
  return (
    <CardSelector
      label="How is the match decided?"
      labelInfoButton={{
        title: 'Win Condition',
        content: (
          <p>
            The two values map directly to the runtime's binary
            win-condition axis. Combinations are reviewed for coherence
            before the league is created (e.g. "decide by points" with
            "no calculator" is blocked).
          </p>
        ),
      }}
      options={WIN_CONDITION_OPTIONS}
      value={value ?? ''}
      onChange={(v) => onChange(v as 'games' | 'points')}
    />
  );
}
