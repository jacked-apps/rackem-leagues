/**
 * @fileoverview Ten-Seven Scoreboard — points-accumulation match display
 *
 * Renders the scoreboard for any match scored by the "10-7" pattern:
 * winner earns a fixed point value per game (typically 10), loser earns
 * a point per ball pocketed (typically 0–7 in 8-ball). Highest total
 * after all scheduled games wins. The weaker team may start with a
 * handicap point credit ("start points") determined before the match.
 *
 * This component is deliberately generic — it doesn't know about Fargo,
 * BCA, or any specific league. It takes point totals, games-won counts,
 * and a start-points credit, and renders them. Any SystemModule whose
 * scoring pattern matches this shape can feed into it.
 *
 * Compare to:
 *   - FiveVFiveScoreboard / ThreeVThreeScoreboard: games-won against a
 *     threshold ("need 14 of 25 games to win"). Fundamentally different
 *     display — progress bars toward a target.
 *   - TiebreakerScoreboard: isolated 3-game playoff display.
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { MatchEndVerification } from '@/components/scoring/MatchEndVerification';
import { InfoButton } from '@/components/InfoButton';
import { PlayerNameLink } from '@/components/PlayerNameLink';
import { TeamNameLink } from '@/components/TeamNameLink';
import { getTeamColors } from './scoreboardColors';
import { UserRoundPen } from 'lucide-react';
import type { MatchWithLeagueSettings, Lineup } from '@/types';

interface PlayerStatsGetter {
  (playerId: string, position: number, isHomeTeam: boolean): {
    wins: number;
    losses: number;
  };
}

interface PlayerPointsGetter {
  (playerId: string, position: number, isHomeTeam: boolean): number;
}

interface TenSevenScoreboardProps {
  /** Match data with team info */
  match: MatchWithLeagueSettings;
  /** Home team lineup */
  homeLineup: Lineup;
  /** Away team lineup */
  awayLineup: Lineup;
  /** Current home team points total (includes any start-points credit). */
  homePoints: number;
  /** Current away team points total (includes any start-points credit). */
  awayPoints: number;
  /** Home games won (secondary stat — the race is in points, not games). */
  homeGamesWon: number;
  /** Away games won. */
  awayGamesWon: number;
  /** Total scheduled games for this match (for "x of y played" display). */
  totalScheduledGames: number;
  /**
   * Handicap head-start credit given to the weaker team before the match.
   * Already baked into homePoints / awayPoints — this is for display only
   * so users can see how much weight the handicap gave.
   */
  startPoints: number;
  /** Which team received the start-points credit. 'none' when teams were evenly matched. */
  startPointsFor: 'home' | 'away' | 'none';
  /** Whether all scheduled games are confirmed. */
  allGamesComplete: boolean;
  /** Is the current user on the home team? */
  isHomeTeam: boolean;
  /** Handler invoked when the user taps "Verify Scores". */
  onVerify: () => void;
  /** In-flight verification state. */
  isVerifying?: boolean;
  /** Game type (for tiebreaker games spawned by MatchEndVerification). */
  gameType: string;
  /** Resolve a player's display name by ID. */
  getPlayerDisplayName: (playerId: string) => string;
  /** Resolve a player's per-position stats for the collapsible table. */
  getPlayerStats: PlayerStatsGetter;
  /** Resolve a player's per-position accumulated points (winner points on
   *  games won plus any loser credit on games lost). Used by the drawer
   *  Points column. */
  getPlayerPoints: PlayerPointsGetter;
  /** Optional: swap an unplayed-position player. Only shown on the user's team. */
  onSwapPlayer?: (playerId: string, position: number) => void;
}

/**
 * Scoreboard for 10-7 / points-accumulation style matches.
 *
 * Layout mirrors FiveVFiveScoreboard for consistency:
 *   - MatchEndVerification bar (when all games complete)
 *   - HOME / info / AWAY label row
 *   - Two team cards side-by-side
 *   - Collapsible per-player stats table (shared interaction pattern)
 */
