/**
 * @fileoverview Unified real-time subscription for entire match flow
 *
 * Single subscription that watches all match-related tables:
 * - matches: Match status, lineup IDs, results
 * - match_lineups: Lineup selections, lock status
 * - match_games: Game results, confirmations, tiebreaker assignments
 * - game_confirmations: Many-eyes witness records (every vouch + vacate markers)
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

import { useEffect, useRef, useState } from 'react';
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';
import { supabase } from '@/supabaseClient';
import { getPlayerNicknameById } from '@/types/member';
import { logger } from '@/utils/logger';
import type { MatchBasic, Player, MatchGame, ConfirmationQueueItem } from '@/types';

/**
 * Coarse realtime connection status surfaced to the scoring UI.
 *
 * - `live`        — channel is SUBSCRIBED and current.
 * - `reconnecting`— a transient drop (CLOSED / TIMED_OUT / non-fatal
 *                   CHANNEL_ERROR); the Supabase client is auto-rejoining.
 * - `error`       — a terminal/non-transient channel error (a server/client
 *                   binding mismatch — a config or publication bug, not a blip);
 *                   retrying would just spin.
 */
export type RealtimeConnectionStatus = 'live' | 'reconnecting' | 'error';

/**
 * Per-subscription bookkeeping the classifier threads between callbacks.
 * `hasSubscribed` distinguishes the very first SUBSCRIBED from a re-SUBSCRIBED
 * after a drop; `reconnecting` records that we dropped since the last live
 * state, which is precisely the condition under which a catch-up refetch is
 * owed.
 */
interface SubscribeFlags {
  hasSubscribed: boolean;
  reconnecting: boolean;
}

/** Result of classifying one `.subscribe` status callback. */
export interface SubscribeClassification {
  /** Coarse status to surface to the UI. */
  status: RealtimeConnectionStatus;
  /**
   * Whether a catch-up refetch is owed. True ONLY on a re-SUBSCRIBED after a
   * drop — realtime does not replay rows missed while the socket was down, so
   * the app must refetch to close the gap. Inherently fires at most once per
   * drop cycle (the `reconnecting` flag is cleared on the SUBSCRIBED that
   * consumes it), so no extra debounce timer is needed.
   */
  catchUp: boolean;
  /** Flags to carry into the next callback. */
  next: SubscribeFlags;
}

/**
 * Is this CHANNEL_ERROR the terminal "bindings mismatch" error rather than a
 * transient drop? realtime-js raises this exact message when the server and
 * client disagree on the postgres_changes bindings — a config/publication bug
 * that will never self-heal, so we must not treat it as a reconnecting blip.
 *
 * @param err - The error passed alongside a CHANNEL_ERROR status, if any.
 */
export function isBindingMismatch(err?: Error): boolean {
  return !!err && /mismatch between server and client/i.test(err.message);
}

/**
 * Pure state machine for the realtime `.subscribe` status callback.
 *
 * Extracted as a pure function (mirrors `computePhaseRefetchInterval`) so the
 * status-derivation and catch-up-refetch decision are verifiable without
 * mounting the hook or a real socket.
 *
 * @param state - The `REALTIME_SUBSCRIBE_STATES` value from the callback.
 * @param err - The optional error (only present on CHANNEL_ERROR).
 * @param prev - Flags carried from the previous callback.
 * @returns The status to surface, whether a catch-up refetch is owed, and the
 *   flags to carry forward.
 */
