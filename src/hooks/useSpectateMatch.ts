/**
 * @fileoverview Spectator data hook for a single match.
 *
 * Fetches match/lineup/game state and derives everything the scoreboard
 * components need to render in read-only mode. Shares the same underlying
 * query primitives as `useMatchScoring` (useMatchWithLeagueSettings,
 * useMatchLineups, useMatchGames, useTeamDetails) but deliberately omits
 * the `useUserTeamInMatch` call that would throw for a spectator who is
 * not on either team's roster.
 *
 * Subscribes to realtime changes so the scoreboard ticks live as the match
 * is scored on the players' side. No confirmation queue, no vacate detection,
 * no write mutations — this is read-only.
 *
 * Phase 5 Unit 5.5: this hook now reads the match row's
 * `home_points_earned` / `away_points_earned` columns directly rather
 * than recomputing points from match_games. The columns are maintained
 * per-game by the scoring mutations (`updateMatchRunningTotals`) so the
 * spectator view ticks live as the players score, with no duplicated
 * recompute logic.
 *
 * Intentional duplication that REMAINS: getPlayerPoints + getPlayerStats
 * still iterate match_games for per-player breakdowns (the match row
 * stores team-level totals only, not per-player). The team-level
 * `calculatePoints` / `calculateBCAPoints` / `calculateFargoMatchTotals`
 * recomputes are gone — the team totals come from the match row.
 */

import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getPlayerNicknameById } from '@/types/member';
import { getTeamStats } from '@/types';
import { queryKeys } from '@/api/queryKeys';
import { useMatchWithLeagueSettings, useMatchLineups, useMatchGames } from '@/api/hooks/useMatches';
import { useTeamDetails } from '@/api/hooks/useTeams';
import { useMembersByIds } from '@/api/hooks/useCurrentMember';
import { useResolvedLeaguePrefs } from '@/api/hooks/useResolvedLeaguePrefs';
import { useMatchRealtime } from '@/realtime/useMatchRealtime';
import type { Player, MatchGame, HandicapThresholds } from '@/types';

