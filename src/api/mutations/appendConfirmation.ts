/**
 * @fileoverview `appendConfirmation` — the single "record a vouch" path for
 * live-scoring Layer-2 ("many-eyes").
 *
 * Every vouch (initial score, opponent confirm, auto-confirm) and every vacate
 * funnels through here to append one row to `game_confirmations`. Two hard
 * rules, both in service of "scoring must never break":
 *
 *  1. It NEVER changes officiality. Officiality stays on
 *     `match_games.confirmed_by_home/away`, written by the scoring mutations
 *     BEFORE this runs. This helper only records who vouched for what.
 *  2. It NEVER throws into the scoring flow. It is best-effort: on any failure
 *     it logs and returns `false`, so a recording hiccup can't break a live
 *     match. The officiality write has already succeeded by the time we get
 *     here — and the two official confirmers are durably recorded in the
 *     `match_games` columns regardless, so a missed append loses only
 *     redundant/reconstructable audit data.
 *
 * Append-only semantics:
 *  - A changed result is a NEW row (history preserved).
 *  - An identical re-tap of the member's latest vouch for the game is a no-op.
 *  - Recording is match-bounded: no-op once the match is finalized
 *    (`matches.status === 'completed'`). In practice the scoring page has
 *    already navigated away by then (see `MatchEndVerification`); this guard is
 *    belt-and-suspenders for the sub-second race, not the primary freeze.
 *
 * @see docs/plans/2026-05-25-001-feat-many-eyes-confirmation-tracking-plan.md (Unit 2)
 */

import { supabase } from '@/supabaseClient';
import { logger } from '@/utils/logger';

/** Which side a confirmer vouches for. */
export type ConfirmationSide = 'home' | 'away';

/** A vouch for a result, or a marker that the game was vacated/wiped. */
export type ConfirmationAction = 'confirm' | 'vacate';

/**
 * The full result a person vouches for — mirrors the scored `match_games`
 * fields. For a `vacate` marker this is the snapshot of what was wiped (so the
 * audit trail records what the vacate undid).
 */
export interface ConfirmationResult {
  winnerTeamId: string | null;
  winnerPlayerId: string | null;
  breakAndRun: boolean;
  goldenBreak: boolean;
  breakFouled: boolean;
  runout: boolean;
  winByForfeit: boolean;
  winnerValue: number | null;
  loserValue: number | null;
}

export interface AppendConfirmationParams {
  /** The `match_games.id` this vouch is about. */
  gameId: string;
  /** The owning `matches.id` (also the realtime filter + freeze lookup). */
  matchId: string;
  /** 1-based game number (denormalized for convenient per-game reads). */
  gameNumber: number;
  /** The acting member's id. A null/empty id is a no-op (can't attribute). */
  confirmerId: string | null;
  /** The side the confirmer vouches for. */
  side: ConfirmationSide;
  /** The full result vouched for (or the pre-wipe snapshot for a vacate). */
  result: ConfirmationResult;
  /** 'confirm' (default) records a vouch; 'vacate' records a wipe marker. */
  action?: ConfirmationAction;
  /**
   * **Required.** `true` when this row was created by a person filling out the
   * result details from scratch (`handleConfirmScore` — entered winner, extras,
   * points). `false` when the row was created by tapping Confirm on someone
   * else's already-entered details (`confirmOpponentScore`) or by a vacate
   * marker. Multiple `is_initiator=true` rows per `(game_id, side)` are valid:
   * agreement = stronger confirmation, disagreement = the dispute path.
   * No default — every caller must be explicit about the role they're recording.
   */
  isInitiator: boolean;
  /**
   * `true` when this vouch was produced automatically by the confirmer's
   * Auto-Confirm mode (no modal — the scan fired it). `false` (default) for a
   * manually-tapped confirm, an initiator's hand-entered result, or a vacate
   * marker. Integrity metric only: an auto-confirmed vouch is weaker evidence
   * than a manual one (the person trusted the scorekeeping rather than actively
   * verifying), so a future analyzer can weight them differently. Never affects
   * officiality or counting.
   */
  autoConfirmed?: boolean;
  /**
   * Optional ~255-char operator note explaining a correction (LO match review).
   * Null on normal vouch rows; set on an operator override row to document why a
   * team-confirmed result was overturned. Surfaced only in the operator-facing
   * confirmer-audit.
   */
  reason?: string | null;
}

