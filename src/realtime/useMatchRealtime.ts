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
import { fetchGameEventsForConfirmation } from './fetchGameEventsForConfirmation';

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
   *  payload so the dialog can render every field the scorer entered.
   *  Branch B Phase 1: `events` is the array of event names recorded for
   *  the game (sourced from game_events) — replaces the prior boolean
   *  fields. */
  addToConfirmationQueue: (confirmation: {
    gameNumber: number;
    winnerPlayerName: string;
    events: string[];
    breakFouled: boolean;
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

  // Use refs to avoid re-subscribing when callbacks or option bag change.
  // gameUpdateOptions is an object literal at the call site (built fresh
  // every render), so without a ref it would trip the subscription effect's
  // dep comparison on every parent re-render. Phase 5 introduced
  // updateMatchRunningTotals which mutates the match row on every scored
  // game, so a refetch-on-write loop would tear down and re-subscribe the
  // realtime channel after every score event without this ref.
  const onMatchUpdateRef = useRef(onMatchUpdate);
  const onLineupUpdateRef = useRef(onLineupUpdate);
  const onGamesUpdateRef = useRef(onGamesUpdate);
  const gameUpdateOptionsRef = useRef(gameUpdateOptions);

  useEffect(() => {
    onMatchUpdateRef.current = onMatchUpdate;
    onLineupUpdateRef.current = onLineupUpdate;
    onGamesUpdateRef.current = onGamesUpdate;
    gameUpdateOptionsRef.current = gameUpdateOptions;
  }, [onMatchUpdate, onLineupUpdate, onGamesUpdate, gameUpdateOptions]);

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

          // Handle confirmation queue logic if options provided (scoring page).
          // Read from the ref so we always see the latest values without
          // putting gameUpdateOptions in the subscription useEffect's dep
          // array — see the ref-pattern note above for why.
          const currentGameUpdateOptions = gameUpdateOptionsRef.current;
          if (currentGameUpdateOptions && (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') && payload.new) {
            const {
              match,
              userTeamId,
              players,
              myVacateRequests,
              addToConfirmationQueue,
              editingGame = null,
              autoConfirm = false,
              confirmOpponentScore,
            } = currentGameUpdateOptions;

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
              // Branch B Phase 1: events are no longer columns on match_games.
              // Fetch them from game_events with bounded retry against
              // cross-table realtime ordering (see fetchGameEventsForConfirmation).
              if (updatedGame.winner_player_id) {
                const winnerName = getPlayerNicknameById(updatedGame.winner_player_id, players);
                const events = await fetchGameEventsForConfirmation(
                  supabase,
                  updatedGame.id,
                  true, // expectNonEmpty — retry if empty on a winner-confirmed game
                );
                addToConfirmationQueue({
                  gameNumber: updatedGame.game_number,
                  winnerPlayerName: winnerName,
                  events,
                  breakFouled: updatedGame.break_fouled,
                  loserValue: updatedGame.loser_value,
                  winnerValue: updatedGame.winner_value,
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
                // Branch B Phase 1: events fetched from game_events with retry.
                const events = await fetchGameEventsForConfirmation(
                  supabase,
                  updatedGame.id,
                  true,
                );
                addToConfirmationQueue({
                  gameNumber: updatedGame.game_number,
                  winnerPlayerName: winnerName,
                  events,
                  breakFouled: updatedGame.break_fouled,
                  loserValue: updatedGame.loser_value,
                  winnerValue: updatedGame.winner_value,
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
    // gameUpdateOptions is intentionally NOT in this dep array — the
    // ref pattern above keeps it accessible at event-fire time without
    // causing the subscription to tear down on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);
}
