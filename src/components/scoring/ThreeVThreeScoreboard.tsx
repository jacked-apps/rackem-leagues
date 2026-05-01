/**
 * @fileoverview 3v3 Match Scoreboard Component
 *
 * Compact dual-card scoreboard for 3v3 format matches.
 * Shows both teams side-by-side with wins, losses, points, and thresholds.
 * Mirrors the FiveVFiveScoreboard pattern but with 3v3-specific thresholds.
 *
 * Key differences from 5v5:
 * - Shows "To Tie" threshold instead of "For 1.5" bonus threshold
 * - 3 players per team instead of 5
 * - Uses standard points calculation (not BCA 1.5x bonus system)
 */

import { useState } from 'react';
import { MatchEndVerification } from '@/components/scoring/MatchEndVerification';
import { TeamStatsCard } from '@/components/scoring/TeamStatsCard';
import { InfoButton } from '@/components/InfoButton';
import type { HandicapThresholds, Lineup } from '@/types';

interface ThreeVThreeScoreboardProps {
  /** Match data with team info */
  match: {
    id: string;
    home_team_id: string;
    away_team_id: string;
    home_team?: { team_name: string };
    away_team?: { team_name: string };
    home_team_verified_by?: string | null;
    away_team_verified_by?: string | null;
  };
  /** Home team lineup */
  homeLineup: Lineup;
  /** Away team lineup */
  awayLineup: Lineup;
  /** Home team handicap thresholds */
  homeThresholds: HandicapThresholds;
  /** Away team handicap thresholds */
  awayThresholds: HandicapThresholds;
  /** Home team wins count */
  homeWins: number;
  /** Away team wins count */
  awayWins: number;
  /** Home team losses count */
  homeLosses: number;
  /** Away team losses count */
  awayLosses: number;
  /** Home team points */
  homePoints: number;
  /** Away team points */
  awayPoints: number;
  /** Total team handicap for home team */
  homeTeamHandicap: number;
  /** Whether all games are complete */
  allGamesComplete: boolean;
  /** Is current user on home team? */
  isHomeTeam: boolean;
  /** Handler when user clicks verify */
  onVerify: () => void;
  /** Is verification in progress? */
  isVerifying?: boolean;
  /** Game type for tiebreaker games */
  gameType: string;
  /** Function to get player display name by ID */
  getPlayerDisplayName: (playerId: string) => string;
  /** Function to get player stats (wins/losses) by position */
  getPlayerStats: (
    playerId: string,
    position: number,
    playerIsHomeTeam: boolean
  ) => { wins: number; losses: number };
  /**
   * Handler called when user clicks "Swap Player" for a player.
   * Only available for players with 0 wins and 0 losses on user's team.
   */
  onSwapPlayer?: (playerId: string, position: number) => void;
}

/**
 * Compact 3v3 scoreboard with both teams side-by-side
 *
 * Displays:
 * - Team name (clickable to expand player stats)
 * - To Win threshold and games needed
 * - To Tie threshold and games needed
 * - Points
 * - Collapsible player stats section
 */
export function ThreeVThreeScoreboard({
  match,
  homeLineup,
  awayLineup,
  homeThresholds,
  awayThresholds,
  homeWins,
  awayWins,
  homeLosses,
  awayLosses,
  homePoints,
  awayPoints,
  homeTeamHandicap,
  allGamesComplete,
  isHomeTeam,
  onVerify,
  isVerifying = false,
  gameType,
  getPlayerDisplayName,
  getPlayerStats,
  onSwapPlayer,
}: ThreeVThreeScoreboardProps) {
  // Accordion state for player stats
  const [showPlayerStats, setShowPlayerStats] = useState(false);

  // Calculate away team handicap from lineup
  // (3v3 format: home team has handicap, away team is always 0 in standard BCA)
  const awayTeamHandicap =
    (awayLineup.player1_handicap || 0) +
    (awayLineup.player2_handicap || 0) +
    (awayLineup.player3_handicap || 0);

  return (
    <div className="bg-card border-b shadow-sm flex-shrink-0">
      <div className="px-4 py-2">
        {/* Show verification component when all games complete */}
        {allGamesComplete && (
          <MatchEndVerification
            matchId={match.id}
            homeTeamId={match.home_team_id}
            awayTeamId={match.away_team_id}
            homeTeamName={match.home_team?.team_name || 'Home'}
            awayTeamName={match.away_team?.team_name || 'Away'}
            homeWins={homeWins}
            awayWins={awayWins}
            homeWinThreshold={homeThresholds.games_to_win}
            awayWinThreshold={awayThresholds.games_to_win}
            homeTieThreshold={homeThresholds.games_to_tie}
            awayTieThreshold={awayThresholds.games_to_tie}
            homeVerifiedBy={match.home_team_verified_by || null}
            awayVerifiedBy={match.away_team_verified_by || null}
            isHomeTeam={isHomeTeam}
            onVerify={onVerify}
            isVerifying={isVerifying}
            gameType={gameType}
          />
        )}

        {/* Team labels with info button */}
        <div className="flex items-center justify-between mt-2 mb-1">
          <div className="flex-1 text-center text-xs font-semibold text-blue-900">
            HOME
          </div>
          <InfoButton title="Scoring Tips" className="mx-2">
            <p className="text-sm mb-2">
              <strong>Player Stats:</strong> Click either team name to view individual player stats for all
              players in the lineup. Click again to close.
            </p>
            <p className="text-sm mb-2">
              <strong>Table Number:</strong> Tap the blue table number bar above to change your assigned table
              if you get moved to a different one.
            </p>
            <p className="text-sm">
              <strong>Game List:</strong> Each player shows ⚡ for breaker or △ for racker. Tap the
              "Break vs Rack" header to switch between Break/Rack view and Home/Away view.
            </p>
          </InfoButton>
          <div className="flex-1 text-center text-xs font-semibold text-green-900">
            AWAY
          </div>
        </div>

        {/* Dual Team Cards - Side by Side */}
        <div className="grid grid-cols-2 gap-4">
          {/* Home Team */}
          <TeamStatsCard
            teamName={match.home_team?.team_name || 'Home'}
            isHome={true}
            wins={homeWins}
            losses={homeLosses}
            points={homePoints}
            thresholds={homeThresholds}
            lineup={homeLineup}
            teamHandicap={homeTeamHandicap}
            showPlayerStats={showPlayerStats}
            onTogglePlayerStats={() => setShowPlayerStats(!showPlayerStats)}
            getPlayerDisplayName={getPlayerDisplayName}
            getPlayerStats={getPlayerStats}
            mode="3v3"
            isUserTeam={isHomeTeam}
            onSwapPlayer={onSwapPlayer}
          />

          {/* Away Team */}
          <TeamStatsCard
            teamName={match.away_team?.team_name || 'Away'}
            isHome={false}
            wins={awayWins}
            losses={awayLosses}
            points={awayPoints}
            thresholds={awayThresholds}
            lineup={awayLineup}
            teamHandicap={awayTeamHandicap}
            showPlayerStats={showPlayerStats}
            onTogglePlayerStats={() => setShowPlayerStats(!showPlayerStats)}
            getPlayerDisplayName={getPlayerDisplayName}
            getPlayerStats={getPlayerStats}
            mode="3v3"
            isUserTeam={!isHomeTeam}
            onSwapPlayer={onSwapPlayer}
          />
        </div>
      </div>
    </div>
  );
}
