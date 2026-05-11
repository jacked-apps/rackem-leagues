/**
 * @fileoverview Standings Hook (TanStack Query)
 *
 * React hook for fetching team standings for a season.
 * Fetches match records and calculates team rankings.
 *
 * Benefits:
 * - Automatic caching (standings cached for 5 minutes)
 * - Request deduplication
 * - Loading and error states
 *
 * @example
 * const { standings, isLoading } = useStandings('season-123');
 * standings.forEach(team => console.log(`${team.teamName}: ${team.matchWins}W`));
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { fetchSeasonStandings, type TeamStanding } from '../queries/standings';
import { sortStandings } from '@/utils/standings/sortStandings';

/**
 * Return type for useStandings hook
 */
interface UseStandingsResult {
  /** Team standings, sorted by rank (wins → points → games) */
  standings: TeamStanding[];
  /** True if query is still loading */
  isLoading: boolean;
  /** Error from query if failed */
  error: Error | null;
}

/**
 * Hook to fetch team standings for a season
 *
 * Fetches team standings and automatically sorts by ranking logic:
 * 1. Most match wins
 * 2. Most points (tiebreaker)
 * 3. Most games won (tiebreaker)
 *
 * @param seasonId - Season's primary key ID
 * @returns Object with standings array, loading state, and error state
 *
 * @example
 * function Standings() {
 *   const { seasonId } = useParams();
 *   const { standings, isLoading, error } = useStandings(seasonId!);
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return (
 *     <Table>
 *       {standings.map((team, i) => (
 *         <TableRow key={team.teamId}>
 *           <TableCell>{i + 1}</TableCell>
 *           <TableCell>{team.teamName}</TableCell>
 *           <TableCell>{team.matchWins}</TableCell>
 *           <TableCell>{team.matchLosses}</TableCell>
 *           <TableCell>{team.points}</TableCell>
 *           <TableCell>{team.gamesWon}</TableCell>
 *         </TableRow>
 *       ))}
 *     </Table>
 *   );
 * }
 */
export function useStandings(seasonId: string): UseStandingsResult {
  // Fetch standings data for the season
  const {
    data: standingsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.stats.standings(seasonId),
    queryFn: () => fetchSeasonStandings(seasonId),
    staleTime: 5 * 60 * 1000, // 5 minutes - standings don't change that frequently
    retry: 1,
  });

  // If still loading or error, return empty array
  if (isLoading || error || !standingsData) {
    return {
      standings: [],
      isLoading,
      error: error as Error | null,
    };
  }

  // Delegates to the shared helper at @/utils/standings/sortStandings.
  // Default priority: [match_wins, games_won, points_earned] — matches
  // the prior inline behavior. R10 of the modular-league plan promotes
  // standings_sort to a per-league preference; a future PR will pass
  // the resolved priority list here instead of using the default.
  // (Phase 5 Unit 5.3 — duplicate sort logic at this site and in
  // playoffGenerator.ts has been consolidated into one helper.)
  const sortedStandings = sortStandings(standingsData);

  return {
    standings: sortedStandings,
    isLoading: false,
    error: null,
  };
}
