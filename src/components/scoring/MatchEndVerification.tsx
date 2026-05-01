/**
 * @fileoverview Match End Verification Component
 *
 * Replaces the scoreboard header area when all games are complete.
 * Shows match result and verification status for both teams.
 * Both teams must verify scores before auto-navigating to dashboard.
 *
 * Features:
 * - Match result summary (Home X - Y Away, Win/Tie status)
 * - Verification status indicators for both teams
 * - "Verify Scores" button (enabled only for user's team)
 * - Auto-navigate to dashboard when both teams verify
 */

import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useMatchLineups, useMatchGames, useMatchWithLeagueSettings } from '@/api/hooks/useMatches';
import { useCreateMatchGames, useUpdateMatchGame, useUpdateMatch } from '@/api/hooks/useMatchMutations';
import { useUpdateMatchLineup } from '@/api/hooks';
import { useResolvedLeaguePrefs } from '@/api/hooks/useResolvedLeaguePrefs';
import { calculatePoints, calculateBCAPoints } from '@/types/match';
import { calculateFargoMatchTotals } from '@/utils/fargoMatchTotals';
import { logger } from '@/utils/logger';

interface MatchEndVerificationProps {
  /** Match ID */
  matchId: string;
  /** Home team ID */
  homeTeamId: string;
  /** Away team ID */
  awayTeamId: string;
  /** Home team name */
  homeTeamName: string;
  /** Away team name */
  awayTeamName: string;
  /** Home team wins count */
  homeWins: number;
  /** Away team wins count */
  awayWins: number;
  /** Home team win threshold */
  homeWinThreshold: number;
  /** Away team win threshold */
  awayWinThreshold: number;
  /** Home team tie threshold (null for formats without ties) */
  homeTieThreshold: number | null;
  /** Away team tie threshold (null for formats without ties) */
  awayTieThreshold: number | null;
  /** Member ID who verified for home team (null if not verified) */
  homeVerifiedBy: string | null;
  /** Member ID who verified for away team (null if not verified) */
  awayVerifiedBy: string | null;
  /** Is current user on home team? */
  isHomeTeam: boolean;
  /** Handler when user clicks verify */
  onVerify: () => void;
  /** Is verification in progress? */
  isVerifying?: boolean;
  /** Game type for tiebreaker games (eight_ball, nine_ball, ten_ball) */
  gameType: string;
}

/**
 * Determine match result from scores and thresholds
 */
function determineMatchResult(
  homeWins: number,
  awayWins: number,
  homeWinThreshold: number,
  awayWinThreshold: number,
  homeTieThreshold: number | null,
  awayTieThreshold: number | null
): 'home_win' | 'away_win' | 'tie' {
  // Check for wins first
  if (homeWins >= homeWinThreshold) {
    return 'home_win';
  }
  if (awayWins >= awayWinThreshold) {
    return 'away_win';
  }

  // Check for tie (only if thresholds exist)
  if (
    homeTieThreshold !== null &&
    awayTieThreshold !== null &&
    homeWins === homeTieThreshold &&
    awayWins === awayTieThreshold
  ) {
    return 'tie';
  }

  // Shouldn't happen if all games are complete
  return 'tie';
}

/**
 * Match end verification component
 * Replaces header area when all games are complete
 */
