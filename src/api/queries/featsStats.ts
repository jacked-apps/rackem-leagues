/**
 * @fileoverview Feats of Excellence Query Functions
 *
 * Fetches special achievement statistics for players in a season:
 * - Break & Runs: Games won with break and run
 * - Golden Breaks: Games won on the break
 * - Flawless Nights: Matches where player won every game they played
 */

import { supabase } from '@/supabaseClient';

/**
 * Player feat ranking
 */
export interface PlayerFeatRanking {
  playerId: string;
  playerName: string;
  count: number;
}

/**
 * All feats statistics for a season
 */
export interface FeatsStats {
  breakAndRuns: PlayerFeatRanking[];
  goldenBreaks: PlayerFeatRanking[];
  flawlessNights: PlayerFeatRanking[];
}

/**
 * Fetch feats of excellence statistics for a season
 *
 * Returns three rankings:
 * 1. Break & Runs - Players with most break and runs
 * 2. Golden Breaks - Players with most golden breaks
 * 3. Flawless Nights - Players with most matches where they won every game
 *
 * Only includes:
 * - Completed/verified matches
 * - Regular games (excludes tiebreakers)
 * - Players with at least 1 of each feat
 *
 * @param seasonId - Season's primary key ID
 * @returns Object with three feat rankings
 * @throws Error if database query fails
 *
 * @example
 * const feats = await fetchFeatsStats('season-123');
 * console.log(`Top Break & Run: ${feats.breakAndRuns[0].playerName} (${feats.breakAndRuns[0].count})`);
 */
