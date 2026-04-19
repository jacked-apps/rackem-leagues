/**
 * @fileoverview Match and Scoring-related type definitions
 * Types for match scoring, lineups, games, and handicaps
 */

import type { HandicapVariant } from '@/utils/handicapCalculations';
import type { SystemOverrides } from './systemOverrides';

/**
 * Per-match frozen snapshot of tier 2 dials + threshold chart selection.
 * Populated at scheduled → in_progress transition and never mutated after.
 * Stored as `matches.system_snapshot JSONB`. See migration
 * 20260418000003_add_matches_system_snapshot.sql.
 */
export interface MatchSystemSnapshot {
  overrides: SystemOverrides;
  threshold_chart_id: string | null;
  snapshot_at: string; // ISO 8601 timestamp
}

/**
 * Match type - determines format and scoring rules
 */
export type MatchType = '3v3' | 'tiebreaker' | '5v5';

/**
 * Basic match information with team details (scoring context)
 * Simplified version of full Match record from schedule.ts
 * Contains only fields needed for scoring pages
 */
export interface MatchBasic {
  id: string;
  season_id: string;
  home_team_id: string;
  away_team_id: string;
  home_team: {
    id: string;
    team_name: string;
  } | null;
  away_team: {
    id: string;
    team_name: string;
  } | null;
}

/**
 * Match with league settings for scoring
 * Includes handicap variants, game rules, venue, and schedule info
 */
export interface MatchWithLeagueSettings {
  id: string;
  season_id: string;
  home_team_id: string;
  away_team_id: string;
  home_lineup_id: string | null;
  away_lineup_id: string | null;
  started_at: string | null;
  match_result: 'home_win' | 'away_win' | 'tie' | null;
  scheduled_date: string;
  home_team_verified_by?: string | null;
  away_team_verified_by?: string | null;
  home_tiebreaker_verified_by?: string | null;
  away_tiebreaker_verified_by?: string | null;
  home_games_to_win: number | null;
  home_games_to_tie: number | null;
  home_games_to_lose: number | null;
  away_games_to_win: number | null;
  away_games_to_tie: number | null;
  away_games_to_lose: number | null;
  /**
   * Fargo start-points negotiation (Unit 11c). Captains must agree on the
   * start-points value before the scoring page opens. `fargo_start_points`
   * holds the current proposed or agreed value; the two confirm columns
   * track which captain(s) have accepted it. Editing the value clears both
   * confirms. Once both are non-null, the value is copied to the weaker
   * team's home_games_to_win / away_games_to_win and match preparation
   * runs. NULL on non-Fargo matches (and on Fargo matches before the first
   * proposal is written).
   */
  fargo_start_points: number | null;
  fargo_start_points_confirmed_by_home: string | null;
  fargo_start_points_confirmed_by_away: string | null;
  /**
   * Tier 3 snapshot (added by migration 20260418000003). NULL for unstarted or legacy matches.
   * Populated at scheduled → in_progress transition; scoring reads from this, not live league data.
   *
   * Note: Fargo start-points for the weaker team are stored directly in
   * home_games_to_win / away_games_to_win (per-system semantic — BCA's "games needed to win"
   * and Fargo's "start points awarded" share the shape and column family; handicap_type
   * tells code how to interpret them).
   */
  system_snapshot: MatchSystemSnapshot | null;
  assigned_table_number: number | null;
  home_team: {
    id: string;
    team_name: string;
  };
  away_team: {
    id: string;
    team_name: string;
  };
  scheduled_venue: {
    id: string;
    name: string;
    city: string;
    state: string;
  } | null;
  actual_venue: {
    id: string;
    name: string;
    city: string;
    state: string;
  } | null;
  season_week: {
    scheduled_date: string;
  } | null;
  league: {
    id: string;
    handicap_variant: HandicapVariant;
    team_handicap_variant: HandicapVariant;
    golden_break_counts_as_win: boolean;
    game_type: string;
    team_format: '5_man' | '8_man';
  };
}

/**
 * Match for lineup page
 * Includes team details, venue, league settings, and lineup IDs
 */
export interface MatchForLineup {
  id: string;
  scheduled_date: string;
  season_id: string;
  home_team_id: string;
  away_team_id: string;
  home_lineup_id: string | null;
  away_lineup_id: string | null;
  started_at: string | null;
  match_result: 'home_win' | 'away_win' | 'tie' | null;
  home_team: {
    id: string;
    team_name: string;
  } | null;
  away_team: {
    id: string;
    team_name: string;
  } | null;
  scheduled_venue: {
    id: string;
    name: string;
    city: string;
    state: string;
  } | null;
  season_week: {
    scheduled_date: string;
  } | null;
  league: {
    id: string;
    handicap_variant: HandicapVariant;
    team_handicap_variant: HandicapVariant;
    game_type: 'eight_ball' | 'nine_ball' | 'ten_ball';
    team_format: '5_man' | '8_man';
  };
}

/**
 * Match lineup for a team
 * Supports 3v3 format with player positions and handicaps
 */
