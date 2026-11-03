/**
 * @fileoverview Handicap game history — the games a player's handicap is
 * computed from.
 *
 * Used by calculatePlayerHandicap and the player-profile game counts.
 * (Renamed from `fetchPlayerGameHistory`: a same-named function in
 * playerGameHistory.ts has the OPPOSITE tiebreaker semantics, and the clash
 * produced the central wrong claim in the tiebreaker audit.)
 *
 * TIEBREAKER HANDICAP RULE (Ed's anti-sandbagging rule, requirement D1):
 * a tiebreak WIN counts, a tiebreak LOSS is as if the game never happened.
 * Where the credit comes from (Unit 5 of
 * docs/plans/2026-10-28-001-feat-tiebreaker-record-plan.md):
 * - A tiebreaker WITH a tiebreak record — credited from the record
 *   (src/api/queries/tiebreakSlots.ts). Its game rows are skipped here, so a
 *   player who played and won gains exactly one win, never two.
 * - A tiebreaker from BEFORE the record existed (D5: no backfill) — its game
 *   rows were overwritten as won by the winning side, so the old row rule
 *   still applies to them: keep wins, drop losses.
 */

import { supabase } from '@/supabaseClient';
import { fetchTiebreakSlots } from './tiebreakSlots';

type GameType = 'eight_ball' | 'nine_ball' | 'ten_ball';

/** One game in a player's handicap history. */
export interface HandicapGame {
  /** created_at — orders the history, newest first. */
  at: string;
  won: boolean;
  /** True for a tiebreak game; its losses are dropped before counting. */
  tiebreak: boolean;
}

/** Raw history in one scope: completed regular games + tiebreak slots, newest first. */
async function scopedHistory(
  playerId: string,
  gameType: GameType,
  leagueId: string | undefined,
  fetchLimit: number,
): Promise<HandicapGame[]> {
  // The league-scoped and unscoped queries differ only by the embedded
  // league filter. Kept as two literal selects so supabase-js can type them.
  const base = leagueId
    ? supabase
        .from('match_games')
        .select('match_id, created_at, winner_player_id, is_tiebreaker, match:matches!inner(season:seasons!inner(league_id))')
        .eq('match.season.league_id', leagueId)
    : supabase.from('match_games').select('match_id, created_at, winner_player_id, is_tiebreaker');
  const { data, error } = await base
    .or(`home_player_id.eq.${playerId},away_player_id.eq.${playerId}`)
    .not('winner_player_id', 'is', null) // Only completed games
    .eq('game_type', gameType)
    .order('created_at', { ascending: false })
    .limit(fetchLimit);
  if (error) throw new Error(`Failed to fetch player game history: ${error.message}`);
  const rows = data ?? [];

  // Tiebreak rows whose match has a record are credited from the record instead.
  const tiebreakMatchIds = [...new Set(rows.filter((g) => g.is_tiebreaker).map((g) => g.match_id))];
  let recorded = new Set<string>();
  if (tiebreakMatchIds.length > 0) {
    const { data: records, error: recErr } = await supabase
      .from('match_tiebreakers')
      .select('match_id')
      .in('match_id', tiebreakMatchIds);
    if (recErr) throw new Error(`Failed to fetch tiebreak records: ${recErr.message}`);
    recorded = new Set((records ?? []).map((r) => r.match_id));
  }

  const games: HandicapGame[] = rows
    .filter((g) => !(g.is_tiebreaker && recorded.has(g.match_id)))
    .map((g) => ({ at: g.created_at, won: g.winner_player_id === playerId, tiebreak: g.is_tiebreaker }));
  const slots = (await fetchTiebreakSlots(playerId, gameType, leagueId)).map((s) => ({ ...s, tiebreak: true }));

  return [...games, ...slots].sort((a, b) => b.at.localeCompare(a.at)).slice(0, fetchLimit);
}

/**
 * Fetch the last N handicap games for a player.
 *
 * 1. If leagueId is given, use games from ALL SEASONS in that league.
 * 2. If that is under 25% of the limit (50 for 200), widen to ALL leagues of
 *    this game type. 8-ball never counts toward 9-ball and vice versa.
 * 3. Newest first; completed games only; tiebreak losses dropped (rule above).
 *
 * The 25% fetch buffer exists for the dropped tiebreak losses: they take part
 * in the newest-N window and are removed after — unchanged from the old rule,
 * so handicaps come out identical.
 *
 * @param playerId - The player's member ID
 * @param gameType - Game type to filter
 * @param leagueId - Optional league to prioritize
 * @param limit - Maximum number of games to return (default: 200)
 * @returns Up to `limit` games — wins and losses, every tiebreak entry a win
 * @throws Error if a query fails
 *
 * @example
 * const games = await fetchHandicapHistory('player-123', 'nine_ball', 'league-456');
 * const wins = games.filter((g) => g.won).length;
 */
export async function fetchHandicapHistory(
  playerId: string,
  gameType: GameType,
  leagueId?: string,
  limit: number = 200,
): Promise<HandicapGame[]> {
  const fetchLimit = Math.ceil(limit * 1.25);
  const threshold = Math.ceil(limit * 0.25);

  let history = leagueId ? await scopedHistory(playerId, gameType, leagueId, fetchLimit) : [];
  if (history.length < threshold) {
    history = await scopedHistory(playerId, gameType, undefined, fetchLimit);
  }

  return history.filter((g) => !g.tiebreak || g.won).slice(0, limit);
}
