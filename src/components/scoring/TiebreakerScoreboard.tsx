/**
 * @fileoverview Tiebreaker Scoreboard Component
 *
 * Minimal scoreboard for a tiebreaker (the match's is_tiebreaker games).
 * Shows just HOME vs AWAY win counts. The finish line is the tiebreak
 * record's games_needed (2 for best-of-3, 1 for a single race) — it is never
 * hardcoded here (Unit 4 of docs/plans/2026-10-28-001-feat-tiebreaker-record-plan.md).
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
      /** Confirmer's member id per side; null = not confirmed yet */
      confirmed_by_home: string | null;
      confirmed_by_away: string | null;
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
  /** Wins needed to take the tiebreaker — from the tiebreak record. */
  gamesNeeded: number;
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
  gamesNeeded,
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
  // It ends when either team reaches the record's games_needed.
  const matchComplete = homeWins >= gamesNeeded || awayWins >= gamesNeeded;

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
        homeWinThreshold={gamesNeeded}
        awayWinThreshold={gamesNeeded}
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
              First to {gamesNeeded} {gamesNeeded === 1 ? 'Win' : 'Wins'}
            </div>
          </div>

          {/* Score Display — R18 of unified-scoreboard plan: actual team
              names instead of generic HOME / AWAY labels. */}
          <div className="grid grid-cols-3 gap-6 items-center">
            {/* Home Score */}
            <div className="text-center bg-blue-100 rounded-lg p-4">
              <div className="text-sm font-medium text-muted-foreground mb-2 truncate">
                {match.home_team?.team_name ?? 'Home'}
              </div>
              <div className="text-6xl font-bold text-foreground">
                {homeWins}
              </div>
            </div>

            {/* VS Separator */}
            <div className="text-center">
              <div className="text-3xl font-bold text-muted-foreground">
                vs
              </div>
            </div>

            {/* Away Score */}
            <div className="text-center bg-orange-100 rounded-lg p-4">
              <div className="text-sm font-medium text-muted-foreground mb-2 truncate">
                {match.away_team?.team_name ?? 'Away'}
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
