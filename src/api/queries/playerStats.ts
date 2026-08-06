/**
 * @fileoverview Player Stats Query Functions
 *
 * Pure data fetching functions for player statistics queries.
 * These functions return plain data and throw errors (no loading states).
 * Used by TanStack Query hooks for caching and state management.
 */

import { supabase } from '@/supabaseClient';
import { SUB_SENTINEL_IDS } from '@/utils/lineup/substituteHelpers';

/**
 * Player season stats from match games
 */
export interface PlayerSeasonStats {
  playerId: string;
  playerName: string;
  gamesWon: number;
  gamesLost: number;
  gamesPlayed: number;
  winPercentage: number;
}

/**
 * Fetch season player statistics
 *
 * Gets individual game performance for all players in a season.
 * Only includes:
 * - Completed and verified matches
 * - Regular games (excludes tiebreakers where is_tiebreaker = true)
 * - Games where both teams confirmed
 *
 * Calculates per-player:
 * - Games won
 * - Games lost (participated but didn't win)
 * - Win percentage
 *
 * @param seasonId - Season's primary key ID
 * @returns Array of player stats for the season
 * @throws Error if database query fails
 *
 * @example
 * const stats = await fetchSeasonPlayerStats('season-123');
 * stats.forEach(player => {
 *   console.log(`${player.playerName}: ${player.gamesWon}W-${player.gamesLost}L`);
 * });
 */
export async function fetchSeasonPlayerStats(seasonId: string): Promise<PlayerSeasonStats[]> {
  // Fetch all games from completed/verified matches in this season (excluding tiebreakers)
  const { data: gamesData, error: gamesError } = await supabase
    .from('match_games')
    .select(`
      home_player_id,
      away_player_id,
      winner_player_id,
      game_type,
      match:matches!inner(
        id,
        season_id,
        status,
        home_team_verified_by,
        away_team_verified_by
      )
    `)
    .eq('match.season_id', seasonId)
    .eq('match.status', 'completed')
    .not('match.home_team_verified_by', 'is', null)
    .not('match.away_team_verified_by', 'is', null)
    .eq('is_tiebreaker', false) as any; // TypeScript struggles with nested filters

  if (gamesError) {
    throw new Error(`Failed to fetch season player stats: ${gamesError.message}`);
  }

  if (!gamesData || gamesData.length === 0) {
    return [];
  }

  // Extract player IDs from games (players can be home OR away)
  const playerIds = new Set<string>();
  gamesData.forEach((game: any) => {
    if (game.home_player_id) playerIds.add(game.home_player_id);
    if (game.away_player_id) playerIds.add(game.away_player_id);
  });

  // Fetch player names
  const { data: playersData, error: playersError } = await supabase
    .from('members')
    .select('id, first_name, last_name, nickname')
    .in('id', Array.from(playerIds));

  if (playersError) {
    throw new Error(`Failed to fetch player names: ${playersError.message}`);
  }

  // Create player name map (use full name for Top Shooters display)
  const playerNames = new Map<string, string>();
  playersData?.forEach((player) => {
    const displayName = `${player.first_name} ${player.last_name}`;
    playerNames.set(player.id, displayName);
  });

  // Calculate stats per player
  const playerStatsMap = new Map<string, { wins: number; losses: number }>();

  gamesData.forEach((game: any) => {
    const homePlayerId = game.home_player_id;
    const awayPlayerId = game.away_player_id;
    const winnerPlayerId = game.winner_player_id;

    // Skip games without winner (shouldn't happen for completed matches)
    if (!winnerPlayerId) return;

    // Process home player
    if (homePlayerId) {
      const stats = playerStatsMap.get(homePlayerId) || { wins: 0, losses: 0 };
      if (winnerPlayerId === homePlayerId) {
        stats.wins++;
      } else {
        stats.losses++;
      }
      playerStatsMap.set(homePlayerId, stats);
    }

    // Process away player
    if (awayPlayerId) {
      const stats = playerStatsMap.get(awayPlayerId) || { wins: 0, losses: 0 };
      if (winnerPlayerId === awayPlayerId) {
        stats.wins++;
      } else {
        stats.losses++;
      }
      playerStatsMap.set(awayPlayerId, stats);
    }
  });

  // Drop the substitute sentinels — they're fictional system placeholders,
  // not real players, so they must never appear on the Top Shooters board.
  // Real opponents' wins/losses were tallied independently above, so removing
  // the sentinel's own entry leaves everyone else's record intact.
  SUB_SENTINEL_IDS.forEach((id) => playerStatsMap.delete(id));

  // Convert to array and add player names
  const playerStats: PlayerSeasonStats[] = [];
  playerStatsMap.forEach((stats, playerId) => {
    const gamesPlayed = stats.wins + stats.losses;
    const winPercentage = gamesPlayed > 0 ? (stats.wins / gamesPlayed) * 100 : 0;

    playerStats.push({
      playerId,
      playerName: playerNames.get(playerId) || 'Unknown Player',
      gamesWon: stats.wins,
      gamesLost: stats.losses,
      gamesPlayed,
      winPercentage,
    });
  });

  return playerStats;
}
