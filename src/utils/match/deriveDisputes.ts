/**
 * @fileoverview Derive per-game disputes (many-eyes Layer-2 / Phase 2
 * Amendment F).
 *
 * A **dispute** is a game that's currently in the auto-cleared state from
 * Amendment D's race-detection logic. Specifically:
 *
 *   1. `match_games.winner_player_id` is NULL (the game has been cleared).
 *   2. A vacate marker exists for the game (it was cleared, not just unstarted).
 *   3. The `is_initiator=true` rows in the CURRENT dispute window contain at
 *      least two snapshots that disagree on at least one tracked field.
 *
 * The "current dispute window" is bounded by the two most recent vacate
 * markers: between `second_latest_vacate` (exclusive) and `latest_vacate`
 * (exclusive). For the first dispute on a game, second-latest is `null` and
 * the window stretches to the beginning of history. This scoping prevents
 * old, already-resolved disputes from re-surfacing on a fresh auto-clear.
 *
 * Output is pure ids + snapshots — name resolution belongs in the
 * `<DisputeBanner>` and `<DisputeDetailModal>` components, which have the
 * player lookup map.
 *
 * Distinguished from a NORMAL vacate-pending-rescore (e.g. a deliberate
 * deny-and-wipe with no extras): that state has the cleared winner + vacate
 * marker, but only ONE initiator row pre-vacate (or all agreeing) → not a
 * dispute.
 */

import type { ConfirmationWithResult, ResultLike } from './deriveDissents';
import { resultsDiffer } from './deriveDissents';

/** A single initiator's attempt within a dispute. */
export interface DisputeInitiation {
  confirmer_id: string;
  side: 'home' | 'away';
  snapshot: ResultLike;
  created_at: string;
}

/** A game currently in dispute (auto-cleared via Amendment D). */
export interface GameDispute {
  game_id: string;
  game_number: number;
  /** The conflicting initiator rows in the current dispute window. */
  initiations: DisputeInitiation[];
}

/** Minimal game shape `deriveDisputes` reads — just the dispute-relevant fields. */
export interface GameForDispute {
  game_id: string;
  game_number: number;
  /** True only when there's no current winner (game has been cleared). */
  hasWinner: boolean;
}

function extractResult(row: ConfirmationWithResult): ResultLike {
  return {
    winner_team_id: row.winner_team_id,
    winner_player_id: row.winner_player_id,
    break_and_run: row.break_and_run,
    golden_break: row.golden_break,
    break_fouled: row.break_fouled,
    runout: row.runout,
    early_eight: row.early_eight,
    win_by_forfeit: row.win_by_forfeit,
    winner_value: row.winner_value,
    loser_value: row.loser_value,
  };
}

/**
 * Per game, compute the current dispute (if any). Games with a current
 * winner are skipped. Games with a cleared winner are inspected: only games
 * whose CURRENT dispute window contains 2+ disagreeing initiator rows are
 * returned.
 *
 * @param games - Match games with their current `hasWinner` state.
 * @param confirmations - All `game_confirmations` rows for the match.
 * @returns One `GameDispute` per game currently in dispute; empty when none.
 */
export function deriveDisputes(
  games: readonly GameForDispute[],
  confirmations: readonly ConfirmationWithResult[]
): GameDispute[] {
  // Bucket confirmations by game_id once.
  const byGame = new Map<string, ConfirmationWithResult[]>();
  for (const c of confirmations) {
    const bucket = byGame.get(c.game_id);
    if (bucket) bucket.push(c);
    else byGame.set(c.game_id, [c]);
  }

  const disputes: GameDispute[] = [];

  for (const g of games) {
    // A game with a current winner is not in dispute (a normal scoring path
    // or a successfully-resolved dispute has put a winner back on the row).
    if (g.hasWinner) continue;

    const rows = byGame.get(g.game_id) ?? [];

    // Need at least one vacate marker — otherwise the cleared state is a
    // fresh, unscored game, not a cleared dispute.
    const vacatesDesc = rows
      .filter((r) => r.action === 'vacate')
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    if (vacatesDesc.length === 0) continue;

    const latestVacateAt = vacatesDesc[0].created_at;
    const secondLatestVacateAt: string | null =
      vacatesDesc[1]?.created_at ?? null;

    // Initiator rows in the CURRENT dispute window.
    const windowInitiators = rows.filter((r) => {
      if (r.action !== 'confirm') return false;
      if (!r.is_initiator) return false;
      if (!r.confirmer_id) return false;
      if (r.side !== 'home' && r.side !== 'away') return false;
      if (r.created_at >= latestVacateAt) return false;
      if (secondLatestVacateAt !== null && r.created_at <= secondLatestVacateAt) {
        return false;
      }
      return true;
    });

    if (windowInitiators.length < 2) continue;

    // Do any two disagree? If all agree, the cleared state isn't a dispute
    // (e.g. a normal vacate after agreement, pending rescore).
    const first = windowInitiators[0];
    const someDisagree = windowInitiators.some((r) => resultsDiffer(first, r));
    if (!someDisagree) continue;

    disputes.push({
      game_id: g.game_id,
      game_number: g.game_number,
      initiations: windowInitiators.map((r) => ({
        confirmer_id: r.confirmer_id as string,
        side: r.side as 'home' | 'away',
        snapshot: extractResult(r),
        created_at: r.created_at,
      })),
    });
  }

  return disputes;
}
