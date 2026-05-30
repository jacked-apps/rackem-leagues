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
import { getTeamStats, getPlayerStats, getCompletedGamesCount, TIEBREAKER_THRESHOLDS } from '@/types';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import { useMatchWithLeagueSettings, useMatchLineups, useMatchGames } from '@/api/hooks/useMatches';
import { useGameConfirmations } from '@/api/hooks/useGameConfirmations';
import { useUserTeamInMatch, useTeamDetails } from '@/api/hooks/useTeams';
import { useMembersByIds } from '@/api/hooks/useCurrentMember';
import { useMatchRealtime } from '@/realtime/useMatchRealtime';
import {
  useConnectionHealth,
  computeDegradedPollInterval,
} from '@/realtime/useConnectionHealth';
import { logger } from '@/utils/logger';
import type {
  Player,
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
  /**
   * "I'm not scoring" mode. When on, the realtime fast-path suppresses all
   * confirm/vacate prompts (mirrors the state-derived scan's guard) so an
   * opted-out viewer never sees a modal. ScoreMatch owns this; forwarded here.
   */
  notScoring?: boolean;
  /**
   * Game number the user currently has the initiator (scoring) modal open
   * for — passed through to the realtime handler so it can suppress the
   * confirm-opponent prompt for that game (Amendment H). ScoreMatch owns
   * this state; this hook just forwards it.
   */
  scoringGame?: { gameNumber: number } | null;
}

// ============================================================================
// HOOK
// ============================================================================

