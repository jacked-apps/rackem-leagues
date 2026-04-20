/**
 * @fileoverview Match Query Hooks (TanStack Query)
 *
 * React hooks for fetching match data with automatic caching.
 * Wraps pure query functions with TanStack Query for state management.
 *
 * Benefits:
 * - Automatic caching (fetch once, reuse everywhere)
 * - No duplicate requests (deduplication across components)
 * - Background refetching keeps data fresh
 * - Built-in loading/error states
 *
 * @see api/queries/matches.ts - Pure query functions
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import {
  getMatchById,
  getMatchesBySeason,
  getMatchesByTeam,
  getSeasonSchedule,
  getSeasonWeeks,
  getMatchWithLeagueSettings,
  getMatchLineups,
  getMatchGames,
  completeMatch,
  getNextMatchForTeam,
  getLiveMatchesForLeague,
  getLiveMatchesForMember,
} from '../queries/matches';
import { STALE_TIME } from '../client';

/**
 * Hook to fetch match by ID with all details
 *
 * Gets complete match record with team, venue, and week details.
 * Cached for 2 minutes (matches can change during scoring).
 *
 * @param matchId - Match's primary key ID
 * @returns TanStack Query result with match data
 *
 * @example
 * const { data: match, isLoading, error } = useMatchById(matchId);
 * if (isLoading) return <LoadingSpinner />;
 * if (error) return <ErrorMessage error={error} />;
 * return <MatchCard match={match} />;
 */
export function useMatchById(matchId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.matches.detail(matchId || ''),
    queryFn: () => getMatchById(matchId!),
    enabled: !!matchId,
    staleTime: STALE_TIME.SCHEDULES, // 10 minutes
    retry: 1,
  });
}

/**
 * Hook to fetch all matches for a season
 *
 * Gets all matches with team, venue, and week details.
 * Ordered by match number.
 * Cached for 10 minutes.
 *
 * @param seasonId - Season's primary key ID
 * @returns TanStack Query result with array of matches
 *
 * @example
 * const { data: matches = [], isLoading } = useMatchesBySeason(seasonId);
 * return matches.map(match => (
 *   <MatchRow key={match.id} match={match} />
 * ));
 */
export function useMatchesBySeason(seasonId: string | null | undefined) {
  return useQuery({
    queryKey: [...queryKeys.matches.all, 'season', seasonId],
    queryFn: () => getMatchesBySeason(seasonId!),
    enabled: !!seasonId,
    staleTime: STALE_TIME.SCHEDULES, // 10 minutes
    retry: 1,
  });
}

/**
 * Fetch in-progress matches for a league.
 *
 * Used by the spectator page to list matches currently being played in the
 * league so other members can peek at them. Short stale time and
 * refetchOnWindowFocus because match status can change quickly during a
 * match night; per-match realtime subscriptions handle the live score
 * updates, but the LIST of in-progress matches can change too (matches
 * complete, new ones start).
 */