export function classifySubscribeEvent(
  state: REALTIME_SUBSCRIBE_STATES,
  err: Error | undefined,
  prev: SubscribeFlags
): SubscribeClassification {
  switch (state) {
    case REALTIME_SUBSCRIBE_STATES.SUBSCRIBED:
      return {
        status: 'live',
        // A re-SUBSCRIBED (we'd subscribed before AND dropped since) owes a
        // catch-up; the very first SUBSCRIBED does not.
        catchUp: prev.hasSubscribed && prev.reconnecting,
        next: { hasSubscribed: true, reconnecting: false },
      };

    case REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR:
      if (isBindingMismatch(err)) {
        // Terminal config bug — surface as error, do not arm a catch-up/retry.
        return {
          status: 'error',
          catchUp: false,
          next: { hasSubscribed: prev.hasSubscribed, reconnecting: false },
        };
      }
      // Transient channel error — treat like a drop; the client auto-rejoins.
      return {
        status: 'reconnecting',
        catchUp: false,
        next: { hasSubscribed: prev.hasSubscribed, reconnecting: true },
      };

    case REALTIME_SUBSCRIBE_STATES.CLOSED:
    case REALTIME_SUBSCRIBE_STATES.TIMED_OUT:
    default:
      // A drop. Mark reconnecting so the next SUBSCRIBED fires the catch-up.
      // Idempotent across rapid duplicate CLOSED/TIMED_OUT callbacks (the flag
      // is already true), so no extra refetch is scheduled by the repeats.
      return {
        status: 'reconnecting',
        catchUp: false,
        next: { hasSubscribed: prev.hasSubscribed, reconnecting: true },
      };
  }
}

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
  addToConfirmationQueue: (confirmation: ConfirmationQueueItem) => void;
  /** Current editing game (to suppress own vacate requests) */
  editingGame?: { gameNumber: number; currentWinnerName: string } | null;
  /**
   * Game number the viewer currently has the initiator (scoring) modal open
   * for. When set, the realtime handler suppresses confirm-opponent queue
   * entries for that game — the user's high-effort initiator submission will
   * trigger Amendment D's race-handling (agree → strong confirmation; differ
   * → auto-clear), so a stacked confirm modal would be both redundant and
   * UX-broken. Phase 2 Amendment H.
   */
  scoringGame?: { gameNumber: number } | null;
  /** Auto-confirm setting. When on, this fast-path skips the modal and lets
   *  the state-derived scan in ScoreMatch perform the auto-confirm — keeping
   *  auto-confirm a single decision site (no duplicate write). */
  autoConfirm?: boolean;
}

interface UseMatchRealtimeOptions {
  /** Callback to refetch match data */
  onMatchUpdate?: () => void;
  /** Callback to refetch lineups data */
  onLineupUpdate?: () => void;
  /** Callback to refetch games data */
  onGamesUpdate?: () => void;
  /** Callback to refetch game_confirmations data (many-eyes Layer-2) */
  onConfirmationsUpdate?: () => void;
  /** Additional options for game update handling (scoring page) */
  gameUpdateOptions?: GameUpdateOptions;
}

/**
 * Subscribe to real-time updates for entire match
 *
 * Listens for INSERT/UPDATE/DELETE events on four tables:
 * - matches: Match-level changes (status, results, lineup IDs)
 * - match_lineups: Lineup changes (player selections, lock status)
 * - match_games: Game changes (scores, confirmations, tiebreaker assignments)
 * - game_confirmations: Many-eyes witness records (refetch trigger only)
 *
 * When updates occur, triggers appropriate TanStack Query refetch callbacks.
 * Optionally handles game confirmation logic for scoring page.
 *
 * @param matchId - Match ID to subscribe to
 * @param options - Configuration with refetch callbacks
 * @returns `{ connectionStatus }` — the coarse realtime connection status
 *   (`live` | `reconnecting` | `error`) for surfacing a calm indicator and
 *   driving a polling fallback while degraded.
 */