export function useSpectateMatch(matchId: string | null | undefined) {
  const queryClient = useQueryClient();
  const matchQuery = useMatchWithLeagueSettings(matchId);
  const match = matchQuery.data ?? null;

  const lineupsQuery = useMatchLineups(
    matchId,
    match?.home_team_id,
    match?.away_team_id,
  );
  const homeLineup = lineupsQuery.data?.homeLineup ?? null;
  const awayLineup = lineupsQuery.data?.awayLineup ?? null;

  const gamesQuery = useMatchGames(matchId);
  const games = gamesQuery.data ?? [];

  const homeTeamQuery = useTeamDetails(match?.home_team_id);
  const awayTeamQuery = useTeamDetails(match?.away_team_id);

  const { data: leaguePrefs } = useResolvedLeaguePrefs(match?.league?.id);

  // Live updates so the scoreboard reflects scoring as it happens.
  // Each handler invalidates the relevant cache entry rather than calling
  // refetch directly. See `useMatchScoring.ts` for the rationale — same
  // contract here.
  const handleMatchInvalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.matches.detail(matchId || '') });
  }, [queryClient, matchId]);
  const handleLineupInvalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.matches.lineup(matchId || '') });
  }, [queryClient, matchId]);
  const handleGamesInvalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.matches.games(matchId || '') });
  }, [queryClient, matchId]);

  useMatchRealtime(matchId, {
    onMatchUpdate: handleMatchInvalidate,
    onLineupUpdate: handleLineupInvalidate,
    onGamesUpdate: handleGamesInvalidate,
  });

  // Build a Map keyed by game_number for the same shape downstream helpers expect.
  const filteredGameResults = useMemo(() => {
    const map = new Map<number, MatchGame>();
    for (const g of games) map.set(g.game_number, g as MatchGame);
    return map;
  }, [games]);

  // Build the player Map from the UNION of every member ID that
  // appears in either lineup row or either team's roster, fetched
  // directly from `members`. The previous version relied on the
  // team_players(members(*)) nested join, which can return null for
  // a row even when the member exists (RLS quirks, post-merge
  // ghost FK references) and produces "Unknown" in the drawer.
  // See useMatchScoring.ts for the matching scoring-side fix.
  const memberIdsToFetch = useMemo(() => {
    const ids = new Set<string>();
    const collect = (lineup: any) => {
      if (!lineup) return;
      for (let n = 1; n <= 5; n++) {
        const id = lineup[`player${n}_id`];
        if (typeof id === 'string' && id.length > 0) ids.add(id);
      }
    };
    collect(homeLineup);
    collect(awayLineup);
    homeTeamQuery.data?.team_players?.forEach((tp: any) => {
      if (typeof tp.member_id === 'string' && tp.member_id) ids.add(tp.member_id);
    });
    awayTeamQuery.data?.team_players?.forEach((tp: any) => {
      if (typeof tp.member_id === 'string' && tp.member_id) ids.add(tp.member_id);
    });
    return Array.from(ids);
  }, [homeLineup, awayLineup, homeTeamQuery.data, awayTeamQuery.data]);

  const membersQuery = useMembersByIds(memberIdsToFetch);

  const players = useMemo(() => {
    const map = new Map<string, Player>();
    membersQuery.data?.forEach((m: any) => {
      map.set(m.id, {
        id: m.id,
        nickname: m.nickname,
        first_name: m.first_name,
        last_name: m.last_name,
        handicap: 0, // Handicap lives on the match_lineup row per-slot; not needed for display lookup.
      });
    });
    return map;
  }, [membersQuery.data]);

  const getPlayerDisplayName = (playerId: string): string =>
    getPlayerNicknameById(playerId, players) || 'Unknown';

  const getPlayerStats = (
    playerId: string,
    position: number,
    playerIsHomeTeam: boolean,
  ): { wins: number; losses: number } => {
    let wins = 0;
    let losses = 0;
    for (const g of filteredGameResults.values()) {
      if (!g.winner_team_id) continue;
      const positionField = playerIsHomeTeam ? g.home_position : g.away_position;
      const idField = playerIsHomeTeam ? g.home_player_id : g.away_player_id;
      if (idField !== playerId) continue;
      if (positionField !== position) continue;
      const teamId = playerIsHomeTeam ? match?.home_team_id : match?.away_team_id;
      if (g.winner_team_id === teamId) wins++;
      else losses++;
    }
    return { wins, losses };
  };

  // Thresholds from match row (populated by match preparation). The
  // match-prepared signal is `started_at !== null`, mirroring useMatchScoring.
  // Fargo points-mode legitimately stores `home_to_win = null` so the old
  // home_to_win-based gate would hide the spectator scoreboard for the entire
  // match life of every points-mode game.
  const homeThresholds: HandicapThresholds | null = useMemo(() => {
    if (!match) return null;
    if (!match.started_at) return null;
    return {
      games_to_win: match.home_to_win ?? null,
      games_to_tie: match.home_to_tie ?? null,
      games_to_lose: match.home_to_lose ?? null,
    };
  }, [match]);

  const awayThresholds: HandicapThresholds | null = useMemo(() => {
    if (!match) return null;
    if (!match.started_at) return null;
    return {
      games_to_win: match.away_to_win ?? null,
      games_to_tie: match.away_to_tie ?? null,
      games_to_lose: match.away_to_lose ?? null,
    };
  }, [match]);

  // Team stats from the live match_games map. The per-player drawer reads
  // losses from this; team-level wins/points come from the match row.
  const homeStats = match
    ? getTeamStats(match.home_team_id, filteredGameResults)
    : { wins: 0, losses: 0, ties: 0 };
  const awayStats = match
    ? getTeamStats(match.away_team_id, filteredGameResults)
    : { wins: 0, losses: 0, ties: 0 };

  // Resolved system configuration. Reads prefer the per-match
  // `system_snapshot` so spectator displays match what was live during
  // scoring, even if the LO edited preferences mid-match. Live prefs
  // are the fallback for matches not yet scored (no snapshot) or
  // legacy snapshots from before Phase 2 Unit 2.2's writer expansion.
  const snapshot = match?.system_snapshot;
  // Lineup geometry + win condition feed UnifiedScoreboard's auto-flex
  // rendering. Pre-Unit-7-of-unified-scoreboard-plan we exposed `is5v5` for
  // 3v3-vs-5v5 component selection; that boolean is gone now since the
  // unified scoreboard renders any lineup_size + win_condition combination.
  const lineupSize = snapshot?.lineup_size ?? leaguePrefs?.lineup_size ?? 3;
  const winCondition: 'games' | 'points' =
    snapshot?.win_condition ?? leaguePrefs?.win_condition ?? 'games';
  const gameType = (match?.league?.game_type as string) || 'eight_ball';

  const fargoOverrides = snapshot?.overrides ?? leaguePrefs?.system_overrides ?? {};

  // Per-player points helper for per-game calculators (e.g.
  // accumulated_per_game / Fargo 10-7). Reads its winner-points config from
  // the snapshot dial. The caller (SpectateMatchCard) already gates this
  // function on `isPerGameCalculator` — no need for an internal handicap-
  // type guard, which would silently return 0 for any future non-Fargo
  // per-game calculator.
  const fargoWinnerPoints =
    typeof (fargoOverrides as any).winner_points === 'number'
      ? (fargoOverrides as any).winner_points
      : 10;
  const getPlayerPoints = (
    playerId: string,
    position: number,
    playerIsHomeTeam: boolean,
  ): number => {
    if (!match) return 0;
    let total = 0;
    for (const g of filteredGameResults.values()) {
      if (!g.winner_team_id) continue;
      const positionField = playerIsHomeTeam ? g.home_position : g.away_position;
      const idField = playerIsHomeTeam ? g.home_player_id : g.away_player_id;
      if (idField !== playerId) continue;
      if (positionField !== position) continue;
      const teamId = playerIsHomeTeam ? match.home_team_id : match.away_team_id;
      if (g.winner_team_id === teamId) {
        total += fargoWinnerPoints;
      } else if (g.loser_value !== null && g.loser_value !== undefined) {
        total += g.loser_value;
      }
    }
    return total;
  };

  const totalGames = filteredGameResults.size;
  const completedGames = Array.from(filteredGameResults.values()).filter(
    (g) => g.winner_team_id && g.confirmed_by_home && g.confirmed_by_away,
  ).length;
  const allGamesComplete = totalGames > 0 && completedGames === totalGames;

  const isLoading =
    matchQuery.isLoading ||
    lineupsQuery.isLoading ||
    gamesQuery.isLoading ||
    homeTeamQuery.isLoading ||
    awayTeamQuery.isLoading;

  return {
    match,
    homeLineup,
    awayLineup,
    gameResults: filteredGameResults,
    homeThresholds,
    awayThresholds,
    homeLosses: homeStats.losses,
    awayLosses: awayStats.losses,
    lineupSize,
    winCondition,
    gameType,
    allGamesComplete,
    getPlayerDisplayName,
    getPlayerStats,
    getPlayerPoints,
    isLoading,
  };
}

// Re-export for convenience.
export type { Player, MatchGame, HandicapThresholds };
