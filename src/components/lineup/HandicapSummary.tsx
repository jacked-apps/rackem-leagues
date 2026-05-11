/**
 * @fileoverview Handicap Summary Component
 *
 * Displays the breakdown of team handicap calculations:
 * - Player handicaps total
 * - Team modifier (home team only, based on standings)
 * - Final team total handicap
 */

import { InfoButton } from '@/components/InfoButton';
import { formatHandicap } from '@/utils/lineup';

interface HandicapSummaryProps {
  playerTotal: number;
  teamHandicap: number;
  teamTotal: number;
  isHomeTeam: boolean;
  /** Handicap system: 'points', 'percentage', 'fargo', 'none' */
  handicapType: string;
}

export function HandicapSummary({
  playerTotal,
  teamHandicap,
  teamTotal,
  isHomeTeam,
  handicapType,
}: HandicapSummaryProps) {
  const showPercentage = handicapType === 'percentage';

  return (
    <div className="border-t pt-4 space-y-2">
      <div className="flex justify-between items-center text-sm text-muted-foreground">
        <span>Player Handicaps:</span>
        <span className="font-semibold">{formatHandicap(playerTotal, showPercentage)}</span>
      </div>

      {/* Only show team modifier if there is one (home team with non-zero modifier) */}
      {isHomeTeam && teamHandicap !== 0 && (
        <div className="flex justify-between items-center text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Team Modifier:</span>
            <InfoButton title="Team Handicap Modifier">
              <div className="space-y-2">
                <p>
                  This modifier is based on how your team's record compares to
                  your opponent's in the standings.
                </p>
                <div className="bg-muted p-2 rounded">
                  <p className="font-semibold mb-1">How it works:</p>
                  <p className="text-xs">
                    For every 2 match wins ahead = -1 modifier (advantage)
                  </p>
                  <p className="text-xs">
                    For every 2 match wins behind = +1 modifier (disadvantage)
                  </p>
                  <p className="text-xs mt-1 italic">
                    Lower handicap = fewer games needed to win
                  </p>
                </div>
                <div className="bg-blue-50 p-2 rounded">
                  <p className="font-semibold mb-1">Examples:</p>
                  <p className="text-xs">
                    5 matches ahead → <strong>-2 modifier</strong> (advantage)
                    <br />2 matches ahead → <strong>-1 modifier</strong>{' '}
                    (advantage)
                    <br />2 matches behind → <strong>+1 modifier</strong>{' '}
                    (disadvantage)
                    <br />
                    4-5 matches behind → <strong>+2 modifier</strong>{' '}
                    (disadvantage)
                  </p>
                </div>
                <p className="text-xs">
                  This modifier is only applied to the home team to ensure only
                  one adjustment per match. It's added to the home team's player
                  handicaps to help balance competition.
                </p>
              </div>
            </InfoButton>
          </div>
          <span className="font-semibold">
            {teamHandicap >= 0 ? '+' : ''}
            {formatHandicap(teamHandicap, showPercentage)}
          </span>
        </div>
      )}

      <div className="flex justify-between items-center pt-2 border-t">
        <span className="font-semibold text-foreground">
          Team Total Handicap:
        </span>
        <span className="text-2xl font-bold text-blue-600">
          {formatHandicap(teamTotal, showPercentage)}
        </span>
      </div>

      {!isHomeTeam && (
        <p className="text-xs text-muted-foreground italic">
          Team bonus shown above applies to home team only
        </p>
      )}
    </div>
  );
}
