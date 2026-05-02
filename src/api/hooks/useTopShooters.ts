/**
 * @fileoverview Top Shooters Hook (TanStack Query)
 *
 * React hook for fetching player rankings/stats for a season with handicaps.
 * Combines player season stats with calculated handicaps.
 *
 * Benefits:
 * - Automatic caching (stats cached for 5 minutes)
 * - Parallel fetching (stats, league, and handicaps load simultaneously)
 * - Request deduplication
 * - Loading and error states
 *
 * @example
 * const { players, isLoading } = useTopShooters('season-123');
 * players.forEach(p => console.log(`${p.playerName}: ${p.gamesWon}W ${p.handicap}HC`));
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { useResolvedLeaguePrefs } from './useResolvedLeaguePrefs';
import { fetchSeasonPlayerStats } from '../queries/playerStats';
import { getLeagueBySeasonId } from '../queries/leagues';
import { usePlayerHandicaps } from './usePlayerHandicaps';
import type { PlayerSeasonStats } from '../queries/playerStats';

/**
 * Player stats with calculated handicap
 */
export interface PlayerWithHandicap extends PlayerSeasonStats {
  handicap: number;
}

/**
 * Return type for useTopShooters hook.
 *
 * Phase 7 Unit 7.3: `team_format` was dropped from the leagues schema.
 * Lineup geometry comes from the resolved preferences' `lineup_size`.
 * Callers that need to switch sort behavior between 3v3 and 5v5 read
 * `lineupSize` here (3 ↔ legacy `'5_man'`; 5 ↔ legacy `'8_man'`).
 */
interface UseTopShootersResult {
  /** Player stats with handicaps, sorted by wins (descending) */
  players: PlayerWithHandicap[];
  /** True if any query is still loading */
  isLoading: boolean;
  /** Error from any failed query */
  error: Error | null;
  /** Lineup size for the league (3 = 3v3, 5 = 5v5). */
  lineupSize?: number;
}

/**
 * Hook to fetch top shooters (player rankings) for a season
 *
 * Fetches player stats from the season and calculates current handicaps.
 * Automatically sorts players by wins (descending), then win% as tiebreaker.
 *
 * Uses multiple queries in parallel:
 * 1. Player season stats (wins/losses from season games)
 * 2. League config (to get game_type, team_format, handicap_variant)
 * 3. Player handicaps (calculated from last 200 games across all seasons)
 *
 * @param seasonId - Season's primary key ID
 * @returns Object with players array, loading state, and error state
 *
 * @example
 * function TopShooters() {
 *   const { seasonId } = useParams();
 *   const { players, isLoading, error } = useTopShooters(seasonId!);
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return (
 *     <Table>
 *       {players.map((p, i) => (
 *         <TableRow key={p.playerId}>
 *           <TableCell>{i + 1}</TableCell>
 *           <TableCell>{p.playerName}</TableCell>
 *           <TableCell>{p.gamesWon}</TableCell>
 *           <TableCell>{p.gamesLost}</TableCell>
 *           <TableCell>{p.winPercentage.toFixed(1)}%</TableCell>
 *           <TableCell>{p.handicap}</TableCell>
 *         </TableRow>
 *       ))}
 *     </Table>
 *   );
 * }
 */
export function useTopShooters(seasonId: string): UseTopShootersResult {
  // Fetch player stats for the season
  const {
    data: playerStats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery({
    queryKey: queryKeys.players.statsBySeason(seasonId),
    queryFn: () => fetchSeasonPlayerStats(seasonId),
    staleTime: 5 * 60 * 1000, // 5 minutes - stats don't change that frequently
    retry: 1,
  });

  // Fetch league config (to get game_type, team_format, handicap_variant)
  const {
    data: league,
    isLoading: leagueLoading,
    error: leagueError,
  } = useQuery({
    queryKey: queryKeys.seasons.detail(seasonId), // Cache with season query
    queryFn: () => getLeagueBySeasonId(seasonId),
    staleTime: 10 * 60 * 1000, // 10 minutes - league config rarely changes
    retry: 1,
  });

  // Resolved preferences — lazy-migrates legacy leagues on first access
  const { data: leaguePrefs } = useResolvedLeaguePrefs(league?.id);
  const handicapType = leaguePrefs?.handicap_type ?? 'points';

  // Extract player IDs for handicap calculation
  const playerIds = playerStats?.map((p) => p.playerId) || [];

  // Calculate handicaps for all players in parallel
  const {
    handicaps,
    isLoading: handicapsLoading,
    errors: handicapErrors,
  } = usePlayerHandicaps({
    playerIds,
    handicapType,
    handicapVariant: league?.handicap_variant || 'standard',
    gameType: league?.game_type || 'eight_ball',
    leagueId: league?.id, // Use league ID to prioritize games from this league
    gameLimit: 200, // Standard handicap calculation uses last 200 games
  });

  // Combine loading states
  const isLoading = statsLoading || leagueLoading || (playerIds.length > 0 && handicapsLoading);

  // Combine error states (prioritize stats error, then league, then handicap)
  const error = statsError || leagueError || (handicapErrors?.[0] as Error) || null;

  const lineupSize = leaguePrefs?.lineup_size;

  // If still loading or error, return empty array
  if (isLoading || error || !playerStats || !league) {
    return {
      players: [],
      isLoading,
      error,
      lineupSize,
    };
  }

  // Combine player stats with handicaps
  const playersWithHandicaps: PlayerWithHandicap[] = playerStats.map((player) => ({
    ...player,
    handicap: handicaps.get(player.playerId)?.value ?? 0,
  }));

  // Sort based on lineup geometry. 3v3 (legacy `5_man`): sort by points
  // (wins - losses), then wins as tiebreaker. Larger lineups (5v5+,
  // legacy `8_man`): win% first, then wins. Default for unknown
  // lineup_size matches the 3v3 behavior — most leagues are 3v3.
  const sortedPlayers = playersWithHandicaps.sort((a, b) => {
    if (lineupSize === 5) {
      if (b.winPercentage !== a.winPercentage) {
        return b.winPercentage - a.winPercentage;
      }
      return b.gamesWon - a.gamesWon;
    }
    // 3v3 (default): points first, wins as tiebreaker.
    const aPoints = a.gamesWon - a.gamesLost;
    const bPoints = b.gamesWon - b.gamesLost;
    if (bPoints !== aPoints) {
      return bPoints - aPoints;
    }
    return b.gamesWon - a.gamesWon;
  });

  return {
    players: sortedPlayers,
    isLoading: false,
    error: null,
    lineupSize,
  };
}
