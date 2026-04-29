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
 * Intentional duplication: several derivations (fargoTotals, getPlayerPoints,
 * getPlayerStats) mirror what useMatchScoring/ScoreMatch compute. We duplicate
 * rather than thread operator/spectator flags through the player scoring stack
 * because the reviewers on the LO feature specifically warned against that
 * coupling. Pure utilities (calculateFargoMatchTotals, calculatePoints,
 * calculateBCAPoints, getTeamStats) are reused as shared primitives.
 */

import { useMemo } from 'react';
import { getPlayerNicknameById } from '@/types/member';
import {
  getTeamStats,
  calculatePoints,
  calculateBCAPoints,
  TIEBREAKER_THRESHOLDS,
} from '@/types';
import { useMatchWithLeagueSettings, useMatchLineups, useMatchGames } from '@/api/hooks/useMatches';
import { useTeamDetails } from '@/api/hooks/useTeams';
import { useResolvedLeaguePrefs } from '@/api/hooks/useResolvedLeaguePrefs';
import { useMatchRealtime } from '@/realtime/useMatchRealtime';
import { calculateFargoMatchTotals } from '@/utils/fargoMatchTotals';
import type { Player, MatchGame, HandicapThresholds } from '@/types';

export function useSpectateMatch(matchId: string | null | undefined) {
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
  useMatchRealtime(matchId, {
    onMatchUpdate: matchQuery.refetch,
    onLineupUpdate: lineupsQuery.refetch,
    onGamesUpdate: gamesQuery.refetch,
  });

  // Build a Map keyed by game_number for the same shape downstream helpers expect.
  const filteredGameResults = useMemo(() => {
    const map = new Map<number, MatchGame>();
    for (const g of games) map.set(g.game_number, g as MatchGame);
    return map;
  }, [games]);

  // Team rosters — used to resolve player display names and per-slot stats
  // for the expandable drawer inside each scoreboard.
  const players = useMemo(() => {
    const map = new Map<string, Player>();
    const home = homeTeamQuery.data?.team_players ?? [];
    const away = awayTeamQuery.data?.team_players ?? [];
    for (const tp of [...home, ...away] as any[]) {
      const m = tp.members;
      if (!m) continue;
      map.set(m.id, {
        id: m.id,
        nickname: m.nickname,
        first_name: m.first_name,
        last_name: m.last_name,
        handicap: 0, // Handicap lives on the match_lineup row per-slot; not needed for display lookup.
      });
    }
    return map;
  }, [homeTeamQuery.data, awayTeamQuery.data]);

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

  // Thresholds from match row (populated by match preparation). Matches the
  // rule used in useMatchScoring: games_to_win must be non-null; games_to_lose
  // is null for Fargo matches by design.
  const homeThresholds: HandicapThresholds | null = useMemo(() => {
    if (!match) return null;
    if (match.home_games_to_win === null || match.home_games_to_win === undefined) return null;
    return {
      games_to_win: match.home_games_to_win,
      games_to_tie: match.home_games_to_tie ?? null,
      games_to_lose: match.home_games_to_lose ?? null,
    };
  }, [match]);

  const awayThresholds: HandicapThresholds | null = useMemo(() => {
    if (!match) return null;
    if (match.away_games_to_win === null || match.away_games_to_win === undefined) return null;
    return {
      games_to_win: match.away_games_to_win,
      games_to_tie: match.away_games_to_tie ?? null,
      games_to_lose: match.away_games_to_lose ?? null,
    };
  }, [match]);

  // Team stats and BCA points for non-Fargo display.
  const homeStats = match
    ? getTeamStats(match.home_team_id, filteredGameResults)
    : { wins: 0, losses: 0, ties: 0 };
  const awayStats = match
    ? getTeamStats(match.away_team_id, filteredGameResults)
    : { wins: 0, losses: 0, ties: 0 };

  const homeBCAPoints = match && homeThresholds
    ? calculateBCAPoints(match.home_team_id, homeThresholds, filteredGameResults)
    : 0;
  const awayBCAPoints = match && awayThresholds
    ? calculateBCAPoints(match.away_team_id, awayThresholds, filteredGameResults)
    : 0;
  const home3v3Points = match && homeThresholds
    ? calculatePoints(match.home_team_id, homeThresholds, filteredGameResults)
    : 0;
  const away3v3Points = match && awayThresholds
    ? calculatePoints(match.away_team_id, awayThresholds, filteredGameResults)
    : 0;

  // Resolved system configuration. Reads prefer the per-match
  // `system_snapshot` so spectator displays match what was live during
  // scoring, even if the LO edited preferences mid-match. Live prefs
  // are the fallback for matches not yet scored (no snapshot) or
  // legacy snapshots from before Phase 2 Unit 2.2's writer expansion.
  const snapshot = match?.system_snapshot;
  const handicapType = snapshot?.handicap_type ?? leaguePrefs?.handicap_type ?? 'points';
  // Lineup-size routing decision: previously `team_format === '8_man'`.
  // Drives 3v3-vs-5v5 scoreboard component selection in SpectateMatchCard.
  const is5v5 = (snapshot?.lineup_size ?? leaguePrefs?.lineup_size ?? 3) === 5;
  const gameType = (match?.league?.game_type as string) || 'eight_ball';

  const fargoOverrides = snapshot?.overrides ?? leaguePrefs?.system_overrides ?? {};
  const fargoTotals = match && handicapType === 'fargo'
    ? calculateFargoMatchTotals({
        homeTeamId: match.home_team_id,
        awayTeamId: match.away_team_id,
        homeGamesToWin: match.home_games_to_win ?? 0,
        awayGamesToWin: match.away_games_to_win ?? 0,
        gameResults: filteredGameResults,
        overrides: fargoOverrides,
      })
    : null;

  // Fargo-only per-player points helper for the TenSeven drawer.
  const fargoWinnerPoints =
    typeof (fargoOverrides as any).winner_points === 'number'
      ? (fargoOverrides as any).winner_points
      : 10;
  const getPlayerPoints = (
    playerId: string,
    position: number,
    playerIsHomeTeam: boolean,
  ): number => {
    if (handicapType !== 'fargo' || !match) return 0;
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
      } else if (g.loser_balls_pocketed !== null && g.loser_balls_pocketed !== undefined) {
        total += g.loser_balls_pocketed;
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
    homeWins: homeStats.wins,
    awayWins: awayStats.wins,
    homeLosses: homeStats.losses,
    awayLosses: awayStats.losses,
    homeBCAPoints,
    awayBCAPoints,
    home3v3Points,
    away3v3Points,
    fargoTotals,
    handicapType,
    is5v5,
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

// Silence unused-import warning; keep for future use when adding tiebreaker support.
export const _SPECTATE_TIEBREAKER_THRESHOLDS = TIEBREAKER_THRESHOLDS;