export function useMatchRealtime(
  matchId: string | null | undefined,
  options: UseMatchRealtimeOptions
) {
  const {
    onMatchUpdate,
    onLineupUpdate,
    onGamesUpdate,
    onConfirmationsUpdate,
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
  const onConfirmationsUpdateRef = useRef(onConfirmationsUpdate);
  const gameUpdateOptionsRef = useRef(gameUpdateOptions);

  // Coarse connection status surfaced to the scoring UI. Starts optimistic
  // (`live`) so a fast, healthy connect shows no transient flash; flips to
  // `reconnecting`/`error` only when a real drop/error callback fires.
  const [connectionStatus, setConnectionStatus] =
    useState<RealtimeConnectionStatus>('live');

  // Per-subscription flags for the catch-up classifier. A ref (not state) so
  // updating it never re-renders or re-runs the subscription effect.
  const subscribeFlagsRef = useRef<SubscribeFlags>({
    hasSubscribed: false,
    reconnecting: false,
  });

  useEffect(() => {
    onMatchUpdateRef.current = onMatchUpdate;
    onLineupUpdateRef.current = onLineupUpdate;
    onGamesUpdateRef.current = onGamesUpdate;
    onConfirmationsUpdateRef.current = onConfirmationsUpdate;
    gameUpdateOptionsRef.current = gameUpdateOptions;
  }, [onMatchUpdate, onLineupUpdate, onGamesUpdate, onConfirmationsUpdate, gameUpdateOptions]);

  useEffect(() => {
    if (!matchId) return;

    // Reset per-subscription flags so a React remount (StrictMode double-mount
    // in dev, or a matchId change) starts a fresh handshake and is NOT mistaken
    // for a socket re-subscribe — which would otherwise fire a spurious
    // catch-up refetch. A real socket DROP does not re-run this effect (the
    // same channel auto-rejoins under the hood), so the flags persist across
    // CLOSED→SUBSCRIBED and the catch-up still fires there. This is the line
    // that separates "component remounted" (re-establish, no catch-up) from
    // "socket dropped" (catch up).
    subscribeFlagsRef.current = { hasSubscribed: false, reconnecting: false };

    logger.debug('[useMatchRealtime] Setting up subscription', { matchId });

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
          logger.debug('[useMatchRealtime] Match update received', { eventType: payload.eventType });
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
          logger.debug('[useMatchRealtime] Lineup update received', { eventType: payload.eventType });
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
          logger.debug('[useMatchRealtime] Game update received', { eventType: payload.eventType });
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
              scoringGame = null,
              autoConfirm = false,
            } = currentGameUpdateOptions;

            if (!match || !userTeamId) return;

            const updatedGame = payload.new as MatchGame;

            // Detect if this is a vacate request
            const isVacateRequest = !!updatedGame.vacate_requested_by;

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
                  loserValue: updatedGame.loser_value,
                  winnerValue: updatedGame.winner_value,
                  isVacateRequest: true,
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
                // Amendment H: suppress the confirm queue entry when the user
                // has their initiator (scoring) modal open for this same game.
                // Their submit will trigger Amendment D's race-detection
                // (agree → silent strong confirmation; differ → auto-clear).
                // Stacking a confirm-opponent modal on top of their open
                // initiator would be both redundant and UX-broken.
                if (
                  scoringGame &&
                  scoringGame.gameNumber === updatedGame.game_number
                ) {
                  return;
                }
                // Auto-confirm on: skip the modal here and let the state-derived
                // scan in ScoreMatch perform the auto-confirm. Keeping auto-confirm
                // a single decision site avoids this fast-path and the scan both
                // writing the same confirmation (the dup the review flagged).
                if (autoConfirm) return;

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
                  isVacateRequest: false,
                });
              }
            }
          }
        }
      )

      // Watch game_confirmations table (many-eyes Layer-2 witness records).
      // A simple refetch trigger — no confirmation-queue logic here; the
      // per-person prompt + dissent flag derive from the refetched rows.
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_confirmations',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          logger.debug('[useMatchRealtime] Confirmation update received', { eventType: payload.eventType });
          onConfirmationsUpdateRef.current?.();
        }
      )
      .subscribe((status, err) => {
        logger.debug('[useMatchRealtime] Subscription status', { status, error: err?.message });

        // Classify the status into a coarse UI state + a catch-up decision.
        // The pure classifier carries the per-subscription flags forward.
        const result = classifySubscribeEvent(
          status,
          err,
          subscribeFlagsRef.current
        );
        subscribeFlagsRef.current = result.next;
        setConnectionStatus(result.status);

        // On a true re-SUBSCRIBED (after a drop), refetch everything: realtime
        // does NOT replay rows missed while the socket was down, so this is the
        // only thing that closes the gap and brings the board back in sync —
        // no manual refresh needed. Fires at most once per drop (see classifier).
        if (result.catchUp) {
          logger.debug('[useMatchRealtime] Re-subscribed after drop — catch-up refetch');
          onMatchUpdateRef.current?.();
          onLineupUpdateRef.current?.();
          onGamesUpdateRef.current?.();
          onConfirmationsUpdateRef.current?.();
        }
      });

    return () => {
      logger.debug('[useMatchRealtime] Cleaning up subscription', { matchId });
      supabase.removeChannel(channel);
    };
    // gameUpdateOptions is intentionally NOT in this dep array — the
    // ref pattern above keeps it accessible at event-fire time without
    // causing the subscription to tear down on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  return { connectionStatus };
}
