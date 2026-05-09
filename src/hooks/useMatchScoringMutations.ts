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
import { populateMatchSnapshotIfNeeded, updateMatchRunningTotals } from '@/api/queries/matches';
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
  /** Add confirmation to queue. Forwards the full match_games snapshot plus
   *  the event names recorded for the game (sourced from game_events). */
  addToConfirmationQueue: (confirmation: {
    gameNumber: number;
    winnerPlayerName: string;
    events: string[];
    breakFouled: boolean;
    winnerValue: number | null;
    loserValue: number | null;
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
    async (
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

          // Add to confirmation queue. The events list is fetched from
          // game_events for this specific game — Branch B Phase 1 dropped the
          // boolean columns from match_games, so events live in the child
          // table and must be queried explicitly. Cheap (single index lookup
          // on (game_id)).
          const { data: eventRows } = await supabase
            .from('game_events')
            .select('event_name')
            .eq('game_id', existingGame.id);
          const events = (eventRows ?? []).map(row => row.event_name);

          addToConfirmationQueue({
            gameNumber,
            winnerPlayerName: getPlayerDisplayName(existingGame.winner_player_id),
            events,
            breakFouled: existingGame.break_fouled,
            loserValue: existingGame.loser_value,
            winnerValue: existingGame.winner_value,
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
          // Vacate-accept: atomically clear the score and delete game_events
          // rows for this game via the clear_game_with_events rpc. Then
          // separately clear the vacate_requested_by flag (auxiliary; not
          // part of the atomic dual-write contract).
          const { error: clearError } = await supabase.rpc('clear_game_with_events', {
            p_game_id: existingGame.id,
          });
          if (clearError) throw clearError;

          const { error: vacateFlagError } = await supabase
            .from('match_games')
            .update({ vacate_requested_by: null })
            .eq('id', existingGame.id);
          if (vacateFlagError) throw vacateFlagError;
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

        // Phase 5 Unit 5.5: eagerly recompute the match row's running totals
        // from the current set of confirmed match_games. The match record is
        // the source of truth in real-time — totals never drift from what
        // both teams have agreed to.
        if (match?.id) {
          await updateMatchRunningTotals(match.id);
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
          // Deny normal score: reset the game back to unscored state via
          // the clear_game_with_events rpc (atomic clear of match_games
          // scoring fields + DELETE from game_events). Then clear
          // confirmed_at separately (auxiliary field).
          const { error: clearError } = await supabase.rpc('clear_game_with_events', {
            p_game_id: existingGame.id,
          });
          if (clearError) throw clearError;

          const { error: confirmedAtError } = await supabase
            .from('match_games')
            .update({ confirmed_at: null })
            .eq('id', existingGame.id);
          if (confirmedAtError) throw confirmedAtError;
        }

        // Phase 5 Unit 5.5: denial / vacate-deny clears confirmations or
        // resets the game — running totals must be recomputed so the match
        // row reflects the new confirmed-game count + recalculated points.
        if (match?.id) {
          await updateMatchRunningTotals(match.id);
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
   * Confirm game score and save to database via the score_game_with_events rpc.
   *
   * The rpc atomically: (1) updates the match_games row with winner / values /
   * break_fouled / confirmed_by, (2) replaces game_events for this game with
   * the provided event payload. Any failure rolls both back — the dual-write
   * (break_fouled column AND break_fouled event row) cannot drift.
   *
   * Branch B Phase 1: callers pass a single `events` array of
   * `{event_name, attributed_player_id}` objects instead of individual
   * boolean props. The parent (ScoreMatch.tsx) builds this array from the
   * registry's attribution rules + the modal's winner/loser/breaker context.
   */
  const handleConfirmScore = useCallback(
    async (
      scoringGame: {
        gameNumber: number;
        winnerTeamId: string;
        winnerPlayerId: string;
        winnerPlayerName: string;
      },
      events: ReadonlyArray<{ event_name: string; attributed_player_id: string | null }>,
      onSuccess: () => void,
      extras: {
        breakFouled?: boolean;
        winnerValue?: number | null;
        loserValue?: number | null;
      } = {}
    ) => {
      if (!scoringGame || !match || !homeLineup || !awayLineup) return;

      const breakFouled = extras.breakFouled ?? false;
      const winnerValue = extras.winnerValue ?? null;
      const loserValue = extras.loserValue ?? null;

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

        // Get the existing game record from the database
        const existingGame = gameResults.get(scoringGame.gameNumber);
        if (!existingGame) {
          toast.error('Game not found');
          return;
        }

        // Atomic write via score_game_with_events rpc.
        const { error } = await supabase.rpc('score_game_with_events', {
          p_game_id: existingGame.id,
          p_winner_team_id: scoringGame.winnerTeamId,
          p_winner_player_id: scoringGame.winnerPlayerId,
          p_winner_value: winnerValue,
          p_loser_value: loserValue,
          p_break_fouled: breakFouled,
          // Pass the caller's member_id only on the side they represent.
          // The rpc COALESCEs against the existing value so the other side's
          // confirmation (if any) is preserved.
          p_confirmed_by_home: isHomeTeamScoring ? memberId : null,
          p_confirmed_by_away: !isHomeTeamScoring ? memberId : null,
          p_events: events,
        });

        if (error) {
          logger.error('score_game_with_events failed', { error: error.message });
          toast.error(`Failed to save game score: ${error.message}`);
          return;
        }

        // Phase 5 Unit 5.5: eagerly recompute the match row's running totals
        // from the current set of confirmed match_games.
        if (match?.id) {
          await updateMatchRunningTotals(match.id);
        }

        // Real-time subscription refreshes downstream game results.
        onSuccess();
      } catch (err: any) {
        logger.error('Error saving game score', { error: err instanceof Error ? err.message : String(err) });
        toast.error(`Failed to save game score: ${err.message}`);
      }
    },
    [match, homeLineup, awayLineup, userTeamId, gameResults, leagueId, memberId]
  );

  return {
    handlePlayerClick,
    confirmOpponentScore,
    denyOpponentScore,
    handleConfirmScore,
  };
}
