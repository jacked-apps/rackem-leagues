/**
 * @fileoverview Match Scoring Hook
 *
 * Central hook for managing match scoring across different formats (3v3, tiebreaker, 5v5).
 * Handles all data fetching, real-time subscriptions, game scoring logic, and confirmation flows.
 *
 * This hook extracts all business logic from the scoring pages, making them pure UI components.
 */
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { calculateTeamHandicap } from '@/utils/handicapCalculations';
import { shouldGoldenBreakCount } from '@/utils/goldenBreakRules';
import { getPlayerNicknameById } from '@/types/member';
import { getTeamStats, getPlayerStats, getCompletedGamesCount, calculatePoints, TIEBREAKER_THRESHOLDS } from '@/types';
import { useMatchWithLeagueSettings, useMatchLineups, useMatchGames } from '@/api/hooks/useMatches';
import { useUserTeamInMatch, useTeamDetails } from '@/api/hooks/useTeams';
import { useMatchRealtime } from '@/realtime/useMatchRealtime';
import { logger } from '@/utils/logger';
import type {
  Player,
  HandicapThresholds,
  MatchGame,
  ConfirmationQueueItem,
  MatchType,
} from '@/types';
import type { GameType } from '@/types/league';

interface UseMatchScoringOptions {
  matchId: string | undefined | null;
  memberId: string | undefined | null;
  matchType: MatchType;
  autoConfirm?: boolean;
  confirmOpponentScore?: (gameNumber: number, isVacateRequest?: boolean) => Promise<void>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useMatchScoring({
  matchId,
  memberId,
  matchType,
  autoConfirm = false,
  confirmOpponentScore
}: UseMatchScoringOptions) {
  // ============================================================================
  // TANSTACK QUERY HOOKS
  // ============================================================================

  // Fetch match with league settings
  const {
    data: matchData,
    isLoading: matchLoading,
    error: matchError,
    refetch: refetchMatch
  } = useMatchWithLeagueSettings(matchId);

  // Fetch lineups (needs team IDs from match data)
  const {
    data: lineupsData,
    isLoading: lineupsLoading,
    error: lineupsError,
    refetch: refetchLineups
  } = useMatchLineups(
    matchId,
    matchData?.home_team_id,
    matchData?.away_team_id
  );

  // Fetch user's team in this match
  const {
    data: userTeamData,
    isLoading: userTeamLoading,
    error: userTeamError
  } = useUserTeamInMatch(
    memberId,
    matchData?.home_team_id,
    matchData?.away_team_id
  );

  // Fetch match games
  const {
    data: gamesData = [],
    isLoading: gamesLoading,
    refetch: refetchGames,
  } = useMatchGames(matchId);

  // Fetch FULL team rosters (not just lineup players)
  // This allows us to look up ANY player on either team, including swap candidates
  // Team roster data is stable throughout the match - handicaps/names don't change mid-match
  const {
    data: homeTeamData,
    isLoading: homeTeamLoading
  } = useTeamDetails(matchData?.home_team_id);

  const {
    data: awayTeamData,
    isLoading: awayTeamLoading
  } = useTeamDetails(matchData?.away_team_id);

  // ============================================================================
  // LOCAL STATE
  // ============================================================================

  // Handicap data (needs state because calculated async)
  const [homeTeamHandicap, setHomeTeamHandicap] = useState(0);

  // Confirmation queue
  const [confirmationQueue, setConfirmationQueue] = useState<ConfirmationQueueItem[]>([]);

  // Track vacate requests initiated by current user (to suppress own confirmation modal)
  const myVacateRequests = useRef<Set<number>>(new Set());

  // Loading/error state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // DERIVED DATA (useMemo)
  // ============================================================================

  // Direct references to TanStack Query data (no transformation needed)
  const match = matchData || null;
  const homeLineup = lineupsData?.homeLineup || null;
  const awayLineup = lineupsData?.awayLineup || null;
  const userTeamId = userTeamData?.team_id || null;
  const isHomeTeam = userTeamData?.isHomeTeam ?? null; // Use ?? instead of || to preserve false
  const gameType = (matchData?.league.game_type || 'eight_ball') as GameType;

  // Determine if golden break counts based on preference and game type (BCA Standard rules)
  const goldenBreakCountsAsWin = useMemo(() => {
    return shouldGoldenBreakCount(gameType, matchData?.league.golden_break_counts_as_win);
  }, [gameType, matchData?.league.golden_break_counts_as_win]);

  // Build players Map from FULL team rosters (not just lineup players)
  // This allows getPlayerDisplayName to find ANY player on either team, including swap candidates
  const players = useMemo(() => {
    const playerMap = new Map<string, Player>();

    // Add all home team roster players
    homeTeamData?.team_players?.forEach((tp: any) => {
      if (tp.members) {
        playerMap.set(tp.members.id, {
          id: tp.members.id,
          first_name: tp.members.first_name,
          last_name: tp.members.last_name,
          nickname: tp.members.nickname,
        });
      }
    });

    // Add all away team roster players
    awayTeamData?.team_players?.forEach((tp: any) => {
      if (tp.members) {
        playerMap.set(tp.members.id, {
          id: tp.members.id,
          first_name: tp.members.first_name,
          last_name: tp.members.last_name,
          nickname: tp.members.nickname,
        });
      }
    });

    return playerMap;
  }, [homeTeamData, awayTeamData]);

  // Transform games array to Map for O(1) lookups (needs useMemo - expensive transformation)
  const gameResults = useMemo(() => {
    const gamesMap = new Map<number, MatchGame>();
    gamesData.forEach(game => gamesMap.set(game.game_number, game as MatchGame));
    return gamesMap;
  }, [gamesData]);

  // Get handicap thresholds from match data (saved during lineup)
  const homeThresholds = useMemo(() => {
    if (matchType === 'tiebreaker') return TIEBREAKER_THRESHOLDS;

    // Get thresholds from match table (saved during lineup lock).
    // - games_to_tie is null when a tie is impossible (e.g., 10+9=19 > 18 games).
    // - games_to_lose is null for Fargo matches: Fargo uses start-points
    //   accumulation, not a games-to-lose threshold. Only games_to_win must
    //   be non-null to signal the match is prepared.
    if (matchData && matchData.home_games_to_win !== null) {
      return {
        games_to_win: matchData.home_games_to_win,
        games_to_tie: matchData.home_games_to_tie ?? null,
        games_to_lose: matchData.home_games_to_lose ?? null,
      };
    }

    return null;
  }, [matchType, matchData]);

  const awayThresholds = useMemo(() => {
    if (matchType === 'tiebreaker') return TIEBREAKER_THRESHOLDS;

    // See homeThresholds above — same rules apply to the away side.
    if (matchData && matchData.away_games_to_win !== null) {
      return {
        games_to_win: matchData.away_games_to_win,
        games_to_tie: matchData.away_games_to_tie ?? null,
        games_to_lose: matchData.away_games_to_lose ?? null,
      };
    }

    return null;
  }, [matchType, matchData]);

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * Add a confirmation to the queue
   * Prevents duplicates by checking if game is already in queue
   */
  const addToConfirmationQueue = useCallback((confirmation: ConfirmationQueueItem) => {
    // If this is a vacate request and I initiated it, don't add to queue
    if (confirmation.isVacateRequest && myVacateRequests.current.has(confirmation.gameNumber)) {
      return;
    }

    // Check if this game is already in the queue
    setConfirmationQueue(prev => {
      const alreadyInQueue = prev.some(item => item.gameNumber === confirmation.gameNumber);
      if (alreadyInQueue) {
        return prev;
      }

      return [...prev, confirmation];
    });
  }, []);

  /**
   * Remove a confirmation from the queue (after it's shown)
   */
  const removeFromConfirmationQueue = useCallback(() => {
    setConfirmationQueue(prev => prev.slice(1));
  }, []);

  /**
   * Get display name for a player
   */
  const getPlayerDisplayName = useCallback((playerId: string | null) => {
    return getPlayerNicknameById(playerId, players);
  }, [players]);

  /**
   * Get team statistics
   */
  const getTeamStatsCallback = useCallback((teamId: string) => {
    return getTeamStats(teamId, gameResults);
  }, [gameResults]);

  /**
   * Get player statistics
   */
  const getPlayerStatsCallback = useCallback((playerId: string) => {
    return getPlayerStats(playerId, gameResults);
  }, [gameResults]);

  /**
   * Get count of completed games
   */
  const getCompletedGamesCountCallback = useCallback(() => {
    return getCompletedGamesCount(gameResults);
  }, [gameResults]);

  /**
   * Calculate points for a team
   */
  const calculatePointsCallback = useCallback((teamId: string, thresholds: HandicapThresholds | null) => {
    return calculatePoints(teamId, thresholds, gameResults);
  }, [gameResults]);

  // ============================================================================
  // DATA PROCESSING
  // ============================================================================

  /**
   * Calculate team handicap for display purposes
   * Note: Thresholds are now loaded from match table (saved during lineup)
   */
  useEffect(() => {
    async function calculateHandicaps() {
      if (!matchId || !memberId || !matchData || !lineupsData) {
        return;
      }

      // Only calculate for 3v3 matches
      if (matchType !== '3v3') {
        return;
      }

      try {
        // Calculate team handicap (only for home team in 3v3) - used for display
        const calculatedTeamHandicap = await calculateTeamHandicap(
          matchData.home_team_id,
          matchData.away_team_id,
          matchData.season_id,
          matchData.league.team_handicap_variant
        );
        setHomeTeamHandicap(calculatedTeamHandicap);
      } catch (err: any) {
        logger.error('Error calculating team handicap', {
          error: err instanceof Error ? err.message : String(err),
          matchId,
          homeTeamId: matchData?.home_team_id,
          awayTeamId: matchData?.away_team_id
        });
      }
    }

    calculateHandicaps();
  }, [matchId, memberId, matchType, matchData, lineupsData]);

  /**
   * Refetch lineups immediately on mount to ensure fresh data
   * This prevents "both lineups must be locked" errors from stale cache
   */
  useEffect(() => {
    if (matchId && matchData?.home_team_id && matchData?.away_team_id) {
      refetchLineups();
    }
  }, [matchId, matchData?.home_team_id, matchData?.away_team_id, refetchLineups]);

  /**
   * Update loading and error states based on TanStack Query status
   */
  useEffect(() => {
    if (!matchId || !memberId) {
      return;
    }

    // Check if any queries are loading OR if the data we depend on isn't materialized yet.
    //
    // The data-presence checks (!homeTeamData, !awayTeamData) guard against a race:
    // TanStack Query's isLoading flips to `false` as soon as the query resolves, which
    // is BEFORE the data reference propagates through React state on the next render.
    // Without this guard, when the home team transitions into the scoring view right
    // after the lineup-lock trigger creates match_games rows, awayTeamLoading can be
    // false (from a cached prior state or a fast cache hydration) while awayTeamData
    // is still undefined for the render. The `players` Map is then built from only the
    // home roster, and every away player's name resolves to "Unknown" — which clears
    // on page refresh because both queries start fresh and complete before first render.
    const isLoading =
      matchLoading ||
      lineupsLoading ||
      userTeamLoading ||
      gamesLoading ||
      homeTeamLoading ||
      awayTeamLoading ||
      !homeTeamData ||
      !awayTeamData;
    setLoading(isLoading);

    // Handle errors
    if (matchError) {
      setError(matchError.message || 'Failed to load match information');
    } else if (lineupsError) {
      setError(lineupsError.message || 'Failed to load lineups');
    } else if (userTeamError) {
      setError(userTeamError.message || 'Failed to determine your team');
    } else {
      setError(null);
    }
  }, [
    matchId,
    memberId,
    matchLoading,
    lineupsLoading,
    userTeamLoading,
    gamesLoading,
    homeTeamLoading,
    awayTeamLoading,
    homeTeamData,
    awayTeamData,
    matchError,
    lineupsError,
    userTeamError,
  ]);

  // ============================================================================
  // REAL-TIME SUBSCRIPTION
  // ============================================================================

  /**
   * Unified real-time subscription to matches, match_lineups, and match_games
   * Listens for INSERT/UPDATE/DELETE events and refreshes data
   * Handles confirmation queue logic for opponent score updates
   */
  useMatchRealtime(matchId, {
    onMatchUpdate: refetchMatch,
    onLineupUpdate: refetchLineups,
    onGamesUpdate: refetchGames,
    gameUpdateOptions: {
      match,
      userTeamId,
      players,
      myVacateRequests,
      addToConfirmationQueue,
      autoConfirm,
      confirmOpponentScore,
    },
  });

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  return {
    // Data
    match,
    homeLineup,
    awayLineup,
    gameResults,
    players,
    homeTeamHandicap,
    homeThresholds,
    awayThresholds,

    // Full team rosters (for lineup changes - includes all players, not just lineup)
    homeTeamRoster: homeTeamData?.team_players || [],
    awayTeamRoster: awayTeamData?.team_players || [],

    // User context
    userTeamId,
    isHomeTeam,

    // League settings
    goldenBreakCountsAsWin,
    gameType,

    // Statistics (memoized)
    getPlayerDisplayName,
    getTeamStats: getTeamStatsCallback,
    getPlayerStats: getPlayerStatsCallback,
    getCompletedGamesCount: getCompletedGamesCountCallback,
    calculatePoints: calculatePointsCallback,

    // Confirmation queue
    confirmationQueue,
    addToConfirmationQueue,
    removeFromConfirmationQueue,
    myVacateRequests,

    // State
    loading,
    error,
  };
}
