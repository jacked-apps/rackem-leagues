/**
 * @fileoverview Tiebreaker Scoreboard Component
 *
 * Minimal scoreboard for tiebreaker matches (games 19-21).
 * Shows just HOME vs AWAY win counts.
 * Both teams see identical view - no toggles, no player details.
 */

import { Card, CardContent } from '@/components/ui/card';
import { MatchEndVerification } from './MatchEndVerification';

interface TiebreakerScoreboardProps {
  /** Current match data */
  match: {
    id: string;
    home_team_id: string;
    away_team_id: string;
    home_team?: { team_name: string };
    away_team?: { team_name: string };
    home_team_verified_by?: string | null;
    away_team_verified_by?: string | null;
    home_tiebreaker_verified_by?: string | null;
    away_tiebreaker_verified_by?: string | null;
  };
  /** Map of game results by game number */
  gameResults: Map<
    number,
    {
      id: string;
      winner_team_id: string | null;
      confirmed_by_home: boolean;
      confirmed_by_away: boolean;
    }
  >;
  /** Is current user on home team? */
  isHomeTeam: boolean;
  /** Handler when user clicks verify */
  onVerify: () => void;
  /** Is verification in progress? */
  isVerifying?: boolean;
  /** Game type for potential future tiebreakers */
  gameType: string;
}

/**
 * Simple tiebreaker scoreboard - just shows win counts
 */
export function TiebreakerScoreboard({
  match,
  gameResults,
  isHomeTeam,
  onVerify,
  isVerifying = false,
  gameType,
}: TiebreakerScoreboardProps) {
  // Count wins for each team (only confirmed games)
  let homeWins = 0;
  let awayWins = 0;

  gameResults.forEach((game) => {
    // Only count confirmed games
    if (game.confirmed_by_home && game.confirmed_by_away) {
      if (game.winner_team_id === match.home_team_id) {
        homeWins++;
      } else if (game.winner_team_id === match.away_team_id) {
        awayWins++;
      }
    }
  });

  // Check if tiebreaker is complete
  // Match ends when either team reaches 2 wins (best of 3)
  const matchComplete = homeWins >= 2 || awayWins >= 2;

  // If match complete, show verification instead of scoreboard
  if (matchComplete) {
    return (
      <MatchEndVerification
        matchId={match.id}
        homeTeamId={match.home_team_id}
        awayTeamId={match.away_team_id}
        homeTeamName={match.home_team?.team_name || 'Home'}
        awayTeamName={match.away_team?.team_name || 'Away'}
        homeWins={homeWins}
        awayWins={awayWins}
        homeWinThreshold={2} // First to 2 wins
        awayWinThreshold={2}
        homeTieThreshold={null} // No ties in tiebreaker
        awayTieThreshold={null}
        homeVerifiedBy={match.home_tiebreaker_verified_by || null}
        awayVerifiedBy={match.away_tiebreaker_verified_by || null}
        isHomeTeam={isHomeTeam}
        onVerify={onVerify}
        isVerifying={isVerifying}
        gameType={gameType}
      />
    );
  }

  return (
    <div className="bg-card border-b px-4 py-3">
      <Card className="shadow-lg">
        <CardContent className="pt-6">
          {/* Tiebreaker Header */}
          <div className="text-center mb-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Tiebreaker
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              First to 2 Wins
            </div>
          </div>

          {/* Score Display */}
          <div className="grid grid-cols-3 gap-6 items-center">
            {/* Home Score */}
            <div className="text-center bg-blue-100 rounded-lg p-4">
              <div className="text-sm font-medium text-muted-foreground mb-2">
                HOME
              </div>
              <div className="text-6xl font-bold text-foreground">
                {homeWins}
              </div>
            </div>

            {/* VS Separator */}
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-300">
                vs
              </div>
            </div>

            {/* Away Score */}
            <div className="text-center bg-orange-100 rounded-lg p-4">
              <div className="text-sm font-medium text-muted-foreground mb-2">
                AWAY
              </div>
              <div className="text-6xl font-bold text-foreground">
                {awayWins}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