export interface Lineup {
  id: string;
  team_id: string;
  player1_id: string | null;
  player1_handicap: number;
  player2_id: string | null;
  player2_handicap: number;
  player3_id: string | null;
  player3_handicap: number;
  player4_id?: string | null; // 5v5 only
  player4_handicap?: number | null; // 5v5 only
  player5_id?: string | null; // 5v5 only
  player5_handicap?: number | null; // 5v5 only
  home_team_modifier: number; // Team standings modifier (bonus/penalty)
  locked: boolean;
  locked_at: string | null; // ISO timestamp when lineup was locked
  // Lineup change request fields (pending swap awaiting opponent approval)
  // swap_position being non-null indicates a pending request
  // Old player is derived from player{swap_position}_id
  // New player name is looked up from team roster at display time
  swap_position?: number | null;
  swap_new_player_id?: string | null;
  swap_new_player_handicap?: number | null;
  swap_requested_at?: string | null;
}

/**
 * Player information for match scoring
 */
export interface Player {
  id: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  handicap?: number; // Optional - calculated from game history
}

/**
 * Handicap thresholds for determining match outcome
 * Based on handicap difference between teams
 */
export interface HandicapThresholds {
  games_to_win: number;
  games_to_tie: number | null;
  games_to_lose: number;
}

/**
 * Static thresholds for tiebreaker matches
 * Tiebreaker is always best of 3 (first to 2 games wins)
 */
export const TIEBREAKER_THRESHOLDS: HandicapThresholds = {
  games_to_win: 2,
  games_to_tie: null,
  games_to_lose: 1,
};

/**
 * Individual game result within a match
 */
export interface MatchGame {
  id: string;
  game_number: number;
  home_position: number; // Which position (1-5) from home lineup plays
  away_position: number; // Which position (1-5) from away lineup plays
  home_player_id: string | null;
  away_player_id: string | null;
  winner_team_id: string | null;
  winner_player_id: string | null;
  home_action: 'breaks' | 'racks';
  away_action: 'breaks' | 'racks';
  break_and_run: boolean;
  golden_break: boolean;
  confirmed_by_home: boolean;
  confirmed_by_away: boolean;
  is_tiebreaker: boolean;
  // Per-game achievement / break-state flags (added by migration 20260418000004).
  // Always tracked across all scoring systems. Default false.
  break_fouled: boolean;
  runout: boolean;
  win_by_forfeit: boolean;
  // Fargo-specific per-game input (added by 20260418000001). NULL for BCA matches.
  // Winner points and loser points are NOT stored — they are derived at read time
  // from this value plus the league's winner_points / loser_points_method dials.
  loser_balls_pocketed: number | null;
}

/**
 * Scoring options for a game
 */
export interface ScoringOptions {
  breakAndRun?: boolean;
  goldenBreak?: boolean;
}

/**
 * Confirmation queue item for opponent score verification
 */
export interface ConfirmationQueueItem {
  gameNumber: number;
  winnerPlayerName: string;
  breakAndRun: boolean;
  goldenBreak: boolean;
  isVacateRequest?: boolean;
}

/**
 * Team statistics result
 */
export interface TeamStats {
  wins: number;
  losses: number;
}

/**
 * Get team statistics (wins/losses) from confirmed games
 *
 * Counts only fully confirmed games (confirmed by both home and away teams).
 *
 * @param teamId - Team's ID to get stats for
 * @param gameResults - Map of game numbers to game results
 * @returns Object with wins and losses count
 *
 * @example
 * const stats = getTeamStats('team-123', gamesMap);
 * console.log(`Team has ${stats.wins} wins and ${stats.losses} losses`);
 */
export function getTeamStats(
  teamId: string,
  gameResults: Map<number, MatchGame>
): TeamStats {
  let wins = 0;
  let losses = 0;

  gameResults.forEach(game => {
    // Only count confirmed games
    if (!game.confirmed_by_home || !game.confirmed_by_away) return;

    if (game.winner_team_id === teamId) {
      wins++;
    } else if (game.winner_team_id) {
      // Game has a winner and it's not this team
      losses++;
    }
  });

  return { wins, losses };
}

/**
 * Player statistics result
 */
export interface PlayerStats {
  wins: number;
  losses: number;
}

/**
 * Get player statistics (wins/losses) from confirmed games
 *
 * Counts only fully confirmed games. Player gets a loss if they were in the game but didn't win.
 *
 * @param playerId - Player's ID to get stats for
 * @param gameResults - Map of game numbers to game results
 * @returns Object with wins and losses count
 *
 * @example
 * const stats = getPlayerStats('player-123', gamesMap);
 * console.log(`Player has ${stats.wins} wins and ${stats.losses} losses`);
 */
export function getPlayerStats(
  playerId: string,
  gameResults: Map<number, MatchGame>
): PlayerStats {
  let wins = 0;
  let losses = 0;

  gameResults.forEach(game => {
    // Only count confirmed games
    if (!game.confirmed_by_home || !game.confirmed_by_away) return;

    if (game.winner_player_id === playerId) {
      wins++;
    } else if (game.home_player_id === playerId || game.away_player_id === playerId) {
      // Player was in this game but didn't win
      losses++;
    }
  });

  return { wins, losses };
}