export async function fetchFeatsStats(seasonId: string): Promise<FeatsStats> {
  // Step 1: Fetch all completed match IDs for this season
  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select('id')
    .eq('season_id', seasonId)
    .in('status', ['completed', 'verified']);

  if (matchesError) {
    throw new Error(`Failed to fetch matches: ${matchesError.message}`);
  }

  const matchIds = matches?.map(m => m.id) || [];

  if (matchIds.length === 0) {
    return {
      breakAndRuns: [],
      goldenBreaks: [],
      flawlessNights: [],
    };
  }

  // Step 2: Fetch all games for these matches (excluding tiebreakers).
  // Branch B Phase 1 dropped the break_and_run / golden_break boolean
  // columns. Flawless Nights still derives from per-game winner/home/away
  // player IDs on this row, so we keep this query for that purpose.
  const { data: games, error: gamesError } = await supabase
    .from('match_games')
    .select(`
      id,
      match_id,
      winner_player_id,
      is_tiebreaker,
      home_player_id,
      away_player_id,
      home_position,
      away_position
    `)
    .in('match_id', matchIds)
    .eq('is_tiebreaker', false)
    .not('winner_player_id', 'is', null);

  if (gamesError) {
    throw new Error(`Failed to fetch games: ${gamesError.message}`);
  }

  if (!games || games.length === 0) {
    return {
      breakAndRuns: [],
      goldenBreaks: [],
      flawlessNights: [],
    };
  }

  // Step 3: Count Break & Runs from game_events. Scoped to this season's
  // matches via match_id (denormalized on the events row for this exact
  // pattern). Excludes tiebreakers via the join condition.
  const tiebreakerGameIds = new Set(games.filter(g => g.is_tiebreaker).map(g => g.id));
  const eligibleGameIds = games.filter(g => !g.is_tiebreaker).map(g => g.id);

  const breakAndRunCounts = new Map<string, number>();
  const goldenBreakCounts = new Map<string, number>();

  if (eligibleGameIds.length > 0) {
    const { data: brEvents, error: brError } = await supabase
      .from('game_events')
      .select('attributed_player_id')
      .eq('event_name', 'break_and_run')
      .in('game_id', eligibleGameIds)
      .not('attributed_player_id', 'is', null);

    if (brError) {
      throw new Error(`Failed to fetch break_and_run events: ${brError.message}`);
    }

    (brEvents ?? []).forEach(row => {
      if (row.attributed_player_id) {
        const count = breakAndRunCounts.get(row.attributed_player_id) || 0;
        breakAndRunCounts.set(row.attributed_player_id, count + 1);
      }
    });

    const { data: gbEvents, error: gbError } = await supabase
      .from('game_events')
      .select('attributed_player_id')
      .eq('event_name', 'golden_break')
      .in('game_id', eligibleGameIds)
      .not('attributed_player_id', 'is', null);

    if (gbError) {
      throw new Error(`Failed to fetch golden_break events: ${gbError.message}`);
    }

    (gbEvents ?? []).forEach(row => {
      if (row.attributed_player_id) {
        const count = goldenBreakCounts.get(row.attributed_player_id) || 0;
        goldenBreakCounts.set(row.attributed_player_id, count + 1);
      }
    });
  }

  // tiebreakerGameIds is unused at runtime but the variable's existence
  // serves as a structural reminder that the events query above must
  // exclude tiebreakers — eligibleGameIds is the filter that achieves it.
  void tiebreakerGameIds;

  // Step 5: Calculate Flawless Nights (matches where player won every game they played)
  // Group games by match, player, AND position (for 5v5 double duty players)
  // Key format: "matchId|playerId|position"
  const matchPlayerPositionGames = new Map<string, { won: number; lost: number }>();

  games.forEach(game => {
    const matchId = game.match_id;
    const winnerId = game.winner_player_id;
    const homeId = game.home_player_id;
    const awayId = game.away_player_id;
    const homePosition = game.home_position;
    const awayPosition = game.away_position;

    // Track home player (by position if available, otherwise just by player)
    if (homeId) {
      const key = homePosition
        ? `${matchId}|${homeId}|${homePosition}`
        : `${matchId}|${homeId}`;

      const stats = matchPlayerPositionGames.get(key) || { won: 0, lost: 0 };
      if (winnerId === homeId) {
        stats.won++;
      } else {
        stats.lost++;
      }
      matchPlayerPositionGames.set(key, stats);
    }

    // Track away player (by position if available, otherwise just by player)
    if (awayId) {
      const key = awayPosition
        ? `${matchId}|${awayId}|${awayPosition}`
        : `${matchId}|${awayId}`;

      const stats = matchPlayerPositionGames.get(key) || { won: 0, lost: 0 };
      if (winnerId === awayId) {
        stats.won++;
      } else {
        stats.lost++;
      }
      matchPlayerPositionGames.set(key, stats);
    }
  });

  // Count flawless nights (matches where player had losses = 0 and won > 0)
  // Each position counts separately for double duty players
  const flawlessNightCounts = new Map<string, number>();
  matchPlayerPositionGames.forEach((stats, key) => {
    if (stats.lost === 0 && stats.won > 0) {
      // Extract playerId from key (format: "matchId|playerId|position" or "matchId|playerId")
      const playerId = key.split('|')[1];
      const count = flawlessNightCounts.get(playerId) || 0;
      flawlessNightCounts.set(playerId, count + 1);
    }
  });

  // Step 6: Get all unique player IDs
  const allPlayerIds = new Set<string>();
  breakAndRunCounts.forEach((_, playerId) => allPlayerIds.add(playerId));
  goldenBreakCounts.forEach((_, playerId) => allPlayerIds.add(playerId));
  flawlessNightCounts.forEach((_, playerId) => allPlayerIds.add(playerId));

  // Step 7: Fetch player names
  const { data: players, error: playersError } = await supabase
    .from('members')
    .select('id, first_name, last_name')
    .in('id', Array.from(allPlayerIds));

  if (playersError) {
    throw new Error(`Failed to fetch player names: ${playersError.message}`);
  }

  const playerNames = new Map<string, string>();
  players?.forEach(player => {
    playerNames.set(player.id, `${player.first_name} ${player.last_name}`);
  });

  // Step 8: Build rankings (only include players with at least 1)
  const breakAndRuns: PlayerFeatRanking[] = [];
  breakAndRunCounts.forEach((count, playerId) => {
    if (count > 0) {
      breakAndRuns.push({
        playerId,
        playerName: playerNames.get(playerId) || 'Unknown Player',
        count,
      });
    }
  });

  const goldenBreaks: PlayerFeatRanking[] = [];
  goldenBreakCounts.forEach((count, playerId) => {
    if (count > 0) {
      goldenBreaks.push({
        playerId,
        playerName: playerNames.get(playerId) || 'Unknown Player',
        count,
      });
    }
  });

  const flawlessNights: PlayerFeatRanking[] = [];
  flawlessNightCounts.forEach((count, playerId) => {
    if (count > 0) {
      flawlessNights.push({
        playerId,
        playerName: playerNames.get(playerId) || 'Unknown Player',
        count,
      });
    }
  });

  // Step 9: Sort by count (descending), then by name (ascending) as tiebreaker
  const sortRankings = (rankings: PlayerFeatRanking[]) => {
    return rankings.sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count; // Most feats first
      }
      return a.playerName.localeCompare(b.playerName); // Alphabetical tiebreaker
    });
  };

  return {
    breakAndRuns: sortRankings(breakAndRuns),
    goldenBreaks: sortRankings(goldenBreaks),
    flawlessNights: sortRankings(flawlessNights),
  };
}
