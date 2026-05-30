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
import { appendConfirmation, type ConfirmationResult } from '@/api/mutations/appendConfirmation';
import { resultsDiffer } from '@/utils/match/deriveDissents';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';

/**
 * Map a scored game row (or the snapshot being confirmed/vacated) to the
 * `ConfirmationResult` shape the many-eyes append helper records. Both the live
 * `match_games` row and the in-flight `gameData` object share these field
 * names, so this works for the confirm path and the vacate-marker path alike.
 */
function resultFromGame(g: {
  winner_team_id: string | null;
  winner_player_id: string | null;
  break_and_run: boolean;
  golden_break: boolean;
  break_fouled: boolean;
  runout: boolean;
  win_by_forfeit: boolean;
  winner_value: number | null;
  loser_value: number | null;
}): ConfirmationResult {
  return {
    winnerTeamId: g.winner_team_id,
    winnerPlayerId: g.winner_player_id,
    breakAndRun: g.break_and_run,
    goldenBreak: g.golden_break,
    breakFouled: g.break_fouled,
    runout: g.runout,
    winByForfeit: g.win_by_forfeit,
    winnerValue: g.winner_value,
    loserValue: g.loser_value,
  };
}

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
  /** Add confirmation to queue. Forwards the full match_games snapshot so
   *  the confirmation dialog can show every field the scorer entered. */
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

          // Add to confirmation queue (will show immediately or queue if modal is open).
          // Forward every scored field — the dialog displays whatever is truthy.
          addToConfirmationQueue({
            gameNumber,
            winnerPlayerName: getPlayerDisplayName(existingGame.winner_player_id),
            breakAndRun: existingGame.break_and_run,
            goldenBreak: existingGame.golden_break,
            breakFouled: existingGame.break_fouled,
            runout: existingGame.runout,
            winByForfeit: existingGame.win_by_forfeit,
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
    async (gameNumber: number, isVacateRequest?: boolean): Promise<boolean> => {
      if (!match) return false;

      const existingGame = gameResults.get(gameNumber);
      if (!existingGame) return false;

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
              winner_value: null,
              loser_value: null,
              confirmed_by_home: null,
              confirmed_by_away: null,
              vacate_requested_by: null,
            })
            .eq('id', existingGame.id);

          if (error) throw error;

          // Many-eyes: record the vacate as an append-only marker. The pre-wipe
          // snapshot is `existingGame` (still the in-memory pre-update state).
          // Best-effort — never blocks the vacate. is_initiator=false: a vacate
          // is not an initiation of new score details.
          await appendConfirmation({
            gameId: existingGame.id,
            matchId: match.id,
            gameNumber,
            confirmerId: memberId,
            side: isHomeTeam ? 'home' : 'away',
            action: 'vacate',
            isInitiator: false,
            result: resultFromGame(existingGame),
          });
        } else {
          // Normal score confirmation — Amendment I: three-step check before
          // locking officiality. The user's vouch is ALWAYS appended (records
          // their intent for the audit log), but the `confirmed_by_<my-side>`
          // column only gets written when ALL three are true at write time:
          //   (1) The opponent's column is set (there's something official to
          //       confirm — not a winnerless / auto-cleared state).
          //   (2) My side's column is null (we haven't locked officiality on
          //       this side yet — handled by the .is(null) filter below).
          //   (3) My modal's snapshot still matches the current official
          //       result (no re-score or edit happened underneath me).
          //
          // When the checks block the column write, the user sees a toast
          // explaining their vouch was recorded but the game state changed.
          // The dissent flag (Unit 5) surfaces any divergence to the team.
          const officialityColumn = isHomeTeam ? 'confirmed_by_home' : 'confirmed_by_away';

          // Read fresh state. Pulling all the comparison fields in one shot.
          const { data: freshRow } = await supabase
            .from('match_games')
            .select(
              'confirmed_by_home, confirmed_by_away, winner_team_id, winner_player_id, break_and_run, golden_break, break_fouled, runout, win_by_forfeit, winner_value, loser_value'
            )
            .eq('id', existingGame.id)
            .maybeSingle();

          const opponentConfirmed = freshRow
            ? !!(isHomeTeam ? freshRow.confirmed_by_away : freshRow.confirmed_by_home)
            : false;
          const dataMatches = freshRow ? !resultsDiffer(freshRow, existingGame) : false;
          const stateChanged = !freshRow || !opponentConfirmed || !dataMatches;

          if (!stateChanged) {
            // All checks pass — attempt to lock officiality. The `.is(null)`
            // filter is the final atomic safety against same-side races
            // (extras: 0 rows affected, no error — Unit 4's behavior).
            const updateData = isHomeTeam
              ? { confirmed_by_home: memberId }
              : { confirmed_by_away: memberId };
            const { error } = await supabase
              .from('match_games')
              .update(updateData)
              .eq('id', existingGame.id)
              .is(officialityColumn, null);
            if (error) throw error;
          } else if (freshRow) {
            // Surface to the user — their tap landed but the official state
            // is different from their modal. Tone is informational, not error;
            // their vouch is still recorded below.
            if (!opponentConfirmed) {
              toast.info(
                `Game ${gameNumber}: was cleared since you opened this — your vouch was logged.`
              );
            } else {
              toast.info(
                `Game ${gameNumber}: score changed since you opened this — your vouch was logged, please review.`
              );
            }
          }

          // Many-eyes: ALWAYS record my vouch attempt — even when the column
          // write was blocked above, the row preserves what I tried to vouch
          // for, with my snapshot. The dissent flag surfaces any divergence.
          // is_initiator=false: tapping Confirm on someone else's already-entered
          // details, not filling out details from scratch.
          await appendConfirmation({
            gameId: existingGame.id,
            matchId: match.id,
            gameNumber,
            confirmerId: memberId,
            side: isHomeTeam ? 'home' : 'away',
            action: 'confirm',
            isInitiator: false,
            result: resultFromGame(existingGame),
          });
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

        return true;
      } catch (err: any) {
        logger.error('Error confirming game', { error: err instanceof Error ? err.message : String(err) });
        toast.error(`Failed to confirm game: ${err.message}`);
        return false;
      }
    },
    [match, userTeamId, gameResults, queryClient, memberId]
  );

  /**
   * Deny opponent's score or vacate request
   *
   * @param gameNumber - Game number to deny
   * @param isVacateRequest - True if denying a vacate request
   */
  const denyOpponentScore = useCallback(
    async (gameNumber: number, isVacateRequest?: boolean): Promise<boolean> => {
      if (!match) return false;

      const existingGame = gameResults.get(gameNumber);
      if (!existingGame) return false;

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
          // Deny normal score. Amendment E: count distinct endorsers first —
          // if extras have endorsed this result, one denier shouldn't be able
          // to wipe a game multiple people stood behind. The deny is still
          // recorded (as a vacate marker), and the existing dissent flag
          // surfaces it to the denier's team; the OFFICIAL result stays put,
          // and proper correction is the deliberate vacate-and-rescore path.
          //
          // Pair-only (≤2 distinct endorsers post-latest-vacate) = the standard
          // initiator + first-per-side-confirmer; deny wipes (current behavior).
          // Extras (>2 distinct endorsers) = deny becomes a dissent contribution
          // without a wipe.
          const { data: latestVacate } = await supabase
            .from('game_confirmations')
            .select('created_at')
            .eq('game_id', existingGame.id)
            .eq('action', 'vacate')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          let confirmsQuery = supabase
            .from('game_confirmations')
            .select('confirmer_id')
            .eq('game_id', existingGame.id)
            .eq('action', 'confirm');
          if (latestVacate?.created_at) {
            confirmsQuery = confirmsQuery.gt('created_at', latestVacate.created_at);
          }
          const { data: confirmRows } = await confirmsQuery;
          const endorsers = new Set(
            (confirmRows ?? [])
              .map((r) => r.confirmer_id)
              .filter((id): id is string => !!id)
          );

          if (endorsers.size > 2) {
            // Extras present — record the deny but DON'T wipe. The dissent
            // flag (Unit 5) reads this as a differing view; vacate-and-rescore
            // remains the deliberate correction path.
            await appendConfirmation({
              gameId: existingGame.id,
              matchId: match.id,
              gameNumber,
              confirmerId: memberId,
              side: userTeamId === match.home_team_id ? 'home' : 'away',
              action: 'vacate',
              isInitiator: false,
              result: resultFromGame(existingGame),
            });
            toast.info(
              `Game ${gameNumber}: ${endorsers.size} people endorsed this — your dissent is recorded but the game stays scored. Talk it over; vacate-and-rescore if needed.`
            );
          } else {
            // Standard wipe — only the officiality pair has vouched.
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
                winner_value: null,
                loser_value: null,
                confirmed_by_home: null,
                confirmed_by_away: null,
                confirmed_at: null,
              })
              .eq('id', existingGame.id);
            if (error) throw error;

            // Many-eyes: record the vacate marker (pre-wipe snapshot is
            // `existingGame`). Best-effort — never blocks the deny.
            await appendConfirmation({
              gameId: existingGame.id,
              matchId: match.id,
              gameNumber,
              confirmerId: memberId,
              side: userTeamId === match.home_team_id ? 'home' : 'away',
              action: 'vacate',
              isInitiator: false,
              result: resultFromGame(existingGame),
            });
          }
        }

        // Phase 5 Unit 5.5: denial / vacate-deny clears confirmations or
        // resets the game — running totals must be recomputed so the match
        // row reflects the new confirmed-game count + recalculated points.
        if (match?.id) {
          await updateMatchRunningTotals(match.id);
        }

        // Game results will be automatically refreshed by real-time subscription
        return true;
      } catch (err: any) {
        logger.error('Error denying game', { error: err instanceof Error ? err.message : String(err) });
        toast.error(`Failed to deny game: ${err.message}`);
        return false;
      }
    },
    [match, gameResults, memberId, userTeamId]
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
        winnerValue?: number | null;
        loserValue?: number | null;
      } = {}
    ) => {
      if (!scoringGame || !match || !homeLineup || !awayLineup) return;

      const breakFouled = extras.breakFouled ?? false;
      const runout = extras.runout ?? false;
      const winByForfeit = extras.winByForfeit ?? false;
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
          winner_value: winnerValue,
          loser_value: loserValue,
          confirmed_by_home: isHomeTeamScoring ? memberId : null,
          confirmed_by_away: !isHomeTeamScoring ? memberId : null,
        };

        // ── Amendment D: initiator-race detection ─────────────────────────────
        // Before writing to match_games, re-read the row fresh from the DB.
        // The window between when the modal opened and now is a real race
        // window — another scorer (same side OR opposite side) may have
        // submitted their own initiation. Two outcomes:
        //
        //   AGREEMENT  — their result matches mine → just append my initiator
        //                row alongside theirs (strongest confirmation; both
        //                people independently filled the details and got the
        //                same answer). No overwrite of match_games.
        //
        //   DISAGREEMENT — their result differs from mine → AUTO-CLEAR.
        //                Append my initiator row (records what I tried), append
        //                a vacate marker (scopes future dissent comparisons to
        //                post-clear), clear match_games winner fields, surface
        //                to the user. Both initiator rows stay in the log; the
        //                persistent dispute banner (Amendment F) reads them.
        //
        // No existing winner = fresh game, take the standard write path below.
        const myResult = resultFromGame(gameData);
        const { data: freshRow } = await supabase
          .from('match_games')
          .select(
            'winner_team_id, winner_player_id, break_and_run, golden_break, break_fouled, runout, win_by_forfeit, winner_value, loser_value'
          )
          .eq('id', existingGame.id)
          .maybeSingle();

        if (freshRow?.winner_player_id) {
          // resultsDiffer works on the snake_case DB shape — `freshRow` (from
          // supabase) and `gameData` (the about-to-write payload) both match
          // structurally. `myResult` (camelCase) is used for the appendConfirmation
          // calls below.
          if (resultsDiffer(freshRow, gameData)) {
            // DISAGREEMENT — auto-clear the game's winner fields and record
            // both my initiator attempt + a vacate marker. Officiality columns
            // also cleared so the next initiator can take the slot cleanly.
            await appendConfirmation({
              gameId: existingGame.id,
              matchId: match.id,
              gameNumber: scoringGame.gameNumber,
              confirmerId: memberId,
              side: isHomeTeamScoring ? 'home' : 'away',
              action: 'confirm',
              isInitiator: true,
              result: myResult,
            });
            await appendConfirmation({
              gameId: existingGame.id,
              matchId: match.id,
              gameNumber: scoringGame.gameNumber,
              confirmerId: memberId,
              side: isHomeTeamScoring ? 'home' : 'away',
              action: 'vacate',
              isInitiator: false,
              result: myResult,
            });
            const { error: clearError } = await supabase
              .from('match_games')
              .update({
                winner_team_id: null,
                winner_player_id: null,
                break_and_run: false,
                golden_break: false,
                break_fouled: false,
                runout: false,
                win_by_forfeit: false,
                winner_value: null,
                loser_value: null,
                confirmed_by_home: null,
                confirmed_by_away: null,
                confirmed_at: null,
              })
              .eq('id', existingGame.id);
            if (clearError) throw clearError;

            if (match?.id) await updateMatchRunningTotals(match.id);
            toast.error(
              `Game ${scoringGame.gameNumber}: scores didn't match. Cleared — please re-enter together.`
            );
            onSuccess();
            return;
          }

          // AGREEMENT — append my initiator row alongside theirs. No overwrite.
          await appendConfirmation({
            gameId: existingGame.id,
            matchId: match.id,
            gameNumber: scoringGame.gameNumber,
            confirmerId: memberId,
            side: isHomeTeamScoring ? 'home' : 'away',
            action: 'confirm',
            isInitiator: true,
            result: myResult,
          });
          if (match?.id) await updateMatchRunningTotals(match.id);
          onSuccess();
          return;
        }

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
            winner_value: gameData.winner_value,
            loser_value: gameData.loser_value,
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

        // Many-eyes: record the scorer's vouch for the result just entered.
        // The officiality write above (confirmed_by_<side>) already succeeded;
        // this is additive + best-effort and never blocks scoring.
        // is_initiator=true: this is the high-effort act of filling out the
        // details from scratch (winner + extras + points).
        await appendConfirmation({
          gameId: existingGame.id,
          matchId: match.id,
          gameNumber: scoringGame.gameNumber,
          confirmerId: memberId,
          side: isHomeTeamScoring ? 'home' : 'away',
          action: 'confirm',
          isInitiator: true,
          result: resultFromGame(gameData),
        });

        // Phase 5 Unit 5.5: eagerly recompute the match row's running totals
        // from the current set of confirmed match_games. The new game write
        // may flip a previously-confirmed game (re-score after auto-confirm
        // overlap) or add a freshly-pending one — recompute handles both
        // safely (only fully-confirmed games count toward the totals).
        if (match?.id) {
          await updateMatchRunningTotals(match.id);
        }

        // Note: Real-time subscription will automatically refresh game results

        // Close modal and reset state
        onSuccess();
      } catch (err: any) {
        logger.error('Error saving game score', { error: err instanceof Error ? err.message : String(err) });
        toast.error(`Failed to save game score: ${err.message}`);
      }
    },
    [match, homeLineup, awayLineup, userTeamId, gameResults, memberId]
  );

  return {
    handlePlayerClick,
    confirmOpponentScore,
    denyOpponentScore,
    handleConfirmScore,
  };
}