export function TenSevenScoreboard({
  match,
  homeLineup,
  awayLineup,
  homePoints,
  awayPoints,
  homeGamesWon,
  awayGamesWon,
  totalScheduledGames,
  startPoints,
  startPointsFor,
  allGamesComplete,
  isHomeTeam,
  onVerify,
  isVerifying = false,
  gameType,
  getPlayerDisplayName,
  getPlayerStats,
  getPlayerPoints,
  onSwapPlayer,
}: TenSevenScoreboardProps) {
  const [showPlayerStats, setShowPlayerStats] = useState(false);

  // MatchEndVerification is mode-aware internally — it already detects Fargo
  // and uses the point cascade for completion math. We still pass the "win
  // threshold" fields it expects; for points-based matches these are the
  // start-points stored in home_to_win / away_to_win, and the
  // component's Fargo branch ignores them for win determination.
  const homeWinThresholdForVerifier = startPointsFor === 'home' ? startPoints : 0;
  const awayWinThresholdForVerifier = startPointsFor === 'away' ? startPoints : 0;

  return (
    <div className="bg-white border-b shadow-sm flex-shrink-0">
      <div className="px-4 py-2">
        {allGamesComplete && (
          <MatchEndVerification
            matchId={match.id}
            homeTeamId={match.home_team_id}
            awayTeamId={match.away_team_id}
            homeTeamName={match.home_team?.team_name || 'Home'}
            awayTeamName={match.away_team?.team_name || 'Away'}
            homeWins={homeGamesWon}
            awayWins={awayGamesWon}
            homeWinThreshold={homeWinThresholdForVerifier}
            awayWinThreshold={awayWinThresholdForVerifier}
            homeTieThreshold={null}
            awayTieThreshold={null}
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
          <InfoButton title="Points Scoring" className="mx-2">
            <p className="text-sm mb-2">
              <strong>How it works:</strong> The winner of each game earns a
              fixed point value. The loser earns a point for each ball they
              pocketed. Whoever has the most points after all games wins the
              match — games won are a secondary stat.
            </p>
            <p className="text-sm mb-2">
              <strong>Start points:</strong> The weaker team (by handicap)
              begins with a handicap credit added to their point total. Both
              captains agree on this value before the match starts.
            </p>
            <p className="text-sm">
              <strong>Player Stats:</strong> Tap either team card to expand
              the per-player breakdown.
            </p>
          </InfoButton>
          <div className="flex-1 text-center text-xs font-semibold text-green-900">
            AWAY
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <PointsTeamCard
            teamName={match.home_team?.team_name || 'Home'}
            isHome={true}
            points={homePoints}
            gamesWon={homeGamesWon}
            gamesLost={awayGamesWon}
            totalGames={totalScheduledGames}
            startPointsAwarded={startPointsFor === 'home' ? startPoints : 0}
            lineup={homeLineup}
            showPlayerStats={showPlayerStats}
            onTogglePlayerStats={() => setShowPlayerStats(!showPlayerStats)}
            getPlayerDisplayName={getPlayerDisplayName}
            getPlayerStats={getPlayerStats}
            getPlayerPoints={getPlayerPoints}
            isUserTeam={isHomeTeam}
            onSwapPlayer={onSwapPlayer}
          />
          <PointsTeamCard
            teamName={match.away_team?.team_name || 'Away'}
            isHome={false}
            points={awayPoints}
            gamesWon={awayGamesWon}
            gamesLost={homeGamesWon}
            totalGames={totalScheduledGames}
            startPointsAwarded={startPointsFor === 'away' ? startPoints : 0}
            lineup={awayLineup}
            showPlayerStats={showPlayerStats}
            onTogglePlayerStats={() => setShowPlayerStats(!showPlayerStats)}
            getPlayerDisplayName={getPlayerDisplayName}
            getPlayerStats={getPlayerStats}
            getPlayerPoints={getPlayerPoints}
            isUserTeam={!isHomeTeam}
            onSwapPlayer={onSwapPlayer}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Per-team card for the 10-7 scoreboard.
 *
 * Kept private to this file for now. If a second points-based scoring
 * pattern lands (different head-start semantics, different point
 * accumulation rules), this may graduate into its own file and become
 * the first reuse point. Until then: colocated with its consumer.
 */
interface PointsTeamCardProps {
  teamName: string;
  isHome: boolean;
  /** Running total points for this team, already including start-points credit. */
  points: number;
  /** Games this team has won. */
  gamesWon: number;
  /** Games this team has lost (equal to opponent's confirmed wins). */
  gamesLost: number;
  /** Total scheduled games for this match. */
  totalGames: number;
  /** Start-points credit this team received (0 if none). Shown in the
   *  drawer's team-summary HC column. */
  startPointsAwarded: number;
  lineup: Lineup;
  showPlayerStats: boolean;
  onTogglePlayerStats: () => void;
  getPlayerDisplayName: (playerId: string) => string;
  getPlayerStats: PlayerStatsGetter;
  getPlayerPoints: PlayerPointsGetter;
  isUserTeam: boolean;
  onSwapPlayer?: (playerId: string, position: number) => void;
}

function PointsTeamCard({
  teamName,
  isHome,
  points,
  gamesWon,
  gamesLost,
  totalGames,
  startPointsAwarded,
  lineup,
  showPlayerStats,
  onTogglePlayerStats,
  getPlayerDisplayName,
  getPlayerStats,
  getPlayerPoints,
  isUserTeam,
  onSwapPlayer,
}: PointsTeamCardProps) {
  const colors = getTeamColors(isHome);

  const players = [
    { id: lineup.player1_id, handicap: lineup.player1_handicap, position: 1 },
    { id: lineup.player2_id, handicap: lineup.player2_handicap, position: 2 },
    { id: lineup.player3_id, handicap: lineup.player3_handicap, position: 3 },
    { id: lineup.player4_id, handicap: lineup.player4_handicap, position: 4 },
    { id: lineup.player5_id, handicap: lineup.player5_handicap, position: 5 },
  ].filter((p) => p.id);

  return (
    <Card className={`${colors.border} ${colors.bg} p-0`}>
      <div className="text-sm p-2">
        <button
          onClick={onTogglePlayerStats}
          className={`text-base font-bold ${colors.headerText} text-center truncate border-b ${colors.borderDark} pb-1 w-full`}
        >
          {teamName}
        </button>

        {/* Primary race metric: total points. Big, centered. */}
        <div className="flex flex-col items-center pt-2">
          <div className={`font-semibold ${colors.accentText} text-3xl`}>
            {points}
          </div>
          <div className="text-gray-600 text-xs mt-0.5">Points</div>
        </div>

        {/* Secondary stat: games won out of scheduled. */}
        <div className="flex justify-center items-center pt-2 pb-2 gap-1">
          <span className="font-semibold text-gray-700 text-lg">
            {gamesWon}
          </span>
          <span className="text-gray-500 text-sm">/</span>
          <span className="font-semibold text-gray-500 text-sm">
            {totalGames}
          </span>
          <span className="text-gray-600 text-xs ml-1">Games Won</span>
        </div>

        {/* Collapsible player stats. Grid: HC / Name / W / L / P.
            Team summary row uses HC column for start-points credit, W/L for
            team totals, P for team points (matches the big Points above). */}
        {showPlayerStats && (
          <div className={`pt-2 border-t ${colors.borderDark}`}>
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-2 text-xs">
              <div className="font-semibold text-gray-600">HC</div>
              <div className="font-semibold text-gray-600">Name</div>
              <div className="font-semibold text-gray-600 text-center">W</div>
              <div className="font-semibold text-gray-600 text-center">L</div>
              <div className="font-semibold text-gray-600 text-center">P</div>

              {/* Team summary row — HC shows the start-points handicap credit
                  this team received (0 when none), not a rating sum. */}
              <div className="font-semibold text-gray-900">
                {startPointsAwarded}
              </div>
              <div className="font-semibold text-gray-900 truncate">
                <TeamNameLink teamId={lineup.team_id} teamName={teamName} />
              </div>
              <div className="font-semibold text-gray-900 text-center">
                {gamesWon}
              </div>
              <div className="font-semibold text-gray-900 text-center">
                {gamesLost}
              </div>
              <div className="font-semibold text-gray-900 text-center">
                {points}
              </div>

              {players.map((player) => {
                const stats = getPlayerStats(player.id!, player.position, isHome);
                const playerPoints = getPlayerPoints(
                  player.id!,
                  player.position,
                  isHome
                );
                const canSwap =
                  isUserTeam && stats.wins === 0 && stats.losses === 0 && onSwapPlayer;
                const swapAction = canSwap
                  ? [
                      {
                        label: 'Swap Player',
                        icon: <UserRoundPen className="h-4 w-4 text-purple-600" />,
                        onClick: () =>
                          onSwapPlayer(player.id!, player.position),
                        className:
                          'flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-100 transition-colors text-left text-purple-600',
                      },
                    ]
                  : [];

                return (
                  <div key={`${player.id}-${player.position}`} className="contents">
                    <div className="text-gray-700">{player.handicap}</div>
                    <div className="truncate">
                      <PlayerNameLink
                        playerId={player.id!}
                        playerName={getPlayerDisplayName(player.id!)}
                        customActions={swapAction}
                      />
                    </div>
                    <div className="text-center text-gray-700">{stats.wins}</div>
                    <div className="text-center text-gray-700">{stats.losses}</div>
                    <div className="text-center text-gray-700">{playerPoints}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