export function useMatchScoring({
  matchId,
  memberId,
  matchType,
  autoConfirm = false,
  notScoring = false,
  scoringGame = null,
}: UseMatchScoringOptions) {
  const queryClient = useQueryClient();

  // ============================================================================
  // TANSTACK QUERY HOOKS
  // ============================================================================

  // Fetch match with league settings
  const {
    data: matchData,
    isLoading: matchLoading,
    error: matchError,
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
  } = useMatchGames(matchId);

  // Fetch many-eyes confirmations (Layer-2 witness records). useGameConfirmations
  // OWNS the fetch; the realtime handler below invalidates it on a
  // game_confirmations event. Phase 2/3 (per-person prompt, dissent flag,
  // tap-to-peek) consume these rows; Phase 1 just keeps them live.
  const {
    data: gameConfirmations = [],
  } = useGameConfirmations(matchId);

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

  // Build players Map from the UNION of (a) every member ID that appears
  // in either team's roster (team_players) and (b) every member ID that
  // appears in either lineup row.
  //
  // Why we don't just rely on the team_players(members(*)) nested join
  // anymore: that join can return a null `members` field for a roster
  // row even when the member exists — RLS quirks, FK pointing at a
  // post-merge ghost ID, or transient cache shapes have all been
  // observed in production. When that happens, the lookup returns
  // "Unknown" in the drawer for a player whose full name resolves
  // perfectly via the direct getMemberById query elsewhere in the app.
  // Building the Map from `members WHERE id IN (...)` against the
  // raw IDs we actually need to render is bulletproof against those
  // edge cases.
  //
  // Includes lineup IDs explicitly so any player who appears in a
  // lineup (regular roster, sub, double-duty assignment, post-merge
  // ghost reference) is always resolvable by the drawer / scoring UI.
  // Includes roster IDs so swap candidates (who are on the team but
  // not in the current lineup) still resolve.
  const memberIdsToFetch = useMemo(() => {
    const ids = new Set<string>();
    const collectFromLineup = (lineup: any) => {
      if (!lineup) return;
      for (let n = 1; n <= 5; n++) {
        const id = lineup[`player${n}_id`];
        if (typeof id === 'string' && id.length > 0) ids.add(id);
      }
    };
    collectFromLineup(lineupsData?.homeLineup);
    collectFromLineup(lineupsData?.awayLineup);
    homeTeamData?.team_players?.forEach((tp: any) => {
      if (typeof tp.member_id === 'string' && tp.member_id) ids.add(tp.member_id);
    });
    awayTeamData?.team_players?.forEach((tp: any) => {
      if (typeof tp.member_id === 'string' && tp.member_id) ids.add(tp.member_id);
    });
    return Array.from(ids);
  }, [lineupsData, homeTeamData, awayTeamData]);

  const membersQuery = useMembersByIds(memberIdsToFetch);

  const players = useMemo(() => {
    const playerMap = new Map<string, Player>();
    membersQuery.data?.forEach((m: any) => {
      playerMap.set(m.id, {
        id: m.id,
        first_name: m.first_name,
        last_name: m.last_name,
        nickname: m.nickname,
      });
    });
    return playerMap;
  }, [membersQuery.data]);

  // Transform games array to Map for O(1) lookups (needs useMemo - expensive transformation)
  const gameResults = useMemo(() => {
    const gamesMap = new Map<number, MatchGame>();
    gamesData.forEach(game => gamesMap.set(game.game_number, game as MatchGame));
    return gamesMap;
  }, [gamesData]);

  // Get handicap thresholds from match data (saved during lineup).
  //
  // Detection signal: `started_at !== null` means prep_match has run for
  // this match (it sets `started_at = COALESCE(started_at, NOW())`).
  // Pre-2026-05-04 this used `home_to_win !== null` as the signal, but
  // that broke for Fargo points-mode where `home_to_win` is legitimately
  // null (no match-level point threshold — match plays all games to
  // totals). `started_at` is mode-independent.
  //
  // - games_to_win: null in points-mode (legitimate); non-null in games-mode.
  // - games_to_tie: null when a tie is impossible OR when no start-credit
  //   applies (BCA matches with odd total games / no handicap).
  // - games_to_lose: null for Fargo matches (no decisive-loss threshold).
  const homeThresholds = useMemo(() => {
    if (matchType === 'tiebreaker') return TIEBREAKER_THRESHOLDS;

    if (matchData && matchData.started_at !== null) {
      return {
        games_to_win: matchData.home_to_win,
        games_to_tie: matchData.home_to_tie ?? null,
        games_to_lose: matchData.home_to_lose ?? null,
      };
    }

    return null;
  }, [matchType, matchData]);

  const awayThresholds = useMemo(() => {
    if (matchType === 'tiebreaker') return TIEBREAKER_THRESHOLDS;

    if (matchData && matchData.started_at !== null) {
      return {
        games_to_win: matchData.away_to_win,
        games_to_tie: matchData.away_to_tie ?? null,
        games_to_lose: matchData.away_to_lose ?? null,
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

  // Note: the legacy `calculatePointsCallback` re-export was dropped in
  // Unit 7 of the unified-scoreboard plan. Verified zero non-test consumers
  // before removal. The legacy `calculatePoints` helper itself survives
  // (src/types/match.ts) for the characterization tests + divergence audit
  // — see `feedback_two_paths_audit_pattern.md` in the user-memory.

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
   * Unified real-time subscription to matches, match_lineups, and match_games.
   *
   * Each handler invalidates the relevant cache entry rather than calling
   * `query.refetch()` directly. Refetch respects `staleTime` and silently
   * no-ops when the cache is still considered fresh; invalidate forces the
   * cache to refetch regardless. After the staleTime fix in
   * `useMatchWithLeagueSettings` (set to MATCH_LIVE = 0), the two are
   * functionally equivalent for this query — but invalidate is the
   * correct verb and matches the cascade behavior we want for sibling
   * queries (lineup, games, useMatchPhase) keyed under
   * `matches.detail(matchId)`.
   *
   * The handlers are wrapped in `useCallback` so their identities stay
   * stable across renders. `useMatchRealtime` stores them in refs so
   * identity churn wouldn't tear down the subscription anyway, but
   * stability is the right idiom and keeps the ref-update effect from
   * firing on every parent render.
   */
  // Partial-key invalidation on matches.detail(matchId) cascades to all
  // children: useMatchById (bare key), useMatchWithLeagueSettings
  // ('leagueSettings' suffix), useMatchPhase ('phase' suffix), AND
  // useMatchLineups, useMatchGames. The latter two have dedicated
  // handlers (handleLineupInvalidate / handleGamesInvalidate) below —
  // the cascade hits them too on every matches event, which is wasteful
  // but not incorrect. The cost is acceptable: matches-row updates are
  // rare events (lock, prep_match, completion), not per-game scoring
  // events. Narrowing the key to exclude lineup/games is tempting but
  // would also exclude phase, which is wrong.
  const handleMatchInvalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.matches.detail(matchId || '') });
  }, [queryClient, matchId]);
  const handleLineupInvalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.matches.lineup(matchId || '') });
  }, [queryClient, matchId]);
  const handleGamesInvalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.matches.games(matchId || '') });
  }, [queryClient, matchId]);
  const handleConfirmationsInvalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.matches.confirmations(matchId || '') });
  }, [queryClient, matchId]);

  // `connectionStatus` is the coarse realtime status (live | reconnecting |
  // error). Surfaced through this hook so the scoring screen can render a calm
  // connection indicator and drive the polling fallback while degraded.
  const { connectionStatus } = useMatchRealtime(matchId, {
    onMatchUpdate: handleMatchInvalidate,
    onLineupUpdate: handleLineupInvalidate,
    onGamesUpdate: handleGamesInvalidate,
    onConfirmationsUpdate: handleConfirmationsInvalidate,
    gameUpdateOptions: {
      match,
      userTeamId,
      players,
      myVacateRequests,
      addToConfirmationQueue,
      autoConfirm,
      notScoring,
      scoringGame,
    },
  });

  // Classify realtime trouble into actionable health (realtime-down vs
  // offline) via a single cheap reachability probe — see useConnectionHealth.
  const { health: connectionHealth } = useConnectionHealth(connectionStatus);

  // Degraded polling fallback: while realtime is down but the server is
  // reachable AND the match is in progress, poll match + games on a modest
  // cadence so scoring stays in sync without realtime. Stops the instant
  // realtime returns (health → live) or the match leaves in_progress. This is
  // the in-progress analog of useMatchPhase's "Defense 7" scheduled-phase poll.
  useEffect(() => {
    const interval = computeDegradedPollInterval(
      connectionHealth,
      matchData?.status
    );
    if (interval === false) return;

    const id = setInterval(() => {
      handleMatchInvalidate();
      handleGamesInvalidate();
      handleConfirmationsInvalidate();
    }, interval);
    return () => clearInterval(id);
  }, [
    connectionHealth,
    matchData?.status,
    handleMatchInvalidate,
    handleGamesInvalidate,
    handleConfirmationsInvalidate,
  ]);

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  return {
    // Data
    match,
    homeLineup,
    awayLineup,
    gameResults,
    gameConfirmations,
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

    // Confirmation queue
    confirmationQueue,
    addToConfirmationQueue,
    removeFromConfirmationQueue,
    myVacateRequests,

    // Connection resilience
    connectionStatus,
    connectionHealth,

    // State
    loading,
    error,
  };
}
