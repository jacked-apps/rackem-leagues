/**
 * @fileoverview Match Scoring Mutations Hook
 *
 * Centralized mutations for match scoring operations.
 * Handles all database updates for scoring, confirming, and denying game results.
 *
 * Mutations included:
 * - handlePlayerClick: Logic for clicking a player to score
 * - confirmOpponentScore: Confirm or accept vacate request
 * - denyOpponentScore: Deny score or vacate request
 * - handleConfirmScore: Save new game score to database
 */

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import type { Lineup, MatchGame } from '@/types/match';
import { queryKeys } from '@/api/queryKeys';
import { populateMatchSnapshotIfNeeded } from '@/api/queries/matches';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';

interface UseMatchScoringMutationsParams {
  /** Current match data */
  match: {
    id: string;
    home_team_id: string;
    away_team_id: string;
  } | null;
  /** League ID — used for tier-3 system_snapshot population at first-scoring-event */
  leagueId: string | null;
  /** Map of game results by game number */
  gameResults: Map<number, MatchGame>;
  /** Home team lineup */
  homeLineup: Lineup | null;
  /** Away team lineup */
  awayLineup: Lineup | null;
  /** Current user's team ID */
  userTeamId: string | null;
  /** Current user's member ID */
  memberId: string | null;
  /** Game type from league (8-ball, 9-ball, 10-ball) */
  // gameType: string;
  /** Auto-confirm setting (skip confirmation modal) */
  autoConfirm: boolean;
  /** Add confirmation to queue */
  addToConfirmationQueue: (confirmation: {
    gameNumber: number;
    winnerPlayerName: string;
    breakAndRun: boolean;
    goldenBreak: boolean;
  }) => void;
  /** Get player display name by ID */
  getPlayerDisplayName: (playerId: string) => string;
}

/**
 * Custom hook for match scoring mutations
 *
 * Returns mutation functions for scoring operations.
 * All functions handle database updates and error handling.
 * Real-time subscription automatically refreshes data after mutations.
 */
