/**
 * @fileoverview FROZEN copy of the pre-Unit-5 handicap history — the parity
 * reference for tiebreakHandicapParity.db.test.ts.
 *
 * This is `fetchPlayerGameHistory` from src/api/queries/matchGames.ts and the
 * win/game tally from calculatePlayerHandicap, exactly as they were before the
 * tiebreak record took over the credit (docs/plans/
 * 2026-10-28-001-feat-tiebreaker-record-plan.md, Units 4–5). It reads tiebreak
 * credit from OVERWRITTEN game rows. Do not edit it to match new behavior —
 * its whole job is to stay what production did, so "identical handicaps"
 * means something.
 */

import { supabase } from '@/supabaseClient';

type GameRow = { winner_player_id: string | null; is_tiebreaker: boolean };

/** Old fetchPlayerGameHistory, verbatim logic. */
async function legacyFetch(playerId: string, gameType: string, leagueId: string | undefined, limit: number) {
  const fetchLimit = Math.ceil(limit * 1.25);
  let leagueGames: GameRow[] = [];
  if (leagueId) {
    const { data, error } = await supabase
      .from('match_games')
      .select('*, match:matches!inner(season:seasons!inner(league_id))')
      .or(`home_player_id.eq.${playerId},away_player_id.eq.${playerId}`)
      .not('winner_player_id', 'is', null)
      .eq('game_type', gameType)
      .eq('match.season.league_id', leagueId)
      .order('created_at', { ascending: false })
      .limit(fetchLimit);
    if (error) throw error;
    leagueGames = data || [];
  }
  let allGames = leagueGames;
  if (leagueGames.length < Math.ceil(limit * 0.25)) {
    const { data, error } = await supabase
      .from('match_games')
      .select('*')
      .or(`home_player_id.eq.${playerId},away_player_id.eq.${playerId}`)
      .not('winner_player_id', 'is', null)
      .eq('game_type', gameType)
      .order('created_at', { ascending: false })
      .limit(fetchLimit);
    if (error) throw error;
    allGames = data || [];
  }
  return allGames
    .filter((g) => g.is_tiebreaker !== true || g.winner_player_id === playerId)
    .slice(0, limit);
}

/**
 * The old tally: wins = rows the player won; losses = games - wins.
 *
 * @returns The counts calculatePlayerHandicap computed its handicap from
 */
export async function legacyTally(playerId: string, gameType: string, leagueId?: string, limit = 200) {
  const games = await legacyFetch(playerId, gameType, leagueId, limit);
  const wins = games.filter((g) => g.winner_player_id === playerId).length;
  return { wins, losses: games.length - wins };
}
