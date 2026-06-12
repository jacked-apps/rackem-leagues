/**
 * @fileoverview TiebreakerStep — custom path: what happens when matches tie
 *
 * Combined trigger + format step (the two preference axes
 * `tiebreaker_trigger` and `tiebreaker_format` map deterministically
 * from a single user choice). Three options:
 *   - accept_tie:        trigger=never,                 format=accept_tie
 *   - best_of_3:         trigger=even_total_games_only, format=best_of_3_short_race
 *   - single_short_race: trigger=even_total_games_only, format=single_short_race
 *
 * Conditional: only shown when the configured match-format and lineup
 * size produce an even total-game count (the only case where matches
 * can actually tie). useCreateLeagueV2 maps the chosen value back to
 * the two DB fields.
 *
 * Phase 4 Unit 4.1 of the modular-league plan.
 */

import { CardSelector } from '@/components/wizard';
import type { SelectableCardOption } from '@/components/wizard';
import type { WizardStepProps } from '@/components/wizard';
import type { LeagueWizardFormData } from '../leagueWizardTypes';

const TIEBREAKER_OPTIONS: SelectableCardOption<string>[] = [
  {
    value: 'best_of_3',
    title: 'Best of 3 Tiebreaker',
    description: 'Tied matches play a best-of-3 short race to decide',
    infoButton: {
      title: 'Best of 3',
      content:
        'BCA 3v3 default. When a match ends tied, three additional short-race games are played. First team to win 2 of those takes the match.',
    },
  },
  {
    value: 'single_short_race',
    title: 'Single Short Race',
    description: 'Tied matches play one extra rack to decide',
    infoButton: {
      title: 'Single Short Race',
      content:
        'When a match ends tied, one additional rack is played. Winner takes the match. Faster than best-of-3.',
    },
  },
  {
    value: 'accept_tie',
    title: 'Accept Tie',
    description: 'Tied matches stay tied',
    infoButton: {
      title: 'Accept Tie',
      content:
        'No tiebreaker is played. The match record shows a tie, and standings reflect it. Some leagues prefer this for simplicity.',
    },
  },
  {
    value: 'manual',
    title: "Manual — we'll prompt you",
    description: "When ties happen, you decide the winner. Use this if your league has a rule we haven't built yet.",
    infoButton: {
      title: 'Manual Tiebreaker',
      content: (
        <div className="space-y-2">
          <p>
            When a match ends tied, the system prompts the LO with a
            simple dialog: pick the winner team, optionally enter
            additional games or points scored. The original regular-game
            scores stand as the official scoreboard; the manual entry
            decides the match outcome.
          </p>
          <p className="text-xs text-muted-foreground">
            Graceful fallback for leagues whose specific tiebreaker rule
            isn't pre-codified yet. Always available — your league
            never gets stuck on a tie.
          </p>
        </div>
      ),
    },
  },
];

export function TiebreakerStep({
  value,
  onChange,
}: WizardStepProps<string | undefined, LeagueWizardFormData>) {
  return (
    <CardSelector
      label="What happens if a match ends tied?"
      labelInfoButton={{
        title: 'Tiebreaker',
        content: (
          <p>
            Only relevant when the match format can produce a tie (an
            even number of games). For odd-game formats this question
            is skipped automatically.
          </p>
        ),
      }}
      options={TIEBREAKER_OPTIONS}
      value={value ?? ''}
      onChange={onChange}
    />
  );
}
