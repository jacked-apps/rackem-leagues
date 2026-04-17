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
import { supabase } from '@/supabaseClient';
import { queryKeys } from '../queryKeys';
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
 * Return type for useTopShooters hook
 */
interface UseTopShootersResult {
  /** Player stats with handicaps, sorted by wins (descending) */
  players: PlayerWithHandicap[];
  /** True if any query is still loading */
  isLoading: boolean;
  /** Error from any failed query */
  error: Error | null;
  /** Team format for the league */
  teamFormat?: '5_man' | '8_man';
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

  // Fetch resolved preferences to get the actual handicap_type
  const { data: topShooterPrefs } = useQuery({
    queryKey: ['resolved-league-preferences', league?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('resolved_league_preferences')
        .select('handicap_type')
        .eq('league_id', league!.id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!league?.id,
  });
  const handicapType = topShooterPrefs?.handicap_type ?? 'points';

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

  // If still loading or error, return empty array
  if (isLoading || error || !playerStats || !league) {
    return {
      players: [],
      isLoading,
      error,
      teamFormat: league?.team_format,
    };
  }

  // Combine player stats with handicaps
  const playersWithHandicaps: PlayerWithHandicap[] = playerStats.map((player) => ({
    ...player,
    handicap: handicaps.get(player.playerId)?.value ?? 0,
  }));

  // Sort based on team format
  // 5-man: Sort by points (wins - losses), then wins as tiebreaker
  // 8-man: Sort by win%, then wins as tiebreaker
  const sortedPlayers = playersWithHandicaps.sort((a, b) => {
    if (league.team_format === '5_man') {
      // 5-man: Points first, wins as tiebreaker
      const aPoints = a.gamesWon - a.gamesLost;
      const bPoints = b.gamesWon - b.gamesLost;

      if (bPoints !== aPoints) {
        return bPoints - aPoints; // Most points first
      }
      return b.gamesWon - a.gamesWon; // Most wins as tiebreaker
    } else {
      // 8-man: Win% first, wins as tiebreaker
      if (b.winPercentage !== a.winPercentage) {
        return b.winPercentage - a.winPercentage; // Higher win% first
      }
      return b.gamesWon - a.gamesWon; // Most wins as tiebreaker
    }
  });

  return {
    players: sortedPlayers,
    isLoading: false,
    error: null,
    teamFormat: league.team_format,
  };
}