/**
 * Count completed games (confirmed by both teams)
 *
 * Only counts games that are fully confirmed (both home and away have confirmed).
 *
 * @param gameResults - Map of game numbers to game results
 * @returns Number of completed games
 *
 * @example
 * const completedCount = getCompletedGamesCount(gamesMap);
 * console.log(`${completedCount} games completed`);
 */
export function getCompletedGamesCount(gameResults: Map<number, MatchGame>): number {
  let count = 0;
  gameResults.forEach(game => {
    if (game.confirmed_by_home && game.confirmed_by_away) {
      count++;
    }
  });
  return count;
}

/**
 * Calculate current points for a team (3v3 system)
 *
 * Points calculation logic:
 * - Positive points: wins above games_to_win (e.g., 11 wins when you need 10 = +1 point)
 * - Zero points: wins between games_to_tie and games_to_win (inclusive)
 * - Negative points: wins below games_to_tie
 *
 * When ties are possible:
 * - Win exactly what you need (games_to_win) = 0 points
 * - Tie (games_to_tie) = 0 points for both teams
 * - Win more than needed = positive points
 * - Below tie threshold = negative points
 *
 * When no tie possible (games_to_tie = null):
 * - Uses games_to_win as the baseline for all calculations
 *
 * @param teamId - Team's ID to calculate points for
 * @param thresholds - Handicap thresholds (win/tie/lose game counts)
 * @param gameResults - Map of game numbers to game results
 * @returns Point differential (positive = above win threshold, 0 = tie range, negative = below tie threshold)
 *
 * @example
 * // With tie possible: games_to_win=10, games_to_tie=9
 * const points1 = calculatePoints('team-123', { games_to_win: 10, games_to_tie: 9, games_to_lose: 8 }, gamesMap);
 * // 11 wins = +1, 10 wins = 0, 9 wins = 0, 8 wins = -1
 *
 * @example
 * // No tie: games_to_win=10, games_to_tie=null
 * const points2 = calculatePoints('team-123', { games_to_win: 10, games_to_tie: null, games_to_lose: 9 }, gamesMap);
 * // 11 wins = +1, 10 wins = 0, 9 wins = -1
 */
export function calculatePoints(
  teamId: string,
  thresholds: HandicapThresholds | null,
  gameResults: Map<number, MatchGame>
): number {
  if (!thresholds) return 0;
  const { wins } = getTeamStats(teamId, gameResults);

  // If ties are possible
  if (thresholds.games_to_tie !== null) {
    // Positive points: wins above games_to_win
    if (wins > thresholds.games_to_win) {
      return wins - thresholds.games_to_win;
    }
    // Zero points: in the tie range (games_to_tie to games_to_win, inclusive)
    if (wins >= thresholds.games_to_tie && wins <= thresholds.games_to_win) {
      return 0;
    }
    // Negative points: below tie threshold
    return wins - thresholds.games_to_tie;
  }

  // No tie possible: use games_to_win as baseline
  return wins - thresholds.games_to_win;
}

/**
 * Calculate BCA points for a team (5v5 system)
 *
 * BCA point system with bonus jumps:
 * - 0.1 points per game won
 * - At 70% threshold: Jump to 1.5 points, then continue adding 0.1 per game
 * - At win threshold: Jump to 3 points, then continue adding 0.1 per game
 *
 * @param teamId - Team's ID to calculate points for
 * @param thresholds - Handicap thresholds (games needed to win)
 * @param gameResults - Map of game numbers to game results
 * @returns Total BCA points earned
 *
 * @example
 * // Team needs 13 wins (70% = 9 games)
 * // 8 wins: 0.8 points
 * // 9 wins: 1.5 points (bonus jump!)
 * // 10 wins: 1.6 points
 * // 13 wins: 3.0 points (bonus jump!)
 * // 14 wins: 3.1 points
 */
export function calculateBCAPoints(
  teamId: string,
  thresholds: HandicapThresholds | null,
  gameResults: Map<number, MatchGame>
): number {
  if (!thresholds) return 0;
  const { wins } = getTeamStats(teamId, gameResults);

  // Calculate 70% threshold for 1.5 bonus jump (straight round, not round up)
  const bonus70Threshold = Math.round(thresholds.games_to_win * 0.7);

  // Reached win threshold: 3 points + 0.1 for each game beyond
  if (wins >= thresholds.games_to_win) {
    const gamesOverThreshold = wins - thresholds.games_to_win;
    return 3.0 + (gamesOverThreshold * 0.1);
  }

  // Reached 70% threshold: 1.5 points + 0.1 for each game beyond
  if (wins >= bonus70Threshold) {
    const gamesBeyond70 = wins - bonus70Threshold;
    return 1.5 + (gamesBeyond70 * 0.1);
  }

  // Below 70%: 0.1 points per game
  return wins * 0.1;
}
