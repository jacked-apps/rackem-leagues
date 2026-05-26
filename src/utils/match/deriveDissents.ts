/**
 * @fileoverview Derive per-game dissents from `game_confirmations` against each
 * game's official result (many-eyes Layer-2 / Unit 5).
 *
 * A **dissent** is a `confirm` row whose snapshot differs from the official
 * `match_games` result on any tracked field (winner, the extras, or the per-game
 * points). It is NOT an "argument-solver" — the dissent flag is a calm,
 * team-visible prompt to talk and re-check in person. Correction is the
 * existing vacate-and-rescore path; the flag never auto-changes a result.
 *
 * Two correctness rules baked in here:
 *
 *  1. **Post-vacate scope.** After a vacate-and-rescore, the pre-vacate vouches
 *     remain in the append-only history but MUST NOT raise a dissent against
 *     the NEW official result — that would falsely name people who agreed at
 *     the time. We filter to `confirm` rows newer than the game's latest
 *     `vacate` marker (Unit 2 writes that marker from the wipe paths).
 *
 *  2. **All-fields comparison.** Two people can agree on the winner but differ
 *     on an extra (B&R vs golden break) or on the points — and that difference
 *     matters for ratings integrity. Any field difference is a dissent.
 *
 * Output is pure data (ids only). Name resolution + rendering belongs in the
 * `<DissentFlag>` component (which has the player lookup map).
 */

/** The mutable result fields a vouch snapshots — must match the schema columns. */
export interface ResultLike {
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

/** A confirmation row carrying the full result snapshot — superset of what
 *  pendingConfirmations' `ConfirmationRowLike` reads. Defined locally to keep
 *  this module decoupled from the Supabase generated `Row` type. */
export interface ConfirmationWithResult extends ResultLike {
  game_id: string;
  confirmer_id: string | null;
  side: string; // 'home' | 'away' — narrowed in output
  action: string; // 'confirm' | 'vacate'
  created_at: string;
}

/** A game's official state needed to compute its dissents. */
export interface GameForDissent extends ResultLike {
  game_id: string;
  game_number: number;
  /** True only when an official result exists (a winner is set). */
  hasWinner: boolean;
}

/** A single dissenter — vouched a different result than the official one. */
export interface Dissenter {
  confirmer_id: string;
  side: 'home' | 'away';
  vouched: ResultLike;
}

/** A confirmer whose vouch matches the official result. */
export interface AgreeingConfirmer {
  confirmer_id: string;
  side: 'home' | 'away';
}

/** All dissents (and the agreeing confirmers) for one game. */
export interface GameDissent {
  game_id: string;
  game_number: number;
  dissenters: Dissenter[];
  agreeingConfirmers: AgreeingConfirmer[];
}

/**
 * Returns true if any tracked field on `vouch` differs from `official`. Strict
 * equality is correct here — all fields are primitives (string/uuid/bool/int)
 * or null; `0 !== null` and `false !== null` are the right discriminations.
 */
function resultsDiffer(official: ResultLike, vouch: ResultLike): boolean {
  return (
    official.winner_team_id !== vouch.winner_team_id ||
    official.winner_player_id !== vouch.winner_player_id ||
    official.break_and_run !== vouch.break_and_run ||
    official.golden_break !== vouch.golden_break ||
    official.break_fouled !== vouch.break_fouled ||
    official.runout !== vouch.runout ||
    official.win_by_forfeit !== vouch.win_by_forfeit ||
    official.winner_value !== vouch.winner_value ||
    official.loser_value !== vouch.loser_value
  );
}

function extractResult(row: ConfirmationWithResult): ResultLike {
  return {
    winner_team_id: row.winner_team_id,
    winner_player_id: row.winner_player_id,
    break_and_run: row.break_and_run,
    golden_break: row.golden_break,
    break_fouled: row.break_fouled,
    runout: row.runout,
    win_by_forfeit: row.win_by_forfeit,
    winner_value: row.winner_value,
    loser_value: row.loser_value,
  };
}

/**
 * Per game, compute the set of dissenters (and agreeing confirmers) against
 * the current official result. Games with no winner are skipped (nothing to
 * compare). Confirmations older than the game's latest `vacate` marker are
 * excluded so a vacate-and-rescore wipes the slate cleanly.
 *
 * @param games - The match's games with their current official result snapshot.
 * @param confirmations - All `game_confirmations` rows for the match.
 * @returns One `GameDissent` per game that has at least one dissenter; games
 *   with full agreement (or no confirmations) are omitted.
 */
export function deriveDissents(
  games: readonly GameForDissent[],
  confirmations: readonly ConfirmationWithResult[]
): GameDissent[] {
  // Bucket confirmations by game_id once — O(n) instead of O(n*m).
  const byGame = new Map<string, ConfirmationWithResult[]>();
  for (const c of confirmations) {
    const bucket = byGame.get(c.game_id);
    if (bucket) bucket.push(c);
    else byGame.set(c.game_id, [c]);
  }

  const results: GameDissent[] = [];

  for (const g of games) {
    if (!g.hasWinner) continue;

    const rows = byGame.get(g.game_id) ?? [];
    if (rows.length === 0) continue;

    // Find this game's latest vacate marker (if any) — confirms older than it
    // are pre-vacate history, not live dissents against the post-rescore result.
    let latestVacateAt: string | null = null;
    for (const r of rows) {
      if (r.action === 'vacate' && (latestVacateAt === null || r.created_at > latestVacateAt)) {
        latestVacateAt = r.created_at;
      }
    }

    const dissenters: Dissenter[] = [];
    const agreeing: AgreeingConfirmer[] = [];

    for (const r of rows) {
      if (r.action !== 'confirm') continue;
      if (latestVacateAt !== null && r.created_at <= latestVacateAt) continue;
      if (!r.confirmer_id) continue; // skip malformed rows; never throw
      if (r.side !== 'home' && r.side !== 'away') continue;

      if (resultsDiffer(g, r)) {
        dissenters.push({
          confirmer_id: r.confirmer_id,
          side: r.side,
          vouched: extractResult(r),
        });
      } else {
        agreeing.push({ confirmer_id: r.confirmer_id, side: r.side });
      }
    }

    if (dissenters.length > 0) {
      results.push({
        game_id: g.game_id,
        game_number: g.game_number,
        dissenters,
        agreeingConfirmers: agreeing,
      });
    }
  }

  return results;
}
