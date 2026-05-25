/**
 * @fileoverview Derive "which games are waiting for MY confirmation" from the
 * games data (live-scoring handoff stability).
 *
 * The two-scorekeeper handoff is: team A scores a game (sets the winner and
 * confirms their own side) → team B must confirm it → the game is official.
 *
 * Historically the confirm prompt on team B's device was fired ONLY by a live
 * realtime message. If that message was missed for any reason — a socket drop,
 * a React remount (incl. dev StrictMode), or a plain page refresh — the prompt
 * was lost forever, because nothing re-derived it from the data. That made the
 * handoff only as reliable as the realtime connection.
 *
 * These helpers compute the pending-confirmation state from the `match_games`
 * rows themselves (the source of truth). Run on every load / refetch / poll,
 * the prompt becomes self-healing: a hiccup can delay it by a few seconds but
 * can never lose it. Realtime becomes a fast-path, not the only path.
 */

import { getPlayerNicknameById } from '@/types/member';
import type { MatchGame, ConfirmationQueueItem, Player } from '@/types';

/**
 * Does this game need confirmation from the viewer's team?
 *
 * True when a result exists (a winner is set), the OPPONENT side has confirmed
 * it, and the viewer's side has NOT. That's exactly the "the other team entered
 * a result, you verify it" state. A game with no winner, or already confirmed
 * by my side, or not yet confirmed by the opponent, does not need my prompt.
 *
 * Mirrors the live realtime handler's `needMyConfirmation` check so the two
 * paths agree on what a pending confirmation is.
 *
 * @param game - The match game row.
 * @param userTeamId - The viewer's team id in this match.
 * @param homeTeamId - The match's home team id (to resolve which side is mine).
 */
export function gameNeedsMyConfirmation(
  game: MatchGame,
  userTeamId: string,
  homeTeamId: string
): boolean {
  if (!game.winner_player_id) return false;
  const iAmHome = userTeamId === homeTeamId;
  const myConfirmed = iAmHome ? game.confirmed_by_home : game.confirmed_by_away;
  const opponentConfirmed = iAmHome
    ? game.confirmed_by_away
    : game.confirmed_by_home;
  return !myConfirmed && !!opponentConfirmed;
}

/**
 * Build the confirmation-queue item the dialog renders, from a game row.
 *
 * Forwards every scored field as-is; the dialog is dumb and displays whatever
 * is truthy. Uses the current `ConfirmationQueueItem` shape
 * (`winnerValue`/`loserValue`).
 *
 * @param game - The match game row needing confirmation.
 * @param players - Player lookup map for resolving the winner's display name.
 */
export function buildConfirmationItem(
  game: MatchGame,
  players: Map<string, Player>
): ConfirmationQueueItem {
  return {
    gameNumber: game.game_number,
    winnerPlayerName: getPlayerNicknameById(game.winner_player_id, players),
    breakAndRun: game.break_and_run,
    goldenBreak: game.golden_break,
    breakFouled: game.break_fouled,
    runout: game.runout,
    winByForfeit: game.win_by_forfeit,
    winnerValue: game.winner_value,
    loserValue: game.loser_value,
  };
}