/** Row shape we read back when checking the member's latest vouch. */
interface LatestVouch {
  action: string;
  winner_team_id: string | null;
  winner_player_id: string | null;
  break_and_run: boolean;
  golden_break: boolean;
  break_fouled: boolean;
  runout: boolean;
  win_by_forfeit: boolean;
  winner_value: number | null;
  loser_value: number | null;
}

/**
 * Is `incoming` byte-identical to the member's `latest` vouch? Action first
 * (a confirm→vacate or vacate→confirm is always a new record), then every
 * result field. Used to suppress an identical re-tap without blocking a genuine
 * change of mind (which differs on at least one field).
 */
function isSameVouch(
  latest: LatestVouch,
  action: ConfirmationAction,
  result: ConfirmationResult
): boolean {
  return (
    latest.action === action &&
    latest.winner_team_id === result.winnerTeamId &&
    latest.winner_player_id === result.winnerPlayerId &&
    latest.break_and_run === result.breakAndRun &&
    latest.golden_break === result.goldenBreak &&
    latest.break_fouled === result.breakFouled &&
    latest.runout === result.runout &&
    latest.win_by_forfeit === result.winByForfeit &&
    latest.winner_value === result.winnerValue &&
    latest.loser_value === result.loserValue
  );
}

/**
 * Append a vouch (or vacate marker) to `game_confirmations`. Best-effort and
 * append-only; see the file overview for the full contract.
 *
 * @returns `true` if a row was inserted; `false` if it was a deliberate no-op
 *   (no confirmer, match finalized, exact duplicate) OR if the append failed
 *   (failures are swallowed — they must never surface to the scoring flow).
 */
export async function appendConfirmation(
  params: AppendConfirmationParams
): Promise<boolean> {
  const {
    gameId,
    matchId,
    gameNumber,
    confirmerId,
    side,
    result,
    action = 'confirm',
    isInitiator,
    autoConfirmed = false,
    reason = null,
  } = params;

  try {
    // Can't attribute a vouch without a confirmer — skip (don't insert a null).
    if (!confirmerId) {
      logger.debug('[appendConfirmation] skipped — no confirmer id', {
        gameId,
        action,
      });
      return false;
    }

    // Match-bounded: no-op once finalized. Belt-and-suspenders behind the
    // nav-off that already unmounts the scoring page at finalization.
    const { data: matchRow } = await supabase
      .from('matches')
      .select('status')
      .eq('id', matchId)
      .maybeSingle();
    if (matchRow?.status === 'completed') {
      logger.debug('[appendConfirmation] skipped — match finalized', { gameId });
      return false;
    }

    // No-exact-dup: compare against this member's latest vouch for the game.
    // (An app-level check, not a DB constraint — the small TOCTOU window is
    // acceptable for a best-effort audit; a genuine change of mind still
    // appends because it differs on a field.)
    const { data: latest } = await supabase
      .from('game_confirmations')
      .select(
        'action, winner_team_id, winner_player_id, break_and_run, golden_break, break_fouled, runout, win_by_forfeit, winner_value, loser_value'
      )
      .eq('game_id', gameId)
      .eq('confirmer_id', confirmerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest && isSameVouch(latest as LatestVouch, action, result)) {
      return false; // identical re-tap → no-op
    }

    const { error } = await supabase.from('game_confirmations').insert({
      match_id: matchId,
      game_id: gameId,
      game_number: gameNumber,
      confirmer_id: confirmerId,
      side,
      action,
      is_initiator: isInitiator,
      auto_confirmed: autoConfirmed,
      reason,
      winner_team_id: result.winnerTeamId,
      winner_player_id: result.winnerPlayerId,
      break_and_run: result.breakAndRun,
      golden_break: result.goldenBreak,
      break_fouled: result.breakFouled,
      runout: result.runout,
      win_by_forfeit: result.winByForfeit,
      winner_value: result.winnerValue,
      loser_value: result.loserValue,
    });
    if (error) throw error;

    return true;
  } catch (err) {
    // Best-effort: swallow. The officiality write already succeeded; a missed
    // audit row never breaks scoring. Supabase errors are plain objects (not
    // Error instances), so pull `.message` before falling back to String().
    const message =
      err instanceof Error
        ? err.message
        : (err as { message?: unknown } | null)?.message != null
          ? String((err as { message: unknown }).message)
          : String(err);
    logger.error(
      '[appendConfirmation] best-effort append failed (scoring unaffected)',
      { error: message, gameId, action }
    );
    return false;
  }
}
