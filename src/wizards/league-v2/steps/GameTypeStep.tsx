/**
 * @fileoverview GameTypeStep — first question in the League Creation Wizard
 *
 * Asks the operator which billiards game this league will play.
 * Uses CardSelector with vertical layout for mobile-friendly tap targets.
 */

import { CardSelector } from '@/components/wizard';
import type { WizardStepProps } from '@/components/wizard';
import type { GameType } from '@/types/league';
import type { LeagueWizardFormData } from '../leagueWizardTypes';

const GAME_TYPE_OPTIONS = [
  {
    value: 'eight_ball' as GameType,
    title: '8-Ball',
    description: 'Classic stripes and solids',
  },
  {
    value: 'nine_ball' as GameType,
    title: '9-Ball',
    description: 'Rotation',
  },
  {
    value: 'ten_ball' as GameType,
    title: '10-Ball',
    description: 'Call-pocket rotation',
  },
];

export function GameTypeStep({
  value,
  onChange,
}: WizardStepProps<GameType | undefined, LeagueWizardFormData>) {
  return (
    <CardSelector
      label="What game will this league play?"
      labelInfoButton={{
        title: 'Game Type',
        content: (
          <p>
            Choose the game that will be played for this league. This is
            mainly used to differentiate between leagues and is included
            in the league name. It also determines how player stats are
            tracked and categorized.
          </p>
        ),
      }}
      options={GAME_TYPE_OPTIONS}
      value={value ?? ('' as GameType)}
      onChange={onChange}
    />
  );
}