export function useLiveMatchesForLeague(leagueId: string | null | undefined) {
  return useQuery({
    queryKey: [...queryKeys.matches.all, 'league', leagueId, 'live'],
    queryFn: () => getLiveMatchesForLeague(leagueId!),
    enabled: !!leagueId,
    staleTime: 30_000, // 30s — list composition changes during match night
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

/**
 * Fetch live matches across every league where the given member is on a
 * team. Used by the cross-league dashboard spectator page.
 */
export function useLiveMatchesForMember(memberId: string | null | undefined) {
  return useQuery({
    queryKey: [...queryKeys.matches.all, 'member', memberId, 'live'],
    queryFn: () => getLiveMatchesForMember(memberId!),
    enabled: !!memberId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

/**
 * Hook to fetch all matches for a team
 *
 * Gets all matches where team is home or away.
 * Ordered by scheduled date.
 * Cached for 10 minutes.
 *
 * @param teamId - Team's primary key ID
 * @returns TanStack Query result with array of matches
 *
 * @example
 * const { data: matches = [], isLoading } = useMatchesByTeam(teamId);
 * const upcomingMatches = matches.filter(m => m.status === 'scheduled');
 * return <TeamSchedule matches={upcomingMatches} />;
 */
export function useMatchesByTeam(teamId: string | null | undefined) {
  return useQuery({
    queryKey: [...queryKeys.matches.all, 'team', teamId],
    queryFn: () => getMatchesByTeam(teamId!),
    enabled: !!teamId,
    staleTime: STALE_TIME.SCHEDULES, // 10 minutes
    retry: 1,
  });
}

/**
 * Hook to fetch season schedule organized by week
 *
 * Gets all weeks and matches for a season, organized hierarchically.
 * Used for displaying full season schedule with week groupings.
 * Cached for 10 minutes.
 *
 * @param seasonId - Season's primary key ID
 * @returns TanStack Query result with week schedule data
 *
 * @example
 * const { data: schedule = [], isLoading } = useSeasonSchedule(seasonId);
 * return schedule.map(({ week, matches }) => (
 *   <WeekSection key={week.id} week={week} matches={matches} />
 * ));
 */
export function useSeasonSchedule(seasonId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.schedules.bySeason(seasonId || ''),
    queryFn: () => getSeasonSchedule(seasonId!),
    enabled: !!seasonId,
    staleTime: STALE_TIME.SCHEDULES, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: true, // Refetch when returning to schedule page
  });
}

/**
 * Hook to fetch season weeks
 *
 * Gets all week records (regular, blackout, playoffs, breaks).
 * Ordered by scheduled date.
 * Cached for 10 minutes.
 *
 * @param seasonId - Season's primary key ID
 * @returns TanStack Query result with array of weeks
 *
 * @example
 * const { data: weeks = [], isLoading } = useSeasonWeeks(seasonId);
 * const regularWeeks = weeks.filter(w => w.week_type === 'regular');
 * return <WeekSelector weeks={regularWeeks} />;
 */
export function useSeasonWeeks(seasonId: string | null | undefined) {
  return useQuery({
    queryKey: [...queryKeys.schedules.bySeason(seasonId || ''), 'weeks'],
    queryFn: () => getSeasonWeeks(seasonId!),
    enabled: !!seasonId,
    staleTime: STALE_TIME.SCHEDULES, // 10 minutes
    retry: 1,
  });
}

/**
 * Hook to fetch match with league settings for scoring
 *
 * Gets match with team names and league scoring configuration.
 * Includes handicap variants, golden break rules, and game type.
 * Used by scoring pages.
 * Cached for 10 minutes (league settings don't change during match).
 *
 * @param matchId - Match's primary key ID
 * @returns TanStack Query result with match and league settings
 *
 * @example
 * const { data: match, isLoading } = useMatchWithLeagueSettings(matchId);
 * if (isLoading) return <LoadingSpinner />;
 * return <ScoringPage match={match} handicapVariant={match.league.handicap_variant} />;
 */
export function useMatchWithLeagueSettings(matchId: string | null | undefined) {
  return useQuery({
    queryKey: [...queryKeys.matches.detail(matchId || ''), 'leagueSettings'],
    queryFn: () => getMatchWithLeagueSettings(matchId!),
    enabled: !!matchId,
    staleTime: STALE_TIME.SCHEDULES, // 10 minutes
    retry: 1,
  });
}

/**
 * Hook to fetch match lineups for both teams
 *
 * Gets lineup records for home and away teams.
 * Can optionally require both lineups to exist and be locked.
 * Used by both scoring pages (requireLocked=true) and lineup pages (requireLocked=false).
 * Cached for 0ms (live data - always refetch).
 *
 * @param matchId - Match's primary key ID
 * @param homeTeamId - Home team's primary key ID
 * @param awayTeamId - Away team's primary key ID
 * @param requireLocked - If true, throws error if lineups don't exist or aren't locked (default: true)
 * @returns TanStack Query result with { homeLineup, awayLineup } (may be null if requireLocked=false)
 *
 * @example
 * // For scoring page (requires locked lineups)
 * const { data } = useMatchLineups(matchId, homeTeamId, awayTeamId);
 *
 * @example
 * // For lineup page (allows missing lineups)
 * const { data } = useMatchLineups(matchId, homeTeamId, awayTeamId, false);
 * if (data && !data.homeLineup) console.log('Home lineup not created yet');
 */
export function useMatchLineups(
  matchId: string | null | undefined,
  homeTeamId: string | null | undefined,
  awayTeamId: string | null | undefined,
  requireLocked: boolean = true
) {
  return useQuery({
    queryKey: [...queryKeys.matches.lineup(matchId || ''), homeTeamId, awayTeamId, requireLocked],
    queryFn: () => getMatchLineups(matchId!, homeTeamId!, awayTeamId!, requireLocked),
    enabled: !!matchId && !!homeTeamId && !!awayTeamId,
    staleTime: STALE_TIME.MATCH_LIVE, // 0ms - always fresh
    retry: 1,
  });
}

/**
 * Hook to fetch match games (scoring results)
 *
 * Gets all game records for a match showing winners, confirmations, etc.
 * Returns empty array if no games exist (should not happen in normal flow).
 * Used by scoring pages to display and update game results.
 * Cached for 0ms (live data - always refetch for scoring).
 *
 * @param matchId - Match's primary key ID
 * @returns TanStack Query result with array of match games
 *
 * @example
 * const { data: games = [], isLoading } = useMatchGames(matchId);
 * const gamesMap = new Map(games.map(g => [g.game_number, g]));
 */
export function useMatchGames(matchId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.matches.games(matchId || ''),
    queryFn: () => getMatchGames(matchId!),
    enabled: !!matchId,
    staleTime: STALE_TIME.MATCH_LIVE, // 0ms - always fresh for scoring
    retry: 1,
  });
}

/**
 * Hook to complete a match after both teams verify
 *
 * Automatically invalidates match queries on success.
 *
 * @returns TanStack Query mutation result
 *
 * @example
 * const completeMatchMutation = useCompleteMatch();
 *
 * const handleCompletion = async () => {
 *   try {
 *     await completeMatchMutation.mutateAsync({
 *       matchId: 'match-123',
 *       completionData: {
 *         homeGamesWon: 10,
 *         awayGamesWon: 8,
 *         homePointsEarned: 1,
 *         awayPointsEarned: -1,
 *         winnerTeamId: 'home-team-id',
 *         matchResult: 'home_win'
 *       }
 *     });
 *   } catch (error) {
 *     console.error('Failed to complete match:', error);
 *   }
 * };
 */
export function useCompleteMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ matchId, completionData }: {
      matchId: string;
      completionData: {
        homeTeamScore?: number;
        awayTeamScore?: number;
        homeGamesWon?: number;
        awayGamesWon?: number;
        homePointsEarned?: number;
        awayPointsEarned?: number;
        winnerTeamId: string | null;
        matchResult: 'home_win' | 'away_win' | 'tie';
        homeVerifiedBy: string | null;
        awayVerifiedBy: string | null;
        resultsConfirmedByHome: boolean;
        resultsConfirmedByAway: boolean;
      };
    }) => completeMatch(matchId, completionData),
    onSuccess: (_, variables) => {
      // Invalidate match details
      queryClient.invalidateQueries({
        queryKey: queryKeys.matches.detail(variables.matchId),
      });

      // Invalidate season schedule (match status changed)
      queryClient.invalidateQueries({
        queryKey: queryKeys.matches.all,
      });
    },
  });
}

/**
 * Hook to fetch next upcoming or in-progress match for a team
 *
 * Returns the first match that is either in_progress or scheduled for today/future.
 * Used for "Quick Score" functionality on My Teams page.
 * Cached for 5 minutes.
 *
 * @param teamId - Team's primary key ID
 * @returns TanStack Query result with next match or null
 *
 * @example
 * const { data: nextMatch } = useNextMatchForTeam(teamId);
 * if (nextMatch) {
 *   // Always go to lineup page - it handles redirect to scoring if lineups are locked
 *   navigate(`/match/${nextMatch.id}/lineup`);
 * }
 */
export function useNextMatchForTeam(teamId: string | null | undefined) {
  return useQuery({
    queryKey: [...queryKeys.matches.all, 'team', teamId, 'next'],
    queryFn: () => getNextMatchForTeam(teamId!),
    enabled: !!teamId,
    staleTime: STALE_TIME.SHORT, // 5 minutes
    retry: 1,
  });
}
