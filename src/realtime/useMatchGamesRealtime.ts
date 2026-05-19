/**
 * @fileoverview Real-time subscription for match games
 *
 * Subscribes to match_games table changes and handles:
 * - Refetching game data via TanStack Query
 * - Detecting confirmation requests (score updates and vacate requests)
 * - Adding confirmation items to queue for opponent to confirm
 *
 * Only active when component using this hook is mounted.
 * Automatically cleans up subscription on unmount.
 *
 * @example
 * const { refetch } = useMatchGames(matchId);
 * useMatchGamesRealtime(matchId, {
 *   onUpdate: refetch,
 *   match,
 *   userTeamId,
 *   players,
 *   myVacateRequests,
 *   addToConfirmationQueue,
 * });
 */

import { useEffect } from 'react';
import { supabase } from '@/supabaseClient';
import { getPlayerNicknameById } from '@/types/member';
import type { MatchBasic, Player, MatchGame } from '@/types';

interface UseMatchGamesRealtimeOptions {
  /** Callback to refetch games data (typically TanStack Query refetch) */
  onUpdate: () => void;
  /** Callback to refetch match data when match row changes */
  onMatchUpdate?: () => void;
  /** Match data with team IDs */
  match: MatchBasic | null;
  /** Current user's team ID */
  userTeamId: string | null;
  /** Player lookup map for getting winner names */
  players: Map<string, Player>;
  /** Ref tracking vacate requests initiated by current user */
  myVacateRequests: React.MutableRefObject<Set<number>>;
  /** Function to add confirmation to queue. Accepts the full confirmation
   *  payload so the dialog can render every field the scorer entered; the
   *  dialog itself is dumb and shows whatever is truthy. */
  addToConfirmationQueue: (confirmation: {
    gameNumber: number;
    winnerPlayerName: string;
    breakAndRun: boolean;
    goldenBreak: boolean;
    breakFouled: boolean;
    runout: boolean;
    winByForfeit: boolean;
    winnerValue: number | null;
    loserValue: number | null;
    isResetRequest?: boolean;
  }) => void;
  /** Current editing game (to suppress own vacate requests) */
  editingGame?: { gameNumber: number; currentWinnerName: string } | null;
  /** Auto-confirm setting (bypass confirmation modal) */
  autoConfirm?: boolean;
  /** Function to auto-confirm opponent score */
  confirmOpponentScore?: (gameNumber: number) => void;
}

/**
 * Subscribe to real-time updates for match games with confirmation handling
 *
 * Listens for INSERT/UPDATE/DELETE events on match_games table.
 * When updates occur:
 * 1. Refetches game data via TanStack Query
 * 2. Checks if opponent scored and needs current user's confirmation
 * 3. Detects vacate requests and adds to confirmation queue
 *
 * @param matchId - Match ID to subscribe to
 * @param options - Configuration with callbacks and data
 */
export function useMatchGamesRealtime(
  matchId: string | null | undefined,
  options: UseMatchGamesRealtimeOptions
) {
  const {
    onUpdate,
    onMatchUpdate,
    match,
    userTeamId,
    players,
    myVacateRequests,
    addToConfirmationQueue,
    editingGame = null,
    autoConfirm = false,
    confirmOpponentScore
  } = options;

  useEffect(() => {
    if (!matchId || !match || !userTeamId) return;

    //console.log('Setting up real-time subscription for match games:', matchId);

    const channel = supabase
      .channel(`match_games_${matchId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'match_games',
          filter: `match_id=eq.${matchId}`,
        },
        async (payload) => {
          // Trigger TanStack Query refetch
          onUpdate();

          // Handle confirmation queue logic for both INSERT and UPDATE
          if ((payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') && payload.new) {
            const updatedGame = payload.new as MatchGame;

            // Detect if this is a vacate request:
            // Check for vacate_requested_by flag (preserves confirmations)
            const isVacateRequest = !!(updatedGame as any).vacate_requested_by;

            // Handle vacate requests (check this FIRST, before normal confirmation logic)
            if (isVacateRequest) {
              // Check if the editingGame modal is currently open for this game
              // If so, this is MY action, not the opponent's
              if (editingGame && editingGame.gameNumber === updatedGame.game_number) {
                //console.log('I am currently editing this game, suppressing my own confirmation modal');
                return;
              }

              // Check if I initiated this vacate request
              if (myVacateRequests.current.has(updatedGame.game_number)) {
                //console.log('I initiated this vacate request, suppressing my own confirmation modal');
                myVacateRequests.current.delete(updatedGame.game_number);
                return;
              }

              // This is from opponent - show the confirmation modal.
              // Forward every scored field — the dialog displays whatever is truthy.
              if (updatedGame.winner_player_id) {
                const winnerName = getPlayerNicknameById(updatedGame.winner_player_id, players);
                addToConfirmationQueue({
                  gameNumber: updatedGame.game_number,
                  winnerPlayerName: winnerName,
                  breakAndRun: updatedGame.break_and_run,
                  goldenBreak: updatedGame.golden_break,
                  breakFouled: updatedGame.break_fouled,
                  runout: updatedGame.runout,
                  winByForfeit: updatedGame.win_by_forfeit,
                  loserValue: updatedGame.loser_value,
                  winnerValue: updatedGame.winner_value,
                  isResetRequest: true
                });
              }
              return;
            }

            // Normal score updates - check if game has winner and needs confirmation
            if (updatedGame.winner_player_id && (!updatedGame.confirmed_by_home || !updatedGame.confirmed_by_away)) {
              // Normal score update - check if opponent needs to confirm
              const isHomeTeamScorer = updatedGame.confirmed_by_home && !updatedGame.confirmed_by_away;
              const isAwayTeamScorer = updatedGame.confirmed_by_away && !updatedGame.confirmed_by_home;

              const iAmHome = userTeamId === match.home_team_id;
              const needMyConfirmation = (isHomeTeamScorer && !iAmHome) || (isAwayTeamScorer && iAmHome);

              if (needMyConfirmation) {
                // If auto-confirm is enabled, automatically confirm without showing modal
                if (autoConfirm && confirmOpponentScore) {
                  confirmOpponentScore(updatedGame.game_number);
                  return;
                }

                const winnerName = getPlayerNicknameById(updatedGame.winner_player_id, players);
                // Forward every scored field — dumb dialog renders whatever is truthy.
                addToConfirmationQueue({
                  gameNumber: updatedGame.game_number,
                  winnerPlayerName: winnerName,
                  breakAndRun: updatedGame.break_and_run,
                  goldenBreak: updatedGame.golden_break,
                  breakFouled: updatedGame.break_fouled,
                  runout: updatedGame.runout,
                  winByForfeit: updatedGame.win_by_forfeit,
                  loserValue: updatedGame.loser_value,
                  winnerValue: updatedGame.winner_value,
                  isResetRequest: false
                });
              }
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${matchId}`,
        },
        () => {
          // Refetch match data to update UI when match row changes
          if (onMatchUpdate) {
            onMatchUpdate();
          }
        }
      )
      .subscribe();

    return () => {
      //console.log('Cleaning up real-time subscription for match games:', matchId);
      supabase.removeChannel(channel);
    };
  }, [matchId, match, userTeamId, players, myVacateRequests, addToConfirmationQueue, onUpdate, onMatchUpdate, editingGame, autoConfirm, confirmOpponentScore]);
}