export function MatchEndVerification({
  matchId,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  homeWins,
  awayWins,
  homeWinThreshold,
  awayWinThreshold,
  homeTieThreshold,
  awayTieThreshold,
  homeVerifiedBy,
  awayVerifiedBy,
  isHomeTeam,
  onVerify,
  isVerifying = false,
  gameType,
}: MatchEndVerificationProps) {
  const navigate = useNavigate();
  const updateMatchMutation = useUpdateMatch();
  const createGamesMutation = useCreateMatchGames();
  const updateLineupMutation = useUpdateMatchLineup();
  const updateGameMutation = useUpdateMatchGame(matchId);

  // Fetch match data for fresh verification status
  const matchQuery = useMatchWithLeagueSettings(matchId);
  const match = matchQuery.data;

  // Detect team format (5v5 vs 3v3)
  const teamFormat = match?.league?.team_format || '5_man';
  const is5v5 = teamFormat === '8_man';

  // Unit 12: Fargo matches use a different completion math than BCA.
  // handicap_type is resolved through the league preferences cascade.
  const { data: leaguePrefs } = useResolvedLeaguePrefs(match?.league?.id);
  const handicapType = leaguePrefs?.handicap_type ?? 'points';
  const isFargoMatch = handicapType === 'fargo';
  // Prefer the match-level snapshot (tier 3 frozen at first scoring event)
  // over live league overrides so completion math matches what was live
  // while the match was being played.
  const fargoOverrides = match?.system_snapshot?.overrides
    ?? leaguePrefs?.system_overrides
    ?? {};

  // Fetch lineups to get lineup IDs for unlocking
  const lineupsQuery = useMatchLineups(matchId, homeTeamId, awayTeamId, false);
  const homeLineup = lineupsQuery.data?.homeLineup;
  const awayLineup = lineupsQuery.data?.awayLineup;

  // Fetch tiebreaker games (if this is a tiebreaker)
  const gamesQuery = useMatchGames(matchId);
  const tiebreakerGames = (gamesQuery.data || []).filter(g => g.is_tiebreaker);
  const isTiebreakerMode = tiebreakerGames.length > 0;

  const [isCompleting, setIsCompleting] = useState(false);
  const completionStartedRef = useRef(false);

  // For BCA systems we use thresholds to determine the result (may be a
  // tie triggering the tiebreaker flow). For Fargo matches we replace this
  // later with the cascade winner from fargo5v5.scoring.computeMatchResult
  // — Fargo 5v5 never produces a true tie.
  const bcaResult = determineMatchResult(
    homeWins,
    awayWins,
    homeWinThreshold,
    awayWinThreshold,
    homeTieThreshold,
    awayTieThreshold
  );

  // Get fresh match data to access tiebreaker verification columns
  const freshMatch = matchQuery.data;

  // Use appropriate verification columns based on mode
  // Tiebreaker mode: use home_tiebreaker_verified_by / away_tiebreaker_verified_by
  // Regular mode: use home_team_verified_by / away_team_verified_by
  const homeVerifiedBy_actual = isTiebreakerMode
    ? (freshMatch?.home_tiebreaker_verified_by ?? null)
    : homeVerifiedBy;
  const awayVerifiedBy_actual = isTiebreakerMode
    ? (freshMatch?.away_tiebreaker_verified_by ?? null)
    : awayVerifiedBy;

  const homeVerified = homeVerifiedBy_actual !== null;
  const awayVerified = awayVerifiedBy_actual !== null;
  const bothVerified = homeVerified && awayVerified;

  // Reset completion ref if verifications are cleared
  if (!bothVerified && completionStartedRef.current) {
    completionStartedRef.current = false;
  }

  // Current user's team verification status
  const userTeamVerified = isHomeTeam ? homeVerified : awayVerified;

  // Convert games array to Map for calculatePoints function
  const gameResultsMap = new Map(
    (gamesQuery.data || []).map((game) => [game.game_number, game])
  );

  // Calculate points using the SAME function as the scoreboard (single source of truth)
  const homeThresholds = {
    games_to_win: homeWinThreshold,
    games_to_tie: homeTieThreshold,
    games_to_lose: homeTieThreshold !== null ? homeTieThreshold - 1 : homeWinThreshold - 1,
  };
  const awayThresholds = {
    games_to_win: awayWinThreshold,
    games_to_tie: awayTieThreshold,
    games_to_lose: awayTieThreshold !== null ? awayTieThreshold - 1 : awayWinThreshold - 1,
  };

  // Fargo matches compute totals via the fargo5v5 module (includes
  // start-points credit + per-game winner/loser points derived from the
  // snapshotted dials). BCA matches keep the existing calculation.
  const fargoTotals = isFargoMatch
    ? calculateFargoMatchTotals({
        homeTeamId,
        awayTeamId,
        homeGamesToWin: match?.home_games_to_win ?? 0,
        awayGamesToWin: match?.away_games_to_win ?? 0,
        gameResults: gameResultsMap,
        overrides: fargoOverrides,
      })
    : null;

  // Use BCA points for 5v5, regular points for 3v3, Fargo points for fargo.
  const homePoints = fargoTotals
    ? fargoTotals.homePoints
    : is5v5
      ? calculateBCAPoints(homeTeamId, homeThresholds, gameResultsMap)
      : calculatePoints(homeTeamId, homeThresholds, gameResultsMap);
  const awayPoints = fargoTotals
    ? fargoTotals.awayPoints
    : is5v5
      ? calculateBCAPoints(awayTeamId, awayThresholds, gameResultsMap)
      : calculatePoints(awayTeamId, awayThresholds, gameResultsMap);

  // Final result. Fargo uses the points → games-won cascade (always
  // decisive); BCA uses the threshold-based determination (may be 'tie'
  // which triggers the tiebreaker flow).
  const result: 'home_win' | 'away_win' | 'tie' = fargoTotals
    ? fargoTotals.winner === 'home' ? 'home_win' : 'away_win'
    : bcaResult;

  // Auto-complete match when both teams verify
  useEffect(() => {
    if (!bothVerified || isCompleting || completionStartedRef.current) return;

    const completeTheMatch = async () => {
      completionStartedRef.current = true;
      setIsCompleting(true);

      try {
        // Step 1: Fetch fresh match data to see who verified FIRST
        const { data: freshMatch } = await matchQuery.refetch();

        if (!freshMatch) {
          throw new Error('Failed to fetch match verification status');
        }

        // Determine which team verified FIRST (their timestamp in DB came first)
        // The first verifier's device will handle database operations
        // Use appropriate verification columns based on mode
        const homeVerifiedFirst = isTiebreakerMode
          ? (freshMatch.home_tiebreaker_verified_by === homeVerifiedBy_actual)
          : (freshMatch.home_team_verified_by === homeVerifiedBy);
        const awayVerifiedFirst = isTiebreakerMode
          ? (freshMatch.away_tiebreaker_verified_by === awayVerifiedBy_actual)
          : (freshMatch.away_team_verified_by === awayVerifiedBy);
        const isFirstVerifier = (isHomeTeam && homeVerifiedFirst) || (!isHomeTeam && awayVerifiedFirst);

        // Step 2: Only FIRST verifier updates match and creates games
        if (isFirstVerifier) {

          // Calculate completion data
          const winnerTeamId =
            result === 'home_win' ? homeTeamId :
            result === 'away_win' ? awayTeamId :
            null; // tie

          // For tiebreaker: only update winner/verification, NOT scores/points
          // For regular match: update everything
          const updates = isTiebreakerMode
            ? {
                // Tiebreaker: only update result and verification fields
                winner_team_id: winnerTeamId,
                match_result: result,
                results_confirmed_by_home: true,
                results_confirmed_by_away: true,
                completed_at: new Date().toISOString(),
                status: winnerTeamId ? 'completed' : 'in_progress',
              }
            : isFargoMatch
              ? {
                  // Fargo match (Unit 12): team_score is the Fargo point total
                  // (includes start-points credit + per-game winner/loser
                  // points). points_earned mirrors team_score — same unit,
                  // meaningful to the system. games_won is the raw game
                  // count home/away won. No tie possible in Fargo 5v5.
                  home_team_score: homePoints,
                  away_team_score: awayPoints,
                  home_games_won: homeWins,
                  away_games_won: awayWins,
                  home_points_earned: homePoints,
                  away_points_earned: awayPoints,
                  winner_team_id: winnerTeamId,
                  match_result: result,
                  results_confirmed_by_home: true,
                  results_confirmed_by_away: true,
                  completed_at: new Date().toISOString(),
                  status: 'completed', // Fargo always has a decisive winner
                }
              : {
                  // BCA regular match: update scores, points, result, and verification
                  home_team_score: homeWins,
                  away_team_score: awayWins,
                  home_games_won: homeWins,
                  away_games_won: awayWins,
                  home_points_earned: homePoints,
                  away_points_earned: awayPoints,
                  winner_team_id: winnerTeamId,
                  match_result: result,
                  results_confirmed_by_home: true,
                  results_confirmed_by_away: true,
                  completed_at: new Date().toISOString(),
                  status: winnerTeamId ? 'completed' : 'in_progress',
                };

          await updateMatchMutation.mutateAsync({
            matchId,
            updates,
          });

          // Anti-sandbagging rule for tiebreaker: Override all game results with winning team
          if (isTiebreakerMode && winnerTeamId) {

            // Get the winning lineup
            const winningLineup = winnerTeamId === homeTeamId ? homeLineup : awayLineup;

            if (winningLineup) {
              // Override all 3 tiebreaker games (19, 20, 21) with winning team's players
              for (let gameNumber = 19; gameNumber <= 21; gameNumber++) {
                const position = gameNumber - 18;
                const game = tiebreakerGames.find(g => g.game_number === gameNumber);

                if (!game) {
                  logger.error('Tiebreaker game not found', { gameNumber });
                  continue;
                }

                const winningPlayerId = winningLineup[`player${position}_id` as keyof typeof winningLineup];

                await updateGameMutation.mutateAsync({
                  gameId: game.id,
                  updates: {
                    winner_team_id: winnerTeamId,
                    winner_player_id: winningPlayerId,
                    confirmed_by_home: homeVerifiedBy,
                    confirmed_by_away: awayVerifiedBy,
                  },
                });
              }
            }
          }

          // Handle tie result - create tiebreaker games
          if (result === 'tie') {

            // Create 3 tiebreaker games
            await createGamesMutation.mutateAsync({
              games: [
                {
                  match_id: matchId,
                  game_number: 19,
                  home_action: 'breaks',
                  away_action: 'racks',
                  is_tiebreaker: true,
                  game_type: gameType,
                },
                {
                  match_id: matchId,
                  game_number: 20,
                  home_action: 'racks',
                  away_action: 'breaks',
                  is_tiebreaker: true,
                  game_type: gameType,
                },
                {
                  match_id: matchId,
                  game_number: 21,
                  home_action: 'breaks',
                  away_action: 'racks',
                  is_tiebreaker: true,
                  game_type: gameType,
                },
              ],
            });

            // Unlock both lineups
            if (homeLineup?.id) {
              await updateLineupMutation.mutateAsync({
                lineupId: homeLineup.id,
                updates: { locked: false, locked_at: null },
                matchId,
              });
            }
            if (awayLineup?.id) {
              await updateLineupMutation.mutateAsync({
                lineupId: awayLineup.id,
                updates: { locked: false, locked_at: null },
                matchId,
              });
            }

            // Wait for database writes to complete and propagate
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }

        // Step 3: ALL devices (first verifier and second verifier) MUST verify data before navigating
        if (result === 'tie') {
          // STEP 3A: Poll for tiebreaker games to exist
          let gamesReady = false;
          let attempts = 0;
          const maxAttempts = 20; // 20 attempts = 10 seconds max

          while (!gamesReady && attempts < maxAttempts) {
            const { data: checkGames } = await gamesQuery.refetch();
            const tiebreakerGamesCount = (checkGames || []).filter(g => g.is_tiebreaker).length;

            if (tiebreakerGamesCount >= 3) {
              gamesReady = true;
            } else {
              attempts++;
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }

          if (!gamesReady) {
            throw new Error('Timeout waiting for tiebreaker games to be created');
          }

          // STEP 3B: Poll for both lineups to be unlocked
          let lineupsUnlocked = false;
          attempts = 0;

          while (!lineupsUnlocked && attempts < maxAttempts) {
            const { data: checkLineups } = await lineupsQuery.refetch();

            if (checkLineups?.homeLineup &&
                checkLineups?.awayLineup &&
                !checkLineups.homeLineup.locked &&
                !checkLineups.awayLineup.locked) {
              lineupsUnlocked = true;
            } else {
              attempts++;
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }

          if (!lineupsUnlocked) {
            throw new Error('Timeout waiting for lineups to be unlocked');
          }

          // STEP 3C: Final cache propagation delay
          await new Promise(resolve => setTimeout(resolve, 500));

          // Navigate to lineup page
          setIsCompleting(false); // Reset completing state before navigation
          navigate(`/match/${matchId}/lineup`);
        } else {
          // Match has a winner - navigate to dashboard
          navigate('/dashboard');
        }
      } catch (error) {
        logger.error('Failed to complete match', { error: error instanceof Error ? error.message : String(error) });
        setIsCompleting(false);
        // Stay on page to allow retry
      }
    };

    completeTheMatch();
  }, [bothVerified, isCompleting, matchId, homeTeamId, awayTeamId, homeWins, awayWins, homePoints, awayPoints, result, updateMatchMutation, createGamesMutation, gameType, navigate, homeVerifiedBy, awayVerifiedBy, isTiebreakerMode, tiebreakerGames, homeLineup, awayLineup, updateGameMutation, updateLineupMutation]);

  return (
    <div className="bg-gradient-to-r from-blue-50 to-orange-50 border-b-2 border-border">
      <div className="px-4 py-3">
        {/* Match Result Header */}
        <div className="text-center mb-3">
          <div className="text-sm font-semibold text-muted-foreground">
            Match Complete
          </div>
          {result === 'home_win' && (
            <div className="text-lg font-bold text-blue-600 mt-1">
              Home Team Wins!
            </div>
          )}
          {result === 'away_win' && (
            <div className="text-lg font-bold text-orange-600 mt-1">
              Away Team Wins!
            </div>
          )}
        </div>

        {/* Score Table */}
        <div className="bg-card rounded-lg shadow-sm mb-3 overflow-hidden">
          {/* Header Row */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-xs font-semibold bg-muted px-3 py-2 border-b">
            <div>Team</div>
            <div className="text-center w-16">Score</div>
            <div className="text-center w-16">Points</div>
            <div className="w-12"></div>
          </div>

          {/* Home Team Row */}
          <div
            className={`grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2 border-b ${
              result === 'home_win' ? 'bg-blue-50' : ''
            }`}
          >
            <div
              className={`truncate ${
                result === 'home_win'
                  ? 'text-lg font-bold text-blue-600'
                  : 'font-medium'
              }`}
            >
              {homeTeamName}
            </div>
            <div
              className={`text-center w-16 ${
                result === 'home_win'
                  ? 'text-lg font-bold text-blue-600'
                  : 'font-medium'
              }`}
            >
              {homeWins}
            </div>
            <div
              className={`text-center w-16 ${
                result === 'home_win'
                  ? 'text-lg font-bold text-blue-600'
                  : 'font-medium'
              }`}
            >
              {homePoints}
            </div>
            <div className="w-12 text-center">
              {result === 'home_win' && <span className="text-xl">🏆</span>}
            </div>
          </div>

          {/* Away Team Row */}
          <div
            className={`grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2 ${
              result === 'away_win' ? 'bg-orange-50' : ''
            }`}
          >
            <div
              className={`truncate ${
                result === 'away_win'
                  ? 'text-lg font-bold text-blue-600'
                  : 'font-medium'
              }`}
            >
              {awayTeamName}
            </div>
            <div
              className={`text-center w-16 ${
                result === 'away_win'
                  ? 'text-lg font-bold text-blue-600'
                  : 'font-medium'
              }`}
            >
              {awayWins}
            </div>
            <div
              className={`text-center w-16 ${
                result === 'away_win'
                  ? 'text-lg font-bold text-blue-600'
                  : 'font-medium'
              }`}
            >
              {awayPoints}
            </div>
            <div className="w-12 text-center">
              {result === 'away_win' && <span className="text-xl">🏆</span>}
            </div>
          </div>

          {/* Tie Message (if applicable) */}
          {result === 'tie' && (
            <div className="bg-purple-50 px-3 py-2 text-center">
              <span className="text-sm font-bold text-purple-600">
                TIEBREAKER REQUIRED
              </span>
            </div>
          )}
        </div>

        {/* Verification Status */}
        {!bothVerified && (
          <div className="space-y-3 w-full">
            {/* Status Flags Row */}
            <div className="flex items-center justify-around text-sm w-full">
              <div
                className={`font-medium ${
                  homeVerified ? 'text-green-600' : 'text-muted-foreground'
                }`}
              >
                Home: {homeVerified ? '✅ Verified' : '⏳ Waiting'}
              </div>
              <div
                className={`font-medium ${
                  awayVerified ? 'text-green-600' : 'text-muted-foreground'
                }`}
              >
                Away: {awayVerified ? '✅ Verified' : '⏳ Waiting'}
              </div>
            </div>

            {/* Verify Button Row */}
            <div className="text-center">
              <Button
                onClick={onVerify}
                disabled={userTeamVerified || isVerifying}
                size="default"
                className="w-full max-w-xs"
                isLoading={isVerifying}
                loadingText="Verifying..."
              >
                {isVerifying
                  ? 'Verifying...'
                  : userTeamVerified
                  ? '✓ You Have Verified'
                  : 'Verify Scores'}
              </Button>
            </div>
          </div>
        )}

        {/* Both Verified Message */}
        {bothVerified && (
          <div className="text-center text-sm font-medium text-green-600">
            {isCompleting
              ? result === 'tie'
                ? '✓ Both teams verified - Setting up tiebreaker...'
                : '✓ Both teams verified - Completing match...'
              : '✓ Both teams verified - Returning to dashboard...'
            }
          </div>
        )}
      </div>
    </div>
  );
}
