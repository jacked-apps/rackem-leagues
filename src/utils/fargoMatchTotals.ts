/**
 * @fileoverview Fargo match-total helpers (Unit 12)
 *
 * Bridges the stored match_games rows to `fargo5v5.scoring.computeMatchResult`.
 * Used by the 5v5 scoreboard during play (running totals) and by the
 * match-end verification flow at completion time (final totals written to
 * `matches.home_team_score` / `away_team_score` / `home_points_earned` /
 * `away_points_earned`).
 *
 * The start-points credit for the weaker team is read directly off the
 * match row's `home_to_win` / `away_to_win` column — whichever
 * is positive identifies the weaker team, the other is 0. Captains already
 * agreed on this value via the negotiation flow (Unit 11c); we just apply
 * it here without recomputing from ratings.
 */

import { fargo5v5 } from '@/systems/fargo5v5';
import type { MatchGame } from '@/types/match';
import type { StoredGameRecord } from '@/systems/types';
import type { SystemOverrides } from '@/types/systemOverrides';

export interface FargoMatchTotals {
  homePoints: number;
  awayPoints: number;
  homeGamesWon: number;
  awayGamesWon: number;
  /** Winner by the points → games-won cascade. Only meaningful when all games are confirmed. */
  winner: 'home' | 'away';
  /** The start-points credit applied, for display. 0 when teams are rating-matched. */
  startPointsApplied: number;
  startPointsFor: 'home' | 'away' | 'even';
}

/**
 * Compute Fargo match totals from the stored games.
 *
 * Only confirmed games with a winner are counted. Unscored / unconfirmed
 * games contribute nothing — this lets callers use the same helper for
 * running totals mid-match and final totals at completion.
 */
export function calculateFargoMatchTotals(
  args: {
    homeTeamId: string;
    awayTeamId: string;
    homeGamesToWin: number | null;
    awayGamesToWin: number | null;
    gameResults: Map<number, MatchGame> | MatchGame[];
    overrides: SystemOverrides | undefined;
  },
): FargoMatchTotals {
  const {
    homeTeamId,
    awayTeamId,
    homeGamesToWin,
    awayGamesToWin,
    gameResults,
    overrides,
  } = args;

  // Normalize the games input to StoredGameRecord[] that fargo5v5 expects.
  const iter = gameResults instanceof Map ? gameResults.values() : gameResults;
  const storedGames: StoredGameRecord[] = [];
  for (const g of iter) {
    // Skip games that aren't confirmed by both sides yet.
    if (!g.winner_team_id) continue;
    if (!g.confirmed_by_home || !g.confirmed_by_away) continue;
    const winner: 'home' | 'away' =
      g.winner_team_id === homeTeamId
        ? 'home'
        : g.winner_team_id === awayTeamId
          ? 'away'
          : 'home'; // defensive — should never hit
    // Fargo stores only `loser_balls_pocketed` on match_games — winner and
    // loser points are derived at read time inside `computeMatchResult` from
    // the snapshotted dials, so the StoredGameRecord's `winner_points` /
    // `loser_points` fields are passed as null.
    storedGames.push({
      winner_team: winner,
      winner_points: null,
      loser_points: null,
      loser_balls_pocketed: g.loser_balls_pocketed ?? null,
    });
  }

  // Determine which team received the start-points credit. The negotiation
  // flow wrote the agreed value to the weaker team's games_to_win column.
  const home = homeGamesToWin ?? 0;
  const away = awayGamesToWin ?? 0;
  let startPointsApplied = 0;
  let startPointsFor: 'home' | 'away' | 'even' = 'even';
  if (home > 0) {
    startPointsApplied = home;
    startPointsFor = 'home';
  } else if (away > 0) {
    startPointsApplied = away;
    startPointsFor = 'away';
  }

  const result = fargo5v5.scoring.computeMatchResult(
    storedGames,
    overrides ?? {},
    { fargoStartPoints: startPointsApplied, fargoStartPointsFor: startPointsFor },
  );

  return {
    homePoints: result.home_points,
    awayPoints: result.away_points,
    homeGamesWon: result.home_games_won,
    awayGamesWon: result.away_games_won,
    winner: result.winner,
    startPointsApplied,
    startPointsFor,
  };
}
