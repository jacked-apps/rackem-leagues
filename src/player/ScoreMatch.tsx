/**
 * @fileoverview Score Match Page - 3v3 Match Scoring
 *
 * Mobile-first scoring page for 3v3 pool league matches.
 * Displays compact scoreboard with swipe navigation between teams.
 * Allows players to score games, confirm results, and track match progress.
 *
 * Flow: Lineup Entry → Score Match → (Tiebreaker if needed)
 *
 * Features:
 * - Compact scoreboard (top 1/3 of screen) with swipe left/right
 * - 18-game scoring with real-time updates
 * - Confirmation flow (both teams must agree)
 * - Break & Run (B&R) and Golden Break (8BB) tracking
 * - Match end detection with winner announcement
 */
//import { watchMatchAndGames } from '@/realtime/useMatchAndGamesRealtime';

import { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { useResolvedLeaguePrefs } from '@/api/hooks/useResolvedLeaguePrefs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useCurrentMember } from '@/api/hooks';
import { InfoButton } from '@/components/InfoButton';
import { LineupChangeModal } from '@/components/scoring/LineupChangeModal';
import { LineupChangeRequestModal } from '@/components/scoring/LineupChangeRequestModal';
import {
  requestLineupChange,
  approveLineupChange,
  denyLineupChange,
} from '@/api/mutations/matchLineups';
import { usePlayerHandicaps } from '@/api/hooks/usePlayerHandicaps';
// getAllGames no longer needed - all game data comes from database
import { getCompletedGamesCount } from '@/types/match';
import { useMatchScoring } from '@/hooks/useMatchScoring';
import { useMatchScoringMutations } from '@/hooks/useMatchScoringMutations';
import { getPlayerStatsByPosition } from '@/hooks/usePlayerStatsByPosition';
import { ScoringDialog } from '@/components/scoring/ScoringDialog';
import { ConfirmationDialog } from '@/components/scoring/ConfirmationDialog';
import { EditGameDialog } from '@/components/scoring/EditGameDialog';
import { ThreeVThreeScoreboard } from '@/components/scoring/ThreeVThreeScoreboard';
import { FiveVFiveScoreboard } from '@/components/scoring/FiveVFiveScoreboard';
import { TenSevenScoreboard } from '@/components/scoring/TenSevenScoreboard';
import { TiebreakerScoreboard } from '@/components/scoring/TiebreakerScoreboard';
import { GamesList } from '@/components/scoring/GamesList';
import { TableNumberBar } from '@/components/scoring/TableNumberBar';
import { queryKeys } from '@/api/queryKeys';
import { calculatePoints, getTeamStats, getPlayerStats as getPlayerStatsUtil } from '@/types';
import { calculateFargoMatchTotals } from '@/utils/fargoMatchTotals';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';

export function ScoreMatch() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: member } = useCurrentMember();
  const memberId = member?.id;

  // Auto-confirm setting (bypass confirmation modal)
  const [autoConfirm, setAutoConfirm] = useState(false);

  // Verification state
  const [isVerifying, setIsVerifying] = useState(false);

  // Ref to store mutations for use in real-time subscription
  const mutationsRef = useRef<any>(null);

  // Wait time for match preparation (give home team time to prepare)
  const [waitingForPreparation, setWaitingForPreparation] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 10; // Wait up to 10 seconds

  // Use central scoring hook (replaces all manual data fetching)
  const {
    match,
    homeLineup,
    awayLineup,
    gameResults,
    homeTeamHandicap,
    homeThresholds,
    awayThresholds,
    homeTeamRoster,
    awayTeamRoster,
    userTeamId,
    isHomeTeam,
    goldenBreakCountsAsWin,
    gameType,
    getPlayerDisplayName: getPlayerDisplayNameFromHook,
    confirmationQueue,
    addToConfirmationQueue: addToConfirmationQueueFromHook,
    removeFromConfirmationQueue,
    myVacateRequests,
    loading,
    error,
  } = useMatchScoring({
    matchId,
    memberId,
    matchType: '3v3',
    autoConfirm,
    confirmOpponentScore: async (gameNumber, isVacateRequest) => {
      // This will be called by real-time subscription when autoConfirm is enabled
      if (mutationsRef.current) {
        await mutationsRef.current.confirmOpponentScore(
          gameNumber,
          isVacateRequest
        );
      }
    },
  });

  // Get user's team roster from the hook (already fetched for both teams)
  const teamRoster = isHomeTeam ? homeTeamRoster : awayTeamRoster;

  // Get the user's lineup (home or away based on isHomeTeam)
  const userLineup = isHomeTeam ? homeLineup : awayLineup;
  const opponentLineup = isHomeTeam ? awayLineup : homeLineup;

  // Resolved preferences — lazy-migrates legacy leagues on first access
  const { data: leaguePrefs } = useResolvedLeaguePrefs(match?.league?.id);
  const handicapType = leaguePrefs?.handicap_type ?? 'points';

  // Get handicaps for roster players (for lineup change requests)
  const rosterPlayerIds = teamRoster.map((tp: any) => tp.member_id).filter(Boolean);
  const { handicaps: rosterHandicaps } = usePlayerHandicaps({
    playerIds: rosterPlayerIds,
    handicapType,
    handicapVariant: match?.league?.handicap_variant || 'standard',
    gameType: gameType,
    leagueId: match?.league?.id,
    matchId: matchId, // Per-match cache scoping - same handicaps as lineup page
  });

  // Lineup change mutations
  const requestLineupChangeMutation = useMutation({
    mutationFn: requestLineupChange,
    onSuccess: () => {
      toast.success('Lineup change request sent to opponent');
      setLineupChangeData(null);
      // Invalidate lineup queries to refresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.lineup(matchId!) });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to request lineup change');
    },
  });

  const approveLineupChangeMutation = useMutation({
    mutationFn: approveLineupChange,
    onSuccess: () => {
      toast.success('Lineup change approved');
      // Invalidate lineup queries to refresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.lineup(matchId!) });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to approve lineup change');
    },
  });

  const denyLineupChangeMutation = useMutation({
    mutationFn: denyLineupChange,
    onSuccess: () => {
      toast.info('Lineup change denied');
      // Invalidate lineup queries to refresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.lineup(matchId!) });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to deny lineup change');
    },
  });

  // Scoring modal state
  const [scoringGame, setScoringGame] = useState<{
    gameNumber: number;
    winnerTeamId: string;
    winnerPlayerId: string;
    winnerPlayerName: string;
    winnerWasScheduledBreaker: boolean;
  } | null>(null);
  const [breakAndRun, setBreakAndRun] = useState(false);
  const [goldenBreak, setGoldenBreak] = useState(false);
  // Unit 11b: configurable scoring fields. All default false/null; Fargo
  // matches require `loserBallsPocketed` before submit (0 is a valid pick).
  const [breakFouled, setBreakFouled] = useState(false);
  const [winByForfeit, setWinByForfeit] = useState(false);
  const [runout, setRunout] = useState(false);
  const [loserBallsPocketed, setLoserBallsPocketed] = useState<number | null>(null);

  // Opponent confirmation modal state
  const [confirmationGame, setConfirmationGame] = useState<{
    gameNumber: number;
    winnerPlayerName: string;
    breakAndRun: boolean;
    goldenBreak: boolean;
    breakFouled: boolean;
    runout: boolean;
    winByForfeit: boolean;
    loserBallsPocketed: number | null;
    isResetRequest?: boolean; // True if this is a request to reset the game
  } | null>(null);

  // Edit game modal state
  const [editingGame, setEditingGame] = useState<{
    gameNumber: number;
    currentWinnerName: string;
  } | null>(null);

  // Lineup change modal state
  const [lineupChangeData, setLineupChangeData] = useState<{
    playerId: string;
    playerName: string;
    position: number;
  } | null>(null);

  // Process confirmation queue when modal closes or queue changes
  useEffect(() => {
    // Only process queue when modal is closed
    if (!confirmationGame && confirmationQueue.length > 0) {
      // console.log(
      //   'Modal closed, processing queue. Queue length:',
      //   confirmationQueue.length
      // );
      const nextConfirmation = confirmationQueue[0];
      //console.log('Showing game', nextConfirmation.gameNumber, 'from queue');

      // Add delay to allow Dialog component to clean up properly
      // This prevents the grey screen overlay issue
      setTimeout(() => {
        setConfirmationGame(nextConfirmation);
        removeFromConfirmationQueue(); // Remove first item from queue
      }, 1000);
    }
  }, [confirmationGame, confirmationQueue, removeFromConfirmationQueue]); // Watch both - but queue updates won't replace modal


  // Detect when all games are complete (works for any format: 3, 18, 25, etc.)
  // Total games = count of games in database
  const totalGames = gameResults.size;
  const completedGames = getCompletedGamesCount(gameResults);
  const allGamesComplete = completedGames === totalGames;

  // Debug: Log team identification and verification status
  // useEffect(() => {
  //   console.log('Match data updated with verification columns:', {
  //     matchId: match?.id,
  //     homeVerifiedBy: (match as any)?.home_team_verified_by,
  //     awayVerifiedBy: (match as any)?.away_team_verified_by,
  //   });
  // }, [match]);

  // Track previous allGamesComplete state to detect changes
  const prevAllGamesCompleteRef = useRef(allGamesComplete);

  // Save thresholds and handle verification when match completes/uncompletes
  // Note: gameResults is intentionally excluded - we only want this to trigger on completion state changes,
  // not on every game update. The gameResults check is a secondary validation for tiebreaker detection.
  useEffect(() => {
    const wasComplete = prevAllGamesCompleteRef.current;
    const isComplete = allGamesComplete;

    // If changed from incomplete to complete, save thresholds to database
    if (!wasComplete && isComplete && matchId && homeThresholds && awayThresholds) {
      supabase
        .from('matches')
        .update({
          home_to_win: homeThresholds.games_to_win,
          home_to_tie: homeThresholds.games_to_tie,
          away_to_win: awayThresholds.games_to_win,
          away_to_tie: awayThresholds.games_to_tie,
        })
        .eq('id', matchId)
        .then(({ error }) => {
          if (error) {
            logger.error('Error saving thresholds', { error: error.message });
          }
        });
    }

    // If changed from complete to incomplete, clear verification
    // BUT: Don't clear if tiebreaker games exist (this is the tiebreaker flow, not a vacate)
    if (wasComplete && !isComplete && matchId) {
      // Check if there are tiebreaker games
      const tiebreakerGames = Array.from(gameResults.values()).filter(g => g.is_tiebreaker);
      const hasTiebreakerGames = tiebreakerGames.length > 0;

      if (!hasTiebreakerGames) {
        supabase
          .from('matches')
          .update({
            home_team_verified_by: null,
            away_team_verified_by: null,
          })
          .eq('id', matchId)
          .then(({ error }) => {
            if (error) {
              logger.error('Error clearing verification status', { error: error.message });
            }
          });
      }
    }

    // Update ref for next comparison
    prevAllGamesCompleteRef.current = isComplete;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allGamesComplete, matchId, homeThresholds, awayThresholds]);

  /**
   * Handle verify button click
   * Updates the appropriate verification column based on user's team
   * Uses optimistic update and refetch to update UI immediately
   */
  const handleVerify = async () => {
    if (!matchId || !memberId || isHomeTeam === null) {
      return;
    }

    setIsVerifying(true);

    try {
      // Detect if this is a tiebreaker by checking for tiebreaker games
      const tiebreakerGames = Array.from(gameResults.values()).filter(g => g.is_tiebreaker);
      const isTiebreakerMode = tiebreakerGames.length > 0;

      // Use appropriate verification column based on mode
      const updateField = isTiebreakerMode
        ? (isHomeTeam ? 'home_tiebreaker_verified_by' : 'away_tiebreaker_verified_by')
        : (isHomeTeam ? 'home_team_verified_by' : 'away_team_verified_by');

      // Optimistically update the UI immediately
      const queryKey = [...queryKeys.matches.detail(matchId), 'leagueSettings'];

      queryClient.setQueryData(queryKey, (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          [updateField]: memberId,
        };
      });

      // Update database
      const { error } = await supabase
        .from('matches')
        .update({ [updateField]: memberId })
        .eq('id', matchId);

      if (error) throw error;

      // Don't refetch - realtime subscription will handle it for all users
      // This prevents race condition where refetch gets stale data
    } catch (err: any) {
      logger.error('Error verifying scores', { error: err instanceof Error ? err.message : String(err) });
      toast.error(`Failed to verify scores: ${err.message}`);
      // Rollback optimistic update on error
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.matches.detail(matchId), 'leagueSettings'],
      });
    } finally {
      setIsVerifying(false);
    }
  };

  /**
   * Get display name for a player (nickname or first name)
   * Uses function from useMatchScoring hook
   */
  const getPlayerDisplayName = getPlayerDisplayNameFromHook;

  /**
   * Get player stats (wins/losses) for a specific player and position
   * For 5v5: Filters by position to handle double duty players correctly
   * For 3v3: Position parameter ignored (uses getPlayerStatsUtil)
   *
   * @param playerId - Player's member ID
   * @param position - Lineup position (1-5) for 5v5
   * @param playerIsHomeTeam - Whether this specific player is on home team (true) or away team (false)
   */
  const getPlayerStats = (playerId: string, position?: number, playerIsHomeTeam?: boolean) => {
    // For 5v5 with position specified, use position-aware function
    if (position !== undefined && leaguePrefs?.lineup_size === 5 && playerIsHomeTeam !== undefined) {
      return getPlayerStatsByPosition(playerId, position, playerIsHomeTeam, gameResults);
    }
    // For 3v3 or no position specified, use original util
    return getPlayerStatsUtil(playerId, gameResults);
  };

  /**
   * Add to confirmation queue (from useMatchScoring hook)
   */
  const addToConfirmationQueue = addToConfirmationQueueFromHook;

  // Stabilize the match shape passed to mutations + downstream realtime
  // hooks. Phase 5 Unit 5.5 introduced per-game writes to the matches
  // row (running-totals updates), which makes matchQuery refetch on
  // every confirmation. Without this memo, every refetch produces a
  // new `match` object identity → callback identities change → the
  // realtime hook resubscribes → same event re-fires → flashing loop.
  // The mutations hook only needs id + home_team_id + away_team_id;
  // memoize on those primitives so identity is stable across refetches
  // that don't change them.
  const stableMatchForMutations = useMemo(
    () =>
      match
        ? {
            id: match.id,
            home_team_id: match.home_team_id,
            away_team_id: match.away_team_id,
          }
        : null,
    [match?.id, match?.home_team_id, match?.away_team_id],
  );

  // Use mutations hook for all database operations
  const mutations = useMatchScoringMutations({
    match: stableMatchForMutations,
    leagueId: match?.league?.id ?? null,
    gameResults,
    homeLineup,
    awayLineup,
    userTeamId,
    memberId: memberId || null,
    // gameType,
    autoConfirm,
    addToConfirmationQueue,
    getPlayerDisplayName,
  });

  // Store mutations in ref for use in real-time subscription callback
  mutationsRef.current = mutations;

  /**
   * Handle player button click to score a game
   * Delegates to mutations hook
   */
  const handlePlayerClick = (
    gameNumber: number,
    playerId: string,
    playerName: string,
    teamId: string
  ) => {
    mutations.handlePlayerClick(
      gameNumber,
      playerId,
      playerName,
      teamId,
      (game) => {
        setScoringGame(game);
        setBreakAndRun(false);
        setGoldenBreak(false);
      },
      (gameNumber) => mutations.confirmOpponentScore(gameNumber)
    );
  };

  /**
   * Handle swap player action from scoreboard.
   * Opens modal to select replacement player and request lineup change.
   * Only available for players who haven't played any games yet (0 wins, 0 losses).
   *
   * @param playerId - The player ID to swap out
   * @param position - The lineup position (1-5) of the player
   */
  const handleSwapPlayer = (playerId: string, position: number) => {
    // Get the player name for display
    const playerName = getPlayerDisplayName(playerId);
    setLineupChangeData({ playerId, playerName, position });
  };

  /**
   * Handle lineup change request submission
   * Sends request to opponent for approval
   */
  const handleLineupChangeRequest = async (newPlayerId: string) => {
    if (!userLineup || !lineupChangeData) return;

    // Get the new player's handicap from the cached handicaps (calculated via usePlayerHandicaps)
    // This uses TanStack Query caching - likely already calculated from lineup page
    const newPlayerHandicap = rosterHandicaps.get(newPlayerId)?.value ?? 0;

    requestLineupChangeMutation.mutate({
      lineupId: userLineup.id,
      position: lineupChangeData.position,
      newPlayerId,
      newPlayerHandicap,
    });
  };

  /**
   * Handle approving opponent's lineup change request
   */
  const handleApproveLineupChange = () => {
    if (!opponentLineup) return;
    approveLineupChangeMutation.mutate(opponentLineup.id);
  };

  /**
   * Handle denying opponent's lineup change request
   */
  const handleDenyLineupChange = () => {
    if (!opponentLineup) return;
    denyLineupChangeMutation.mutate(opponentLineup.id);
  };

  // Auto-retry mechanism: Wait for match preparation to complete
  // MUST be before any early returns to comply with Rules of Hooks
  useEffect(() => {
    const dataReady = match && homeLineup && awayLineup && homeThresholds && awayThresholds;

    if (!dataReady && waitingForPreparation && retryCount < MAX_RETRIES) {
      const timer = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        // Invalidate queries to force refetch
        queryClient.invalidateQueries({ queryKey: ['match', matchId] });
      }, 1000); // Wait 1 second between retries

      return () => clearTimeout(timer);
    }

    if (dataReady && waitingForPreparation) {
      setWaitingForPreparation(false);
    }

    if (retryCount >= MAX_RETRIES) {
      setWaitingForPreparation(false);
    }
  }, [match, homeLineup, awayLineup, homeThresholds, awayThresholds, retryCount, waitingForPreparation, matchId, queryClient, MAX_RETRIES]);

  // Early returns for loading/error states
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-700">
            Loading match...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    // If lineups aren't locked, redirect to lineup page instead of showing error
    if (error.includes('lineups must be locked')) {
      navigate(`/match/${matchId}/lineup`);
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-700">
              Redirecting to lineup page...
            </div>
          </div>
        </div>
      );
    }

    // Show error for other types of errors
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-lg font-semibold text-red-600 mb-2">
                Error
              </div>
              <div className="text-gray-700 mb-4">{error}</div>
              <Button loadingText="none" onClick={() => navigate(-1)}>Go Back</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading screen while waiting for preparation
  if (waitingForPreparation && retryCount < MAX_RETRIES) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-700 mb-4">
            Preparing Match...
          </div>
          <div className="text-sm text-gray-600 mb-4">
            Setting up handicap thresholds and game order
          </div>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
          <div className="text-xs text-gray-500 mt-4">
            Attempt {retryCount + 1} of {MAX_RETRIES}
          </div>
        </div>
      </div>
    );
  }

  // After retries exhausted, show error if data still missing
  if (
    !match ||
    !homeLineup ||
    !awayLineup ||
    !homeThresholds ||
    !awayThresholds
  ) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-lg font-semibold text-red-600 mb-2">
                Match Preparation Failed
              </div>
              <div className="text-gray-600 mb-4">
                The match could not be prepared after {MAX_RETRIES} attempts.
              </div>
              <div className="text-sm text-gray-500 mb-4">
                {!match && <div>• Match data not loaded</div>}
                {!homeLineup && <div>• Home lineup not available</div>}
                {!awayLineup && <div>• Away lineup not available</div>}
                {!homeThresholds && <div>• Home thresholds not set</div>}
                {!awayThresholds && <div>• Away thresholds not set</div>}
              </div>
              <div className="text-xs text-gray-500 mb-4">
                This usually means the home team's lineup lock failed to prepare the match.
                Both teams should go back to lineup and try again.
              </div>
              <Button onClick={() => window.location.reload()} loadingText="none">Try Again</Button>
              <Button
                variant="outline"
                onClick={() => navigate(`/match/${matchId}/lineup`)}
                className="ml-2"
                loadingText="none"
              >
                Back to Lineup
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Filter games based on mode (normal vs tiebreaker)
  // Only switch to tiebreaker mode when ALL conditions are met:
  // 1. Match result is 'tie'
  // 2. Both lineups are locked (players selected)
  // 3. Tiebreaker games exist
  // This ensures MatchEndVerification stays mounted during tie verification
  const tiebreakerGamesExist = Array.from(gameResults.values()).some(g => g.is_tiebreaker);
  const bothLineupsLocked = homeLineup?.locked && awayLineup?.locked;
  const isTiebreakerMode = match.match_result === 'tie' && bothLineupsLocked && tiebreakerGamesExist;
  const filteredGameResults = isTiebreakerMode
    ? new Map(
        Array.from(gameResults.entries()).filter(([gameNumber]) =>
          gameNumber >= 19 && gameNumber <= 21
        )
      )
    : gameResults;

  // Detect lineup geometry. Phase 7 Unit 7.3: `team_format` was dropped
  // from the leagues schema; lineup size comes from the resolved
  // preferences. The 5v5 routing decision now reads `lineup_size === 5`
  // instead of the legacy `team_format === '8_man'` tag.
  const is5v5 = leaguePrefs?.lineup_size === 5;
  const winCondition = leaguePrefs?.win_condition ?? 'games';

  // Team stats (wins / losses) for the scoreboard.
  const homeStats = getTeamStats(match.home_team_id, filteredGameResults);
  const awayStats = getTeamStats(match.away_team_id, filteredGameResults);
  // Note: legacy `calculateBCAPoints` parallel computation removed —
  // FiveVFiveScoreboard now reads `match.home_points_earned` /
  // `match.away_points_earned` directly. Those columns are calculator-
  // correct via `computeMatchRunningTotals` (Phase 5 Unit 5.5).
  // The 3v3 scoreboard branch below still uses the legacy `calculatePoints`
  // helper; switching it over is a follow-up (covered in LIST_FOR_ED #18).

  // Fargo totals (Unit 12): for 5v5 Fargo matches, points are running Fargo
  // totals (per-game winner/loser points + start-points credit on the weaker
  // team) instead of BCA's capped points. Using the snapshotted overrides
  // when present so the dial values are frozen from first-scoring-event.
  const fargoOverrides = match.system_snapshot?.overrides
    ?? leaguePrefs?.system_overrides
    ?? {};
  const fargoTotals = handicapType === 'fargo'
    ? calculateFargoMatchTotals({
        homeTeamId: match.home_team_id,
        awayTeamId: match.away_team_id,
        homeGamesToWin: match.home_to_win ?? 0,
        awayGamesToWin: match.away_to_win ?? 0,
        gameResults: filteredGameResults,
        overrides: fargoOverrides,
      })
    : null;

  // Per-player running points for the 10-7 scoreboard drawer. Scoped per
  // lineup-slot (playerId + position) so double-duty shows up on both rows.
  // Only computed for Fargo matches; the BCA scoreboards don't use this.
  const fargoWinnerPoints =
    typeof fargoOverrides.winner_points === 'number'
      ? fargoOverrides.winner_points
      : 10;
  const getPlayerPoints = (
    playerId: string,
    position: number,
    playerIsHomeTeam: boolean,
  ): number => {
    let total = 0;
    for (const game of filteredGameResults.values()) {
      if (!game.winner_team_id) continue;
      const positionField = playerIsHomeTeam ? game.home_position : game.away_position;
      const idField = playerIsHomeTeam ? game.home_player_id : game.away_player_id;
      if (idField !== playerId) continue;
      if (positionField !== position) continue;
      const teamId = playerIsHomeTeam ? match.home_team_id : match.away_team_id;
      if (game.winner_team_id === teamId) {
        total += fargoWinnerPoints;
      } else if (game.loser_balls_pocketed !== null && game.loser_balls_pocketed !== undefined) {
        total += game.loser_balls_pocketed;
      }
    }
    return total;
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header with back button, team name, and auto-confirm */}
      <div className="bg-white border-b px-4 py-2">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
          {/* Team Name */}
          <div className="text-lg font-semibold text-gray-800">
            {isHomeTeam ? match.home_team?.team_name : match.away_team?.team_name}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={autoConfirm}
                onChange={(e) => setAutoConfirm(e.target.checked)}
                className="w-3 h-3"
              />
              Auto-Confirm
            </label>
            <InfoButton title="Auto-Confirm Opponent Selections" className="relative">
              <p className="text-sm">
                By enabling this your opponents game result selections will automatically be confirmed for your team. Your team is still responsible for ensuring the scoring is accurate. This option simply removes the need to confirm each game individually.
              </p>
            </InfoButton>
          </div>
        </div>
      </div>

      {/* Table Number Bar - clickable to change. Also hosts the spectator
          icon(s) on the right side when we have a league ID. */}
      <TableNumberBar
        matchId={matchId!}
        tableNumber={match.assigned_table_number}
        spectatorLeagueId={match.league?.id ?? null}
      />

      {/* Scoreboard - Fixed at top.
          Routing: tiebreaker → TiebreakerScoreboard (isolated 3-game playoff).
                   points-accumulation systems (currently only Fargo) →
                     TenSevenScoreboard (generic — not Fargo-specific).
                   games-won-against-threshold systems → per-format scoreboard. */}
      {isTiebreakerMode ? (
        <TiebreakerScoreboard
          match={{
            ...match,
            home_team_verified_by: (match as any).home_team_verified_by ?? null,
            away_team_verified_by: (match as any).away_team_verified_by ?? null,
          }}
          gameResults={filteredGameResults}
          isHomeTeam={isHomeTeam ?? false}
          onVerify={handleVerify}
          isVerifying={isVerifying}
          gameType={gameType}
        />
      ) : handicapType === 'fargo' && fargoTotals && winCondition === 'points' ? (
        <TenSevenScoreboard
          match={{
            ...match,
            home_team_verified_by: (match as any).home_team_verified_by ?? null,
            away_team_verified_by: (match as any).away_team_verified_by ?? null,
          }}
          homeLineup={homeLineup}
          awayLineup={awayLineup}
          homePoints={fargoTotals.homePoints}
          awayPoints={fargoTotals.awayPoints}
          homeGamesWon={fargoTotals.homeGamesWon}
          awayGamesWon={fargoTotals.awayGamesWon}
          totalScheduledGames={filteredGameResults.size}
          startPoints={fargoTotals.startPointsApplied}
          startPointsFor={
            fargoTotals.startPointsFor === 'even' ? 'none' : fargoTotals.startPointsFor
          }
          allGamesComplete={allGamesComplete}
          isHomeTeam={isHomeTeam ?? false}
          onVerify={handleVerify}
          isVerifying={isVerifying}
          gameType={gameType}
          getPlayerDisplayName={getPlayerDisplayName}
          getPlayerStats={getPlayerStats}
          getPlayerPoints={getPlayerPoints}
          onSwapPlayer={handleSwapPlayer}
        />
      ) : is5v5 ? (
        <FiveVFiveScoreboard
          match={{
            ...match,
            home_team_verified_by: (match as any).home_team_verified_by ?? null,
            away_team_verified_by: (match as any).away_team_verified_by ?? null,
          }}
          homeLineup={homeLineup}
          awayLineup={awayLineup}
          homeThresholds={homeThresholds}
          awayThresholds={awayThresholds}
          homeWins={homeStats.wins}
          awayWins={awayStats.wins}
          homeLosses={homeStats.losses}
          awayLosses={awayStats.losses}
          homePoints={match.home_points_earned ?? 0}
          awayPoints={match.away_points_earned ?? 0}
          allGamesComplete={allGamesComplete}
          isHomeTeam={isHomeTeam ?? false}
          onVerify={handleVerify}
          isVerifying={isVerifying}
          gameType={gameType}
          getPlayerDisplayName={getPlayerDisplayName}
          getPlayerStats={getPlayerStats}
          onSwapPlayer={handleSwapPlayer}
        />
      ) : (
        <ThreeVThreeScoreboard
          match={{
            ...match,
            home_team_verified_by: (match as any).home_team_verified_by ?? null,
            away_team_verified_by: (match as any).away_team_verified_by ?? null,
          }}
          homeLineup={homeLineup}
          awayLineup={awayLineup}
          homeThresholds={homeThresholds}
          awayThresholds={awayThresholds}
          homeWins={homeStats.wins}
          awayWins={awayStats.wins}
          homeLosses={homeStats.losses}
          awayLosses={awayStats.losses}
          homePoints={calculatePoints(match.home_team_id, homeThresholds, filteredGameResults)}
          awayPoints={calculatePoints(match.away_team_id, awayThresholds, filteredGameResults)}
          homeTeamHandicap={homeTeamHandicap}
          allGamesComplete={allGamesComplete}
          isHomeTeam={isHomeTeam ?? false}
          onVerify={handleVerify}
          isVerifying={isVerifying}
          gameType={gameType}
          getPlayerDisplayName={getPlayerDisplayName}
          getPlayerStats={getPlayerStats}
          onSwapPlayer={handleSwapPlayer}
        />
      )}

      {/* Game list section - ALL data from database */}
      <GamesList
        gameResults={filteredGameResults}
        getPlayerDisplayName={getPlayerDisplayName}
        onGameClick={handlePlayerClick}
        onVacateClick={(gameNumber, winnerName) => {
          setEditingGame({
            gameNumber,
            currentWinnerName: winnerName,
          });
        }}
        onVacateRequestClick={(gameNumber, winnerName) => {
          // When opponent clicks "Vacate Request" button, open confirmation dialog.
          // Forward every scored field so the dialog can show the full detail.
          const game = gameResults.get(gameNumber);
          if (game) {
            setConfirmationGame({
              gameNumber,
              winnerPlayerName: winnerName,
              breakAndRun: game.break_and_run,
              goldenBreak: game.golden_break,
              breakFouled: game.break_fouled,
              runout: game.runout,
              winByForfeit: game.win_by_forfeit,
              loserBallsPocketed: game.loser_balls_pocketed,
              isResetRequest: true,
            });
          }
        }}
        homeTeamId={match.home_team_id}
        awayTeamId={match.away_team_id}
        totalGames={filteredGameResults.size}
        isHomeTeam={isHomeTeam}
      />

      {/* Win Confirmation Modal */}
      <ScoringDialog
        open={scoringGame !== null}
        game={scoringGame}
        breakAndRun={breakAndRun}
        goldenBreak={goldenBreak}
        goldenBreakCountsAsWin={goldenBreakCountsAsWin}
        gameType={gameType}
        handicapType={handicapType}
        pointsCalculator={
          (match?.system_snapshot as { points_calculator?: string | null } | null)
            ?.points_calculator ?? null
        }
        breakFouled={breakFouled}
        winByForfeit={winByForfeit}
        runout={runout}
        loserBallsPocketed={loserBallsPocketed}
        onBreakAndRunChange={(checked) => {
          setBreakAndRun(checked);
          if (checked) setGoldenBreak(false);
        }}
        onGoldenBreakChange={(checked) => {
          setGoldenBreak(checked);
          if (checked) setBreakAndRun(false);
        }}
        onBreakFouledChange={setBreakFouled}
        onWinByForfeitChange={setWinByForfeit}
        onRunoutChange={setRunout}
        onLoserBallsPocketedChange={setLoserBallsPocketed}
        onCancel={() => {
          setScoringGame(null);
          setBreakAndRun(false);
          setGoldenBreak(false);
          setBreakFouled(false);
          setWinByForfeit(false);
          setRunout(false);
          setLoserBallsPocketed(null);
        }}
        onConfirm={() => {
          if (scoringGame) {
            mutations.handleConfirmScore(
              scoringGame,
              breakAndRun,
              goldenBreak,
              () => {
                setScoringGame(null);
                setBreakAndRun(false);
                setGoldenBreak(false);
                setBreakFouled(false);
                setWinByForfeit(false);
                setRunout(false);
                setLoserBallsPocketed(null);
              },
              { breakFouled, runout, winByForfeit, loserBallsPocketed }
            );
          }
        }}
      />

      {/* Opponent Confirmation Modal */}
      <ConfirmationDialog
        open={confirmationGame !== null}
        game={confirmationGame}
        gameType={gameType}
        onConfirm={(gameNumber, isResetRequest) => {
          mutations.confirmOpponentScore(gameNumber, isResetRequest);
        }}
        onDeny={(gameNumber, isResetRequest) => {
          mutations.denyOpponentScore(gameNumber, isResetRequest);
        }}
        onClose={() => setConfirmationGame(null)}
      />

      {/* Vacate Winner Modal */}
      <EditGameDialog
        open={editingGame !== null}
        game={
          editingGame
            ? {
                gameNumber: editingGame.gameNumber,
                winnerPlayerName: editingGame.currentWinnerName,
                gameId: gameResults.get(editingGame.gameNumber)?.id || '',
              }
            : null
        }
        myVacateRequests={myVacateRequests.current}
        onVacate={async (gameNumber, gameId) => {
          try {
            // Track that I initiated this vacate request (to suppress my own confirmation modal)
            myVacateRequests.current.add(gameNumber);

            // Vacate request: Set vacate_requested_by flag
            // This preserves original confirmations while indicating vacate request
            const { error } = await supabase
              .from('match_games')
              .update({
                vacate_requested_by: isHomeTeam ? 'home' : 'away',
              })
              .eq('id', gameId);

            if (error) throw error;

            // Force refetch to update UI immediately (real-time subscription suppresses own updates)
            queryClient.invalidateQueries({ queryKey: queryKeys.matches.games(matchId || '') });
          } catch (err: any) {
            logger.error('Error requesting reset', { error: err instanceof Error ? err.message : String(err) });
            toast.error(`Failed to request reset: ${err.message}`);
          }
        }}
        onClose={() => setEditingGame(null)}
      />

      {/* Lineup Change Request Modal - for selecting replacement player */}
      {userLineup && (
        <LineupChangeModal
          isOpen={lineupChangeData !== null}
          currentPlayer={lineupChangeData ? {
            id: lineupChangeData.playerId,
            name: lineupChangeData.playerName,
            position: lineupChangeData.position,
          } : { id: '', name: '', position: 0 }}
          lineup={userLineup}
          teamRoster={teamRoster}
          onSubmit={handleLineupChangeRequest}
          onCancel={() => setLineupChangeData(null)}
          isSubmitting={requestLineupChangeMutation.isPending}
        />
      )}

      {/* Lineup Change Approval Modal - shown when opponent requests a change */}
      <LineupChangeRequestModal
        isOpen={!!(opponentLineup?.swap_position)}
        requestingTeamName={isHomeTeam ? (match.away_team?.team_name || 'Opponent') : (match.home_team?.team_name || 'Opponent')}
        position={opponentLineup?.swap_position || 0}
        oldPlayerName={opponentLineup?.swap_position
          ? getPlayerDisplayName((opponentLineup as any)[`player${opponentLineup.swap_position}_id`])
          : ''}
        newPlayerName={opponentLineup?.swap_new_player_id
          ? getPlayerDisplayName(opponentLineup.swap_new_player_id)
          : ''}
        onApprove={handleApproveLineupChange}
        onDeny={handleDenyLineupChange}
        isProcessing={approveLineupChangeMutation.isPending || denyLineupChangeMutation.isPending}
      />

    </div>
  );
}
