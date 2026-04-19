/**
 * @fileoverview Unified real-time subscription for entire match flow
 *
 * Single subscription that watches all match-related tables:
 * - matches: Match status, lineup IDs, results
 * - match_lineups: Lineup selections, lock status
 * - match_games: Game results, confirmations, tiebreaker assignments
 *
 * Used throughout the entire match lifecycle:
 * - Normal lineup selection
 * - Tiebreaker lineup selection
 * - Match scoring
 *
 * Only active when component using this hook is mounted.
 * Automatically cleans up subscription on unmount.
 *
 * @example
 * // Basic usage for lineup page
 * useMatchRealtime(matchId, {
 *   onMatchUpdate: matchQuery.refetch,
 *   onLineupUpdate: lineupsQuery.refetch,
 * });
 *
 * @example
 * // Full usage for scoring page
 * useMatchRealtime(matchId, {
 *   onMatchUpdate: matchQuery.refetch,
 *   onLineupUpdate: lineupsQuery.refetch,
 *   onGamesUpdate: gamesQuery.refetch,
 *   gameUpdateOptions: {
 *     match,
 *     userTeamId,
 *     players,
 *     myVacateRequests,
 *     addToConfirmationQueue,
 *     autoConfirm,
 *     confirmOpponentScore,
 *   }
 * });
 */

import { useEffect, useRef } from 'react';
import { supabase } from '@/supabaseClient';
import { getPlayerNicknameById } from '@/types/member';
import type { MatchBasic, Player, MatchGame } from '@/types';

interface GameUpdateOptions {
  /** Match data with team IDs */
  match: MatchBasic | null;
  /** Current user's team ID */
  userTeamId: string | null;
  /** Player lookup map for getting winner names */
  players: Map<string, Player>;
  /** Ref tracking vacate requests initiated by current user */
  myVacateRequests: React.MutableRefObject<Set<number>>;
  /** Function to add confirmation to queue. Accepts the full confirmation
   *  payload so the dialog can render every field the scorer entered. */
  addToConfirmationQueue: (confirmation: {
    gameNumber: number;
    winnerPlayerName: string;
    breakAndRun: boolean;
    goldenBreak: boolean;
    breakFouled: boolean;
    runout: boolean;
    winByForfeit: boolean;
    loserBallsPocketed: number | null;
    isResetRequest?: boolean;
  }) => void;
  /** Current editing game (to suppress own vacate requests) */
  editingGame?: { gameNumber: number; currentWinnerName: string } | null;
  /** Auto-confirm setting (bypass confirmation modal) */
  autoConfirm?: boolean;
  /** Function to auto-confirm opponent score */
  confirmOpponentScore?: (gameNumber: number) => void;
}

interface UseMatchRealtimeOptions {
  /** Callback to refetch match data */
  onMatchUpdate?: () => void;
  /** Callback to refetch lineups data */
  onLineupUpdate?: () => void;
  /** Callback to refetch games data */
  onGamesUpdate?: () => void;
  /** Additional options for game update handling (scoring page) */
  gameUpdateOptions?: GameUpdateOptions;
}

/**
 * Subscribe to real-time updates for entire match
 *
 * Listens for INSERT/UPDATE/DELETE events on three tables:
 * - matches: Match-level changes (status, results, lineup IDs)
 * - match_lineups: Lineup changes (player selections, lock status)
 * - match_games: Game changes (scores, confirmations, tiebreaker assignments)
 *
 * When updates occur, triggers appropriate TanStack Query refetch callbacks.
 * Optionally handles game confirmation logic for scoring page.
 *
 * @param matchId - Match ID to subscribe to
 * @param options - Configuration with refetch callbacks
 */
export function useMatchRealtime(
  matchId: string | null | undefined,
  options: UseMatchRealtimeOptions
) {
  const {
    onMatchUpdate,
    onLineupUpdate,
    onGamesUpdate,
    gameUpdateOptions,
  } = options;

  // Use refs to avoid re-subscribing when callbacks change
  const onMatchUpdateRef = useRef(onMatchUpdate);
  const onLineupUpdateRef = useRef(onLineupUpdate);
  const onGamesUpdateRef = useRef(onGamesUpdate);

  // Update refs when callbacks change
  useEffect(() => {
    onMatchUpdateRef.current = onMatchUpdate;
    onLineupUpdateRef.current = onLineupUpdate;
    onGamesUpdateRef.current = onGamesUpdate;
  }, [onMatchUpdate, onLineupUpdate, onGamesUpdate]);

  useEffect(() => {
    if (!matchId) return;

    console.log(`[useMatchRealtime] Setting up subscription for match ${matchId}`);

    const channel = supabase
      .channel(`match_${matchId}`)

      // Watch matches table
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          console.log('[useMatchRealtime] Match update received:', payload.eventType);
          onMatchUpdateRef.current?.();
        }
      )

      // Watch match_lineups table
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_lineups',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          console.log('[useMatchRealtime] Lineup update received:', payload.eventType);
          onLineupUpdateRef.current?.();
        }
      )

      // Watch match_games table
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_games',
          filter: `match_id=eq.${matchId}`,
        },
        async (payload) => {
          console.log('[useMatchRealtime] Game update received:', payload.eventType);
          // Always refetch games
          onGamesUpdateRef.current?.();

          // Handle confirmation queue logic if options provided (scoring page)
          if (gameUpdateOptions && (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') && payload.new) {
            const {
              match,
              userTeamId,
              players,
              myVacateRequests,
              addToConfirmationQueue,
              editingGame = null,
              autoConfirm = false,
              confirmOpponentScore,
            } = gameUpdateOptions;

            if (!match || !userTeamId) return;

            const updatedGame = payload.new as MatchGame;

            // Detect if this is a vacate request
            const isVacateRequest = !!(updatedGame as any).vacate_requested_by;

            // Handle vacate requests (check this FIRST, before normal confirmation logic)
            if (isVacateRequest) {
              // Check if the editingGame modal is currently open for this game
              if (editingGame && editingGame.gameNumber === updatedGame.game_number) {
                return;
              }

              // Check if I initiated this vacate request
              if (myVacateRequests.current.has(updatedGame.game_number)) {
                myVacateRequests.current.delete(updatedGame.game_number);
                return;
              }

              // This is from opponent - show the confirmation modal.
              // Forward every scored field — dumb dialog renders whatever is truthy.
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
                  loserBallsPocketed: updatedGame.loser_balls_pocketed,
                  isResetRequest: true,
                });
              }
              return;
            }

            // Normal score updates - check if game has winner and needs confirmation
            if (updatedGame.winner_player_id && (!updatedGame.confirmed_by_home || !updatedGame.confirmed_by_away)) {
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
                  loserBallsPocketed: updatedGame.loser_balls_pocketed,
                  isResetRequest: false,
                });
              }
            }
          }
        }
      )
      .subscribe((status, err) => {
        console.log(`[useMatchRealtime] Subscription status: ${status}`, err ? `Error: ${err.message}` : '');
      });

    return () => {
      console.log(`[useMatchRealtime] Cleaning up subscription for match ${matchId}`);
      supabase.removeChannel(channel);
    };
  }, [matchId, gameUpdateOptions]);
}