export function useMatchScoringMutations({
  match,
  leagueId,
  gameResults,
  homeLineup,
  awayLineup,
  userTeamId,
  memberId,
  // gameType,
  autoConfirm,
  addToConfirmationQueue,
  getPlayerDisplayName,
}: UseMatchScoringMutationsParams) {
  const queryClient = useQueryClient();
  /**
   * Handle player button click to score a game
   *
   * Determines if game needs confirmation or can be scored directly.
   * Opens appropriate modal based on game state.
   */
  const handlePlayerClick = useCallback(
    (
      gameNumber: number,
      playerId: string,
      playerName: string,
      teamId: string,
      onOpenScoringModal: (game: {
        gameNumber: number;
        winnerTeamId: string;
        winnerPlayerId: string;
        winnerPlayerName: string;
        /**
         * Whether the winner was the scheduled breaker of this game (i.e., had
         * the `breaks` action in the game row). Role-conditional modal fields
         * (BR / GB / runout) derive from this combined with the break-fault
         * toggle: actualBreaker = scheduledBreaker XOR breakFouled.
         */
        winnerWasScheduledBreaker: boolean;
      }) => void,
      confirmOpponentScoreFn: (gameNumber: number) => void
    ) => {
      if (!match) return;

      // Check if game already has a result
      const existingGame = gameResults.get(gameNumber);

      // If game has a winner and is waiting for opponent confirmation
      if (
        existingGame &&
        existingGame.winner_player_id &&
        (!existingGame.confirmed_by_home || !existingGame.confirmed_by_away)
      ) {
        // Determine if this is the opponent team
        const isHomeTeam = userTeamId === match.home_team_id;
        const needsMyConfirmation = isHomeTeam
          ? !existingGame.confirmed_by_home
          : !existingGame.confirmed_by_away;
        const alreadyConfirmedByMe = isHomeTeam
          ? existingGame.confirmed_by_home
          : existingGame.confirmed_by_away;

        if (needsMyConfirmation) {
          // If auto-confirm is enabled, automatically confirm without showing modal
          if (autoConfirm) {
            confirmOpponentScoreFn(gameNumber);
            return;
          }

          // Add to confirmation queue (will show immediately or queue if modal is open)
          addToConfirmationQueue({
            gameNumber,
            winnerPlayerName: getPlayerDisplayName(existingGame.winner_player_id),
            breakAndRun: existingGame.break_and_run,
            goldenBreak: existingGame.golden_break,
          });
          return;
        }

        if (alreadyConfirmedByMe) {
          // This team already confirmed, waiting for opponent - don't allow re-clicking
          return;
        }
      }

      if (
        existingGame &&
        existingGame.confirmed_by_home &&
        existingGame.confirmed_by_away
      ) {
        // Game already confirmed by both teams, don't allow changes
        toast.error(
          'This game has already been confirmed by both teams. Use the Edit button to change it.'
        );
        return;
      }

      // Derive whether the clicked winner was the scheduled breaker by
      // comparing the winner's player ID to the game row's per-side action.
      // `existingGame` is always present here because games are pre-created by
      // the match preparation step before any scoring UI renders.
      let winnerWasScheduledBreaker = false;
      if (existingGame) {
        if (existingGame.home_player_id === playerId) {
          winnerWasScheduledBreaker = existingGame.home_action === 'breaks';
        } else if (existingGame.away_player_id === playerId) {
          winnerWasScheduledBreaker = existingGame.away_action === 'breaks';
        }
      }

      // Open confirmation modal to score new game
      onOpenScoringModal({
        gameNumber,
        winnerTeamId: teamId,
        winnerPlayerId: playerId,
        winnerPlayerName: playerName,
        winnerWasScheduledBreaker,
      });
    },
    [match, gameResults, userTeamId, autoConfirm, addToConfirmationQueue, getPlayerDisplayName]
  );

  /**
   * Confirm opponent's score or accept vacate request
   *
   * @param gameNumber - Game number to confirm
   * @param isVacateRequest - True if confirming a vacate request
   */
  const confirmOpponentScore = useCallback(
    async (gameNumber: number, isVacateRequest?: boolean) => {
      if (!match) return;

      const existingGame = gameResults.get(gameNumber);
      if (!existingGame) return;

      try {
        const isHomeTeam = userTeamId === match.home_team_id;

        if (isVacateRequest) {
          // For vacate requests, clear the game entirely (accept the vacate)
          // Also clear the vacate_requested_by flag
          const { error } = await supabase
            .from('match_games')
            .update({
              winner_team_id: null,
              winner_player_id: null,
              break_and_run: false,
              golden_break: false,
              break_fouled: false,
              runout: false,
              win_by_forfeit: false,
              loser_balls_pocketed: null,
              confirmed_by_home: null,
              confirmed_by_away: null,
              vacate_requested_by: null,
            })
            .eq('id', existingGame.id);

          if (error) throw error;
        } else {
          // Normal score confirmation - only update OUR confirmation, don't touch opponent's
          const updateData = isHomeTeam
            ? { confirmed_by_home: memberId }
            : { confirmed_by_away: memberId };

          const { error } = await supabase
            .from('match_games')
            .update(updateData)
            .eq('id', existingGame.id);

          if (error) throw error;
        }

        // Wait 500ms for database to propagate, then invalidate queries
        // This ensures the refetched data includes the update
        setTimeout(() => {
          if (match?.id) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.matches.detail(match.id),
            });
            queryClient.invalidateQueries({
              queryKey: queryKeys.matches.games(match.id),
            });
          }
        }, 500);
      } catch (err: any) {
        logger.error('Error confirming game', { error: err instanceof Error ? err.message : String(err) });
        toast.error(`Failed to confirm game: ${err.message}`);
      }
    },
    [match, userTeamId, gameResults, queryClient]
  );

  /**
   * Deny opponent's score or vacate request
   *
   * @param gameNumber - Game number to deny
   * @param isVacateRequest - True if denying a vacate request
   */
  const denyOpponentScore = useCallback(
    async (gameNumber: number, isVacateRequest?: boolean) => {
      if (!match) return;

      const existingGame = gameResults.get(gameNumber);
      if (!existingGame) return;

      try {
        if (isVacateRequest) {
          // Deny vacate request: Just clear the vacate_requested_by flag
          // Original confirmations are preserved, so just remove the vacate flag
          const { error } = await supabase
            .from('match_games')
            .update({
              vacate_requested_by: null,
            })
            .eq('id', existingGame.id);

          if (error) throw error;
        } else {
          // Deny normal score: reset the game back to unscored state
          const { error } = await supabase
            .from('match_games')
            .update({
              winner_team_id: null,
              winner_player_id: null,
              break_and_run: false,
              golden_break: false,
              break_fouled: false,
              runout: false,
              win_by_forfeit: false,
              loser_balls_pocketed: null,
              confirmed_by_home: null,
              confirmed_by_away: null,
              confirmed_at: null,
            })
            .eq('id', existingGame.id);

          if (error) throw error;
        }

        // Game results will be automatically refreshed by real-time subscription
      } catch (err: any) {
        logger.error('Error denying game', { error: err instanceof Error ? err.message : String(err) });
        toast.error(`Failed to deny game: ${err.message}`);
      }
    },
    [match, gameResults]
  );

  /**
   * Confirm game score and save to database
   *
   * Handles both insert (new game) and update (existing game).
   * Validates mutual exclusivity of Break & Run and Golden Break.
   */
  const handleConfirmScore = useCallback(
    async (
      scoringGame: {
        gameNumber: number;
        winnerTeamId: string;
        winnerPlayerId: string;
        winnerPlayerName: string;
      },
      breakAndRun: boolean,
      goldenBreak: boolean,
      onSuccess: () => void,
      /**
       * Always-tracked + system-specific extras added in Unit 11b. Defaults
       * preserve prior behavior (all flags false, ball count null) so legacy
       * callers that don't pass this object continue to work unchanged.
       */
      extras: {
        breakFouled?: boolean;
        runout?: boolean;
        winByForfeit?: boolean;
        loserBallsPocketed?: number | null;
      } = {}
    ) => {
      if (!scoringGame || !match || !homeLineup || !awayLineup) return;

      const breakFouled = extras.breakFouled ?? false;
      const runout = extras.runout ?? false;
      const winByForfeit = extras.winByForfeit ?? false;
      const loserBallsPocketed = extras.loserBallsPocketed ?? null;

      try {
        // Tier 3 mutability: populate system_snapshot at the first scoring event.
        // No-op if already populated. Runs before the score write so the snapshot
        // reflects league state as of the moment the first game was scored.
        // Non-blocking: any error is logged but doesn't prevent scoring.
        if (leagueId) {
          await populateMatchSnapshotIfNeeded(match.id, leagueId);
        }

        // Determine if this is home or away team confirming (based on WHO is scoring, not who won)
        const isHomeTeamScoring = userTeamId === match.home_team_id;

        // Check for mutual exclusivity of B&R and golden break
        if (breakAndRun && goldenBreak) {
          toast.error('A game cannot have both Break & Run and Golden Break.');
          return;
        }

        // Get the existing game record from the database
        const existingGame = gameResults.get(scoringGame.gameNumber);
        if (!existingGame) {
          toast.error('Game not found');
          return;
        }

        // Read player IDs and actions directly from the game record
        // (Works for all game types: regular, tiebreaker, 5v5, etc.)
        const homePlayerId = existingGame.home_player_id || '';
        const awayPlayerId = existingGame.away_player_id || '';
        const homeAction = existingGame.home_action || 'breaks';
        const awayAction = existingGame.away_action || 'racks';

        // Prepare game data
        const gameData = {
          match_id: match.id,
          game_number: scoringGame.gameNumber,
          home_player_id: homePlayerId,
          away_player_id: awayPlayerId,
          home_action: homeAction,
          away_action: awayAction,
          winner_team_id: scoringGame.winnerTeamId,
          winner_player_id: scoringGame.winnerPlayerId,
          break_and_run: breakAndRun,
          golden_break: goldenBreak,
          break_fouled: breakFouled,
          runout,
          win_by_forfeit: winByForfeit,
          loser_balls_pocketed: loserBallsPocketed,
          confirmed_by_home: isHomeTeamScoring ? memberId : null,
          confirmed_by_away: !isHomeTeamScoring ? memberId : null,
        };

        // Check if game already exists (using same game we fetched earlier)
        if (existingGame) {
          // Update existing game
          const updateData = {
            winner_team_id: gameData.winner_team_id,
            winner_player_id: gameData.winner_player_id,
            break_and_run: gameData.break_and_run,
            golden_break: gameData.golden_break,
            break_fouled: gameData.break_fouled,
            runout: gameData.runout,
            win_by_forfeit: gameData.win_by_forfeit,
            loser_balls_pocketed: gameData.loser_balls_pocketed,
            confirmed_by_home: isHomeTeamScoring
              ? memberId
              : existingGame.confirmed_by_home,
            confirmed_by_away: !isHomeTeamScoring
              ? memberId
              : existingGame.confirmed_by_away,
          };

          const { data, error } = await supabase
            .from('match_games')
            .update(updateData)
            .eq('id', existingGame.id)
            .select();

          if (error) {
            logger.error('Update error', { error: error.message });
            throw error;
          }

          if (!data || data.length === 0) {
            logger.error('No rows updated - possible RLS policy blocking update');
            toast.error(
              'Failed to update game. You may not have permission to score for this team.'
            );
            return;
          }
        } else {
          // Insert new game (includes game_type from league)
          const { error } = await supabase.from('match_games').insert(gameData);

          if (error) throw error;
        }

        // Note: Real-time subscription will automatically refresh game results

        // Close modal and reset state
        onSuccess();
      } catch (err: any) {
        logger.error('Error saving game score', { error: err instanceof Error ? err.message : String(err) });
        toast.error(`Failed to save game score: ${err.message}`);
      }
    },
    [match, homeLineup, awayLineup, userTeamId, gameResults]
  );

  return {
    handlePlayerClick,
    confirmOpponentScore,
    denyOpponentScore,
    handleConfirmScore,
  };
}
