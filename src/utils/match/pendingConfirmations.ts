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
 * Personal-vouch context for the per-person prompt logic (many-eyes Unit 4).
 *
 * Pre-derived from `game_confirmations` + the viewer's `memberId` so the
 * predicate stays a pure, cheap call inside the per-game forEach scan. Optional
 * everywhere: when omitted, the predicate falls back to the Layer-1
 * column-based check so pre-Phase-1 games (or callers that don't yet thread
 * confirmations) keep working unchanged.
 *
 * - `myVouchedGameIds`: game ids where the viewer has a `confirm` row — used
 *   as a dedup guard (no re-prompt once I've personally vouched).
 * - `scoringSideByGameId`: per game id, which side initiated scoring — derived
 *   from the OLDEST `confirm` row's `side`. Used to limit the prompt to the
 *   confirming (non-scoring) side, per the brainstorm's "each eligible
 *   opponent" rule (scoring-side extras vouch via Phase-3 tap-to-confirm).
 *
 * Staleness contract (Layer-1 preservation): a stale confirmations query can
 * cause RE-prompts at worst (the append's no-exact-dup guard absorbs the
 * duplicate write) — it can never LOSE a prompt. That keeps the
 * data-derived handoff's "delay possible, loss impossible" guarantee intact.
 */
export interface PersonalConfirmContext {
  myVouchedGameIds: Set<string>;
  /**
   * Per game id, the SET of sides that have at least one `is_initiator=true`
   * row (post-latest-vacate). Plural by design — multiple initiators per side
   * are valid (agreement = stronger confirmation), and cross-side initiations
   * are possible during the modal-race window (both sides initiated; resolved
   * by Amendment D's auto-clear path).
   */
  initiatorSidesByGameId: Map<string, Set<'home' | 'away'>>;
}

/**
 * The minimal row shape `buildPersonalConfirmContext` reads. Matches the
 * `game_confirmations` columns the scan needs without coupling to the full
 * Supabase `Row` type — keeps the predicate independent of database.types.ts.
 */
export interface ConfirmationRowLike {
  game_id: string;
  confirmer_id: string | null;
  side: string; // 'home' | 'away' — narrowed below
  action: string; // 'confirm' | 'vacate' — narrowed below
  is_initiator: boolean;
  created_at: string;
}

/**
 * Derive the per-person prompt context from a flat list of confirmations + the
 * viewer's member id. One pass over the rows; cheap enough to call from a
 * `useMemo` keyed on `(confirmations, memberId)`.
 *
 * - `myVouchedGameIds`: every game id with a `confirm` row whose `confirmer_id`
 *   matches `memberId`. `vacate` markers are deliberately excluded — they
 *   don't count as a personal vouch.
 * - `initiatorSidesByGameId`: per game, the set of sides that have at least
 *   one `is_initiator=true` row (Amendment C). Replaces the previous
 *   oldest-row-by-side heuristic with the explicit column. A game with no
 *   initiator rows is absent from the map (predicate falls back to Layer-1
 *   column logic).
 *
 * `memberId === null` is safe: `myVouchedGameIds` will be empty (no member can
 * match), so the predicate's per-person check returns "not yet vouched" — the
 * initiator-side filter still keeps the scorer out of prompts.
 */
export function buildPersonalConfirmContext(
  confirmations: readonly ConfirmationRowLike[],
  memberId: string | null
): PersonalConfirmContext {
  const myVouchedGameIds = new Set<string>();
  const initiatorSidesByGameId = new Map<string, Set<'home' | 'away'>>();

  for (const row of confirmations) {
    if (row.action !== 'confirm') continue; // vacate markers don't count

    if (memberId && row.confirmer_id === memberId) {
      myVouchedGameIds.add(row.game_id);
    }

    if (row.is_initiator && (row.side === 'home' || row.side === 'away')) {
      let sides = initiatorSidesByGameId.get(row.game_id);
      if (!sides) {
        sides = new Set();
        initiatorSidesByGameId.set(row.game_id, sides);
      }
      sides.add(row.side);
    }
  }

  return { myVouchedGameIds, initiatorSidesByGameId };
}

/**
 * Does this game need confirmation from the viewer?
 *
 * Two layers, in order:
 *
 *  1. **Per-person (Phase 2, `personal` provided):** the viewer is on the
 *     CONFIRMING side (i.e., the scoring side ≠ my side) and has not
 *     personally vouched yet. Several confirmers can accrue this way until
 *     each one personally taps. The scoring side gets `false` here so its
 *     extras don't surface via the live prompt — they vouch via Phase-3
 *     tap-to-confirm instead.
 *
 *  2. **Column fallback (`personal` omitted OR the game has no confirmations
 *     yet):** Layer-1's original — opponent's column is set, mine isn't.
 *     Keeps pre-Phase-1 games (and the existing pure-predicate tests) working
 *     unchanged.
 *
 * Mirrors the live realtime handler's `needMyConfirmation` check so the two
 * paths agree on what a pending confirmation is.
 *
 * @param game - The match game row.
 * @param userTeamId - The viewer's team id in this match.
 * @param homeTeamId - The match's home team id (to resolve which side is mine).
 * @param personal - Optional per-person vouch context (Phase 2).
 */
export function gameNeedsMyConfirmation(
  game: MatchGame,
  userTeamId: string,
  homeTeamId: string,
  personal?: PersonalConfirmContext
): boolean {
  if (!game.winner_player_id) return false;
  const mySide: 'home' | 'away' = userTeamId === homeTeamId ? 'home' : 'away';

  if (personal) {
    // Dedup guard: I've already personally vouched → no re-prompt.
    if (personal.myVouchedGameIds.has(game.id)) return false;

    // Per-person rule (Amendment C):
    //   - Prompt me iff the OPPOSITE side has at least one initiator AND MY
    //     side has none. My side already initiating means I'm on the scoring
    //     team (extras vouch via Phase-3 tap-to-confirm, not the live prompt).
    //   - When BOTH sides have initiators (the cross-side modal-race window),
    //     no live prompt fires — the dispute-banner path (Amendments D + F)
    //     takes over.
    const sides = personal.initiatorSidesByGameId.get(game.id);
    if (sides) {
      const oppSide: 'home' | 'away' = mySide === 'home' ? 'away' : 'home';
      return sides.has(oppSide) && !sides.has(mySide);
    }
    // Else: no initiator rows yet for this game (pre-Phase-1 or a not-yet-
    // recorded game) → fall through to the Layer-1 column check below.
  }

  const myConfirmed = mySide === 'home' ? game.confirmed_by_home : game.confirmed_by_away;
  const opponentConfirmed = mySide === 'home' ? game.confirmed_by_away : game.confirmed_by_home;
  return !myConfirmed && !!opponentConfirmed;
}

/**
 * The action the viewer owes on a game, derived purely from its row + the
 * viewer's auto-confirm setting. The single decision the ScoreMatch derive-scan
 * dispatches on (the scan keeps the stateful dedup guards; this stays pure and
 * testable).
 *
 * - `vacate`      — the opponent asked to undo this game; prompt to agree/deny.
 * - `autoconfirm` — the opponent scored a game I haven't confirmed AND I have
 *                   auto-confirm on; confirm it without a modal.
 * - `confirm`     — same, but auto-confirm is off; show the confirm modal.
 * - `none`        — nothing owed.
 *
 * Vacate takes precedence: a vacate request rides on an already-confirmed game,
 * so the two conditions are mutually exclusive in practice, but ordering keeps
 * the contract explicit.
 *
 * @param game - The match game row.
 * @param userTeamId - The viewer's team id in this match.
 * @param homeTeamId - The match's home team id.
 * @param autoConfirm - Whether the viewer has auto-confirm enabled.
 */
export type PendingAction = 'vacate' | 'autoconfirm' | 'confirm' | 'none';

export function decidePendingAction(
  game: MatchGame,
  userTeamId: string,
  homeTeamId: string,
  autoConfirm: boolean,
  personal?: PersonalConfirmContext
): PendingAction {
  if (gameHasPendingVacateForMe(game, userTeamId, homeTeamId)) return 'vacate';
  if (gameNeedsMyConfirmation(game, userTeamId, homeTeamId, personal)) {
    return autoConfirm ? 'autoconfirm' : 'confirm';
  }
  return 'none';
}

/**
 * Does this game have a pending vacate (undo) request from the OTHER team that
 * the viewer must agree to or deny?
 *
 * True when a side has requested to vacate the game and it was the OPPONENT's
 * side (not the viewer's). Derived from `vacate_requested_by` (which records
 * the requesting side) rather than a transient local flag, so it survives a
 * dropped realtime event, a refresh, or a remount — the requester's own device
 * correctly never prompts itself, because `vacate_requested_by` equals its own
 * side.
 *
 * @param game - The match game row.
 * @param userTeamId - The viewer's team id in this match.
 * @param homeTeamId - The match's home team id (to resolve which side is mine).
 */
export function gameHasPendingVacateForMe(
  game: MatchGame,
  userTeamId: string,
  homeTeamId: string
): boolean {
  if (!game.vacate_requested_by) return false;
  if (!game.winner_player_id) return false; // nothing meaningful to vacate
  const mySide = userTeamId === homeTeamId ? 'home' : 'away';
  return game.vacate_requested_by !== mySide;
}

/**
 * Build the vacate-confirmation item the dialog renders, from a game row.
 * Same fields as a normal confirmation plus `isVacateRequest: true`, which
 * flips the dialog into "Agree – Vacate Winner / Deny – Keep Winner" mode.
 *
 * @param game - The match game row with a pending vacate request.
 * @param players - Player lookup map for resolving the winner's display name.
 */
export function buildVacateConfirmationItem(
  game: MatchGame,
  players: Map<string, Player>
): ConfirmationQueueItem {
  return { ...buildConfirmationItem(game, players), isVacateRequest: true };
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
    earlyEight: game.early_eight,
    winnerValue: game.winner_value,
    loserValue: game.loser_value,
  };
}
