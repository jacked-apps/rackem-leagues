/**
 * @fileoverview PointsCalculatorStep — custom path: which points formula
 * the league uses (Phase 4 Unit 4.1 of the modular-league-system v2 plan).
 *
 * Replaces the legacy `ScoringMethodStep` (which conflated bundled
 * presets like 'winner_takes_all' / 'points_10_7' / 'race_winner'). Each
 * card now corresponds to a registered calculator from
 * `@/systems/calculators` — the registry is the single source of truth
 * for what formulas exist and what their defaults are.
 *
 * Cards displayed:
 *   - linear_above_threshold        (BCA 3v3 default)
 *   - accumulate_with_milestone_jumps (BCA 5v5 default)
 *   - accumulated_per_game           (Fargo 10-7 default)
 *   - none                           (don't track points)
 *
 * For now the LO picks a calculator and the runtime uses its
 * Tested Preset defaultParams. An inline parameter editor (per-calculator
 * zod-schema-driven form) is a Unit 4.1 follow-up — the BCA pitch story
 * stands on the calculator-pick alone ("modular calculator dispatch").
 *
 * Picking "None" forces `win_condition = 'games'` in the subsequent step
 * (you can't decide a match by points if you're not tracking points).
 * That coherence rule lives in Unit 4.2's combo validator; here we just
 * record the form-data choice.
 */

import { CardSelector } from '@/components/wizard';
import type { SelectableCardOption } from '@/components/wizard';
import type { WizardStepProps } from '@/components/wizard';
import type { LeagueWizardFormData } from '../leagueWizardTypes';

const POINTS_CALCULATOR_OPTIONS: SelectableCardOption<string>[] = [
  {
    value: 'linear_above_threshold',
    title: 'Linear Above Threshold',
    description:
      'Three-band formula (above-win → linear, tie band → 0, below-tie → linear). BCA 3v3 default.',
    infoButton: {
      title: 'Linear Above Threshold',
      content: (
        <div className="space-y-2">
          <p>The classic BCA 3v3 points formula:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Above-win:</strong> games_won &gt; threshold → (games_won − threshold) × multiplier</li>
            <li><strong>Tie band:</strong> tie_threshold ≤ games_won ≤ win_threshold → 0 (always)</li>
            <li><strong>Below-tie:</strong> games_won &lt; tie_threshold → (games_won − tie_threshold) × multiplier</li>
          </ul>
          <p className="text-xs text-muted-foreground">
            Default multiplier = 1. The tie band always returns 0 regardless of multiplier — locked invariant.
          </p>
        </div>
      ),
    },
  },
  {
    value: 'accumulate_with_milestone_jumps',
    title: 'Accumulate with Milestone Jumps',
    description:
      'Per-game accumulation with stepped bonuses at milestones. BCA 5v5 default.',
    infoButton: {
      title: 'Accumulate with Milestone Jumps',
      content: (
        <div className="space-y-2">
          <p>BCA 5v5 tiered points:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>0.1 points per game won</li>
            <li>At 70% of win threshold: jumps to 1.5 points, then 0.1 per additional game</li>
            <li>At win threshold: jumps to 3.0 points, then 0.1 per additional game</li>
          </ul>
          <p className="text-xs text-muted-foreground">
            Monotonic — points only go up. Suited for win-threshold leagues that reward incremental progress.
          </p>
        </div>
      ),
    },
  },
  {
    value: 'accumulated_per_game',
    title: 'Accumulated per Game',
    description:
      'Per-side fixed-or-counter (e.g. winner gets 10, loser gets balls pocketed). Fargo 10-7 default.',
    infoButton: {
      title: 'Accumulated per Game',
      content: (
        <div className="space-y-2">
          <p>Per-game accumulation with configurable per-side scoring:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Winner:</strong> default 10 points (configurable, fixed)</li>
            <li><strong>Loser:</strong> default counter, balls pocketed by loser (0–7 for 8-ball)</li>
          </ul>
          <p className="text-xs text-muted-foreground">
            Each game's contribution is summed into the team total. Margin within a game matters.
          </p>
        </div>
      ),
    },
  },
  {
    value: 'none',
    title: "None — don't track points",
    description: 'Standings use games-won only. Match decided by win_condition = games.',
    infoButton: {
      title: "Don't Track Points",
      content: (
        <p>
          Some leagues only count games won and don't accumulate points.
          When you pick this option the next step (Win Condition) will be
          locked to "games decide the winner."
        </p>
      ),
    },
  },
];

export function PointsCalculatorStep({
  value,
  onChange,
}: WizardStepProps<string | undefined, LeagueWizardFormData>) {
  // Migration 20260503000000: 'none' is now a first-class string value
  // (replaces the buggy NULL convention). Round-trip is straightforward —
  // form-data and card value are the same string. Legacy null values
  // coming from older form-data drafts are coerced to 'none' on read.
  const cardValue = (value as string | null) === null ? 'none' : (value ?? '');
  const handleChange = (next: string) => {
    onChange(next);
  };
  return (
    <CardSelector
      label="Which points formula does this league use?"
      labelInfoButton={{
        title: 'Points Calculator',
        content: (
          <div className="space-y-2">
            <p>
              Each card is a calculator type registered with the scoring
              runtime. The system dispatches by calculator name — the
              same modular pipeline runs every league regardless of
              which formula they pick.
            </p>
            <p className="text-xs text-muted-foreground">
              Custom params (multiplier values, milestone percentages,
              winner/loser scoring) use Tested Preset defaults today.
              Per-league param editing arrives in a follow-up.
            </p>
          </div>
        ),
      }}
      options={POINTS_CALCULATOR_OPTIONS}
      value={cardValue}
      onChange={handleChange}
    />
  );
}
