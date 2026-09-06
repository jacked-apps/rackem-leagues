/**
 * @fileoverview Turn raw match_games rows into per-player rows.
 *
 * Pure, and separate from the query on purpose: this is where the reasoning
 * lives — whose side the row is written from, which lineup holds the opponent's
 * handicap, which system the match was played under — and all of it is testable
 * without a database.
 *
 * @see docs/plans/2026-09-06-001-feat-my-stats-page-plan.md (Unit 1)
 */

import { handicapForPlayer, type LineupHandicaps } from './handicapForPlayer';
import type { GameEnding, PlayerGameRow } from './playerGameRow';

/** A `match_lineups` row, narrowed to what this needs. */
export interface RawLineup extends LineupHandicaps {
  team_id: string | null;
}

/** A `match_games` row with its match context, as fetched. */
export interface RawGame {
  id: string;
  game_number: number;
  home_player_id: string | null;
  away_player_id: string | null;
  winner_player_id: string | null;
  break_and_run: boolean | null;
  golden_break: boolean | null;
  runout: boolean | null;
  early_eight: boolean | null;
  win_by_forfeit: boolean | null;
  game_type: string | null;
  match: {
    id: string;
    season_id: string | null;
    home_team_id: string | null;
    away_team_id: string | null;
    assigned_table_number: number | null;
    system_snapshot: { handicap_type?: string | null } | null;
    week: { scheduled_date: string | null } | null;
    /** Where it was actually played. Null until the match is under way. */
    venue: { name: string | null } | null;
    /** Where it was meant to be played — the fallback. */
    scheduled_venue?: { name: string | null } | null;
    lineups: RawLineup[] | null;
  } | null;
}

/** Lookups resolved alongside the games. */
export interface HistoryContext {
  /** member id → display name. */
  playerNames: Map<string, string>;
  /** season id → the league's handicap_type, for matches with no snapshot. */
  seasonHandicapSystem: Map<string, string | null>;
}

/**
 * Which single ending to record for a rack.
 *
 * A game ends one way, and the database enforces that an early 8 cannot sit
 * alongside an achievement. Forfeit is checked first anyway: a forfeited game
 * was not played, so nothing else said about how it ended can be true, and the
 * scoring dialog clears the others when forfeit is switched on. The remaining
 * order never actually arbitrates — it just guarantees one answer rather than
 * depending on field order if a legacy row ever carries two.
 */
function endingOf(game: RawGame): GameEnding {
  if (game.win_by_forfeit) return 'forfeit';
  if (game.early_eight) return 'early_eight';
  if (game.golden_break) return 'golden_break';
  if (game.break_and_run) return 'break_and_run';
  if (game.runout) return 'runout';
  return 'plain';
}

/**
 * The handicap system a match was played under.
 *
 * Prefers the snapshot frozen at match start. Falls back to the league's
 * current setting ONLY for that one field, which is safe because
 * `handicap_type` cannot change on an existing league — a Postgres trigger
 * blocks it (`20260418000002_lock_tier1_preferences.sql`), so today's value is
 * necessarily the one every match of that league was played under.
 *
 * The snapshot's other contents are tier-2 dials that CAN change, which is why
 * this reads one field rather than treating the league config as a general
 * substitute for a missing snapshot.
 */
function systemOf(game: RawGame, ctx: HistoryContext): string | null {
  const fromSnapshot = game.match?.system_snapshot?.handicap_type;
  if (fromSnapshot) return fromSnapshot;
  const seasonId = game.match?.season_id;
  return seasonId ? ctx.seasonHandicapSystem.get(seasonId) ?? null : null;
}

/**
 * Rewrite raw games as rows from one player's point of view.
 *
 * @param games - Raw rows; games this player did not play are skipped rather
 *                than thrown on, so one odd row can't blank the whole page.
 * @param memberId - Whose stats these are.
 * @param ctx - Name and system lookups.
 * @returns One row per rack, newest first.
 */
export function toPlayerGameRows(
  games: RawGame[],
  memberId: string,
  ctx: HistoryContext
): PlayerGameRow[] {
  const rows: PlayerGameRow[] = [];

  for (const game of games) {
    const iAmHome = game.home_player_id === memberId;
    const iAmAway = game.away_player_id === memberId;
    if (!iAmHome && !iAmAway) continue;

    const opponentId = iAmHome ? game.away_player_id : game.home_player_id;
    const match = game.match;
    const myTeamId = iAmHome ? match?.home_team_id ?? null : match?.away_team_id ?? null;
    const opponentTeamId = iAmHome
      ? match?.away_team_id ?? null
      : match?.home_team_id ?? null;

    // The opponent's handicap lives in THEIR team's lineup for this match.
    const opponentLineup =
      match?.lineups?.find((l) => l.team_id && l.team_id === opponentTeamId) ?? null;

    rows.push({
      gameId: game.id,
      matchId: match?.id ?? '',
      gameNumber: game.game_number,
      playedOn: match?.week?.scheduled_date ?? null,
      seasonId: match?.season_id ?? null,
      // A game with no winner recorded counts as not won rather than as a loss
      // to be explained: unscored games are excluded upstream.
      won: !!game.winner_player_id && game.winner_player_id === memberId,
      ending: endingOf(game),
      gameType: game.game_type ?? null,
      opponentId,
      opponentName: (opponentId && ctx.playerNames.get(opponentId)) || 'Unknown player',
      opponentHandicap: handicapForPlayer(opponentLineup, opponentId),
      handicapSystem: systemOf(game, ctx),
      // Actual venue wins; scheduled is the fallback. A match moved on the
      // night was PLAYED somewhere else, and "my record at Butera" should mean
      // where the player actually stood, not where the schedule said.
      venueName: match?.venue?.name ?? match?.scheduled_venue?.name ?? null,
      tableNumber: match?.assigned_table_number ?? null,
      myTeamId,
    });
  }

  // Newest first — "my last 50 games" is the common question, and it makes the
  // recent-vs-previous comparison a slice rather than a sort.
  return rows.sort((a, b) => {
    const byDate = (b.playedOn ?? '').localeCompare(a.playedOn ?? '');
    return byDate !== 0 ? byDate : b.gameNumber - a.gameNumber;
  });
}
