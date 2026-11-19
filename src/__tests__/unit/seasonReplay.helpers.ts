/**
 * @fileoverview Turn one season-fixture match back into the exact inputs the
 * app's scoring code takes, and re-score it through that code.
 *
 * Nothing here re-implements scoring: settings come from the same
 * `readScoringSnapshot` / `thresholdsFromMatchRow` production uses, the engine
 * runs through `computeEngineTotalsFromLineups` (the pure middle of
 * `computeEngineRunningTotals`), and legacy through `computeMatchRunningTotals`.
 * The only translation is the fixture's anonymised shape back to row shape:
 * team ids become the strings 'home' / 'away', and a confirmation becomes a
 * placeholder id (scoring only checks that one exists).
 *
 * @see src/__tests__/fixtures/season-2026-sunday-9ball.json
 * @see docs/plans/2026-11-17-001-feat-trustworthy-tests-plan.md (U4)
 */

import { computeMatchRunningTotals, type MatchRunningTotals, type MinimalMatchGame } from '@/utils/match/computeMatchRunningTotals';
import { buildThresholdInputs, computeEngineTotalsFromLineups, type LineupRow } from '@/utils/match/engineInputs';
import { readScoringSnapshot, thresholdsFromMatchRow, type MatchThresholdColumns } from '@/utils/match/scoringSnapshot';
import { getHandicapThresholds } from '@/api/queries/handicaps';
import { buildWinCalcConfig, decideWinner } from '@/systems/win-calculator';
import '@/systems/calculators'; // registers the preset calculators, as the app does on import

/** One anonymised side's lineup in the fixture. */
interface FixtureLineup {
  handicaps: (number | null)[];
  home_team_modifier: number | null;
}

/** One match as written by scripts/fetch-season-fixture.mjs. */
export interface FixtureMatch {
  key: string;
  week: number;
  weekType: string;
  home: string;
  away: string;
  snapshot: Record<string, unknown> | null;
  usesThresholdChart: boolean;
  stored: MatchThresholdColumns & MatchRunningTotals & { match_result: string | null; winner: string | null };
  lineups: { home: FixtureLineup; away: FixtureLineup };
  games: {
    n: number;
    winner: 'home' | 'away' | null;
    home_position: number | null;
    away_position: number | null;
    is_tiebreaker: boolean;
    winner_value: number | null;
    loser_value: number | null;
    confirmed_home: boolean;
    confirmed_away: boolean;
  }[];
}

/** Fixture lineup → a `match_lineups` row, with the side as its team id. */
function lineupRow(team: 'home' | 'away', lineup: FixtureLineup): LineupRow {
  const [player1_handicap, player2_handicap, player3_handicap, player4_handicap, player5_handicap] = lineup.handicaps;
  return { team_id: team, player1_handicap, player2_handicap, player3_handicap, player4_handicap, player5_handicap, home_team_modifier: lineup.home_team_modifier };
}

/** Fixture games → `match_games` rows in the shape both scoring paths read. */
function gameRows(match: FixtureMatch): MinimalMatchGame[] {
  return match.games.map((g) => ({
    winner_team_id: g.winner,
    winner_value: g.winner_value,
    loser_value: g.loser_value,
    is_tiebreaker: g.is_tiebreaker,
    confirmed_by_home: g.confirmed_home ? 'confirmed' : null,
    confirmed_by_away: g.confirmed_away ? 'confirmed' : null,
    home_position: g.home_position,
    away_position: g.away_position,
  }));
}

/**
 * Re-score a fixture match through the app's code.
 *
 * @returns engine + legacy totals; the targets today's code would set from the
 *          stored lineup handicaps; the regular-games verdict of the app's win
 *          judge ('tie' means the night went to a tiebreaker); and who won the
 *          tiebreaker games, if any were played
 * @throws if the match uses something the fixture can't replay (no snapshot,
 *         a DB threshold chart) — a loud failure, never a silent skip
 */
export function replayMatch(match: FixtureMatch) {
  const settings = readScoringSnapshot(match.snapshot);
  if (!settings) throw new Error(`${match.key}: no usable system_snapshot to replay from`);
  if (match.usesThresholdChart) throw new Error(`${match.key}: uses a DB threshold chart the fixture doesn't carry`);

  const { homeThresholds, awayThresholds } = thresholdsFromMatchRow(match.stored);
  const games = gameRows(match);
  const base = { homeTeamId: 'home', awayTeamId: 'away', homeThresholds, awayThresholds, games, ...settings };

  const home = lineupRow('home', match.lineups.home);
  const away = lineupRow('away', match.lineups.away);
  const engine = computeEngineTotalsFromLineups({ matchId: match.key, ...base }, [home, away]);
  const legacy = computeMatchRunningTotals(base);

  // Targets as prep would set them today from the stored (as-of-lock)
  // handicaps — the same handicap totals + frozen team bonus the engine uses.
  const diff = buildThresholdInputs(home, away, 0).homeHandicapDiff;
  const handicapType = String(match.snapshot?.handicap_type ?? 'points');
  const targets = {
    home: getHandicapThresholds(diff, handicapType),
    away: getHandicapThresholds(-diff, handicapType),
  };
  // The win judge exactly as MatchEndVerification calls it for the regular
  // games: running totals + the frozen win targets.
  const judged = decideWinner(
    {
      home_games: engine?.home_games_won ?? 0,
      away_games: engine?.away_games_won ?? 0,
      home_points: engine?.home_points_earned ?? 0,
      away_points: engine?.away_points_earned ?? 0,
      home_games_target: homeThresholds.games_to_win,
      away_games_target: awayThresholds.games_to_win,
      home_points_target: null,
      away_points_target: null,
      edge: null,
    },
    buildWinCalcConfig(settings.winCondition),
  ).verdict;
  const regularVerdict = 'winner' in judged ? judged.winner : 'tie';

  // Tiebreaker games are a separate short race; whoever took more of them won.
  const tb = match.games.filter((g) => g.is_tiebreaker);
  const tbHome = tb.filter((g) => g.winner === 'home').length;
  const tbAway = tb.filter((g) => g.winner === 'away').length;
  const tiebreakerWinner = tb.length === 0 ? null : tbHome > tbAway ? 'home' : tbAway > tbHome ? 'away' : 'level';

  return { engine, legacy, targets, regularVerdict, tiebreakerWinner };
}
