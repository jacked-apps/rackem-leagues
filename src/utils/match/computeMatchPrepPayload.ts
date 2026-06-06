/**
 * @fileoverview Pure builder for the `prep_match` RPC payload, driven by a
 * single actor (the League Operator manual-scoring flow).
 *
 * The live two-captain flow builds this payload inside
 * `src/hooks/lineup/useMatchPreparation.ts`, wrapped in realtime/opponent-locked
 * orchestration that has no meaning for a single operator. This helper extracts
 * just the *computation* — threshold dispatch + game-row generation — so the LO
 * setup driver (`loSetupMatch`, Unit 2) can call `prep_match` directly with both
 * lineups supplied at once.
 *
 * It deliberately does NOT touch the live hook (zero regression surface for live
 * scoring); it mirrors that hook's dispatch against the same shared primitives
 * (`generateGameOrder`, `computeFargoGamesWonThresholds`,
 * `calculateHandicapThresholds`, `fargo5v5.handicapMechanism`).
 *
 * The one place it must do MORE than the live hook: Fargo + points (start-points)
 * mode. The live hook reads the start-credit from `matchData.*_to_tie`, which the
 * two-captain *negotiation* wrote earlier. The LO flow runs no negotiation, so this
 * helper computes the start-credit directly from the frozen lineup ratings via
 * `fargo5v5.handicapMechanism.compute(...)` — the same pure calc the negotiation's
 * `computedDefault` uses — and maps it onto the weaker team's `*_to_tie`, mirroring
 * `useFargoStartPointsNegotiation`'s initial-write mapping.
 *
 * @see src/hooks/lineup/useMatchPreparation.ts — the live dispatch this mirrors
 * @see src/hooks/lineup/useFargoStartPointsNegotiation.ts — the start-credit mapping
 * @see docs/plans/2026-06-03-001-feat-lo-manual-match-scoring-plan.md — Unit 1
 */

import { generatePairings, type GameGeneration } from '@/systems/pairings';
import { computeGameCount } from '@/systems/team-geometry';
import { calculateHandicapThresholds } from '@/utils/calculateHandicapThresholds';
import { computeFargoGamesWonThresholds } from '@/utils/handicap/fargoGamesWonThresholds';
import { fargo5v5 } from '@/systems/fargo5v5';
import { logger } from '@/utils/logger';
import type { SystemOverrides } from '@/types/systemOverrides';

/**
 * A match lineup in the `match_lineups` per-position shape. Positions 4/5 are
 * optional (3v3 omits them). Handicaps are the frozen per-player values the
 * engine reads; for Fargo leagues the handicap IS the player's rating.
 */
export interface MatchPrepLineup {
  player1_id: string | null;
  player1_handicap: number;
  player2_id: string | null;
  player2_handicap: number;
  player3_id: string | null;
  player3_handicap: number;
  player4_id?: string | null;
  player4_handicap?: number;
  player5_id?: string | null;
  player5_handicap?: number;
}

/** The six match-row threshold columns, in the exact `prep_match` p_thresholds shape. */
export interface MatchPrepThresholds {
  home_to_win: number | null;
  home_to_tie: number | null;
  home_to_lose: number | null;
  away_to_win: number | null;
  away_to_tie: number | null;
  away_to_lose: number | null;
}

/** One `match_games` row, in the exact `prep_match` p_game_rows shape. */
export interface MatchPrepGameRow {
  game_number: number;
  game_type: string;
  home_player_id: string | null;
  away_player_id: string | null;
  home_position: number;
  away_position: number;
  home_action: 'breaks' | 'racks';
  away_action: 'breaks' | 'racks';
}

/** The full payload `prep_match(p_match_id, p_thresholds, p_game_rows)` expects. */
export interface MatchPrepPayload {
  thresholds: MatchPrepThresholds;
  gameRows: MatchPrepGameRow[];
}

export interface ComputeMatchPrepPayloadArgs {
  /** Home lineup (positions + frozen handicaps). */
  homeLineup: MatchPrepLineup;
  /** Away lineup (positions + frozen handicaps). */
  awayLineup: MatchPrepLineup;
  /** Players per team — 3 (3v3) or 5 (5v5). */
  lineupSize: number;
  /**
   * `game_generation` preference. 'double_round_robin' (default) produces the
   * full double round; any other value produces a single round.
   */
  gameGeneration?: string;
  /** Resolved league handicap_type ('fargo' | 'points' | 'percentage' | …). */
  handicapType: string;
  /** Win-condition axis from resolved prefs. Drives Fargo threshold dispatch. */
  winCondition?: 'games' | 'points';
  /** Threshold-mechanism axis. Combined with winCondition to pick the compute. */
  mechanism?: 'extra_games' | 'start_points' | 'race_length_adjustment' | 'none';
  /** Resolved per-league dial overrides (used by the Fargo start-points calc). */
  systemOverrides?: SystemOverrides;
  /** Home team id — needed by the non-Fargo team-bonus lookup. */
  homeTeamId: string;
  /** Away team id — needed by the non-Fargo team-bonus lookup. */
  awayTeamId: string;
  /** Season id — needed by the non-Fargo team-bonus lookup. */
  seasonId: string;
  /** League game_type for the created game rows. Defaults to 'eight_ball'. */
  gameType?: string;
}

/**
 * Extract the n=1..lineupSize handicaps (ratings, for Fargo) from a lineup.
 * Non-numeric / missing positions are dropped, so the caller can length-check
 * the result against `lineupSize`.
 */
function ratingsForLineup(lineup: MatchPrepLineup, lineupSize: number): number[] {
  const ratings: number[] = [];
  for (let n = 1; n <= lineupSize; n++) {
    const handicap = (lineup as unknown as Record<string, unknown>)[`player${n}_handicap`];
    if (typeof handicap === 'number') ratings.push(handicap);
  }
  return ratings;
}

/**
 * Fargo + points (start-points) thresholds. Computes the start-credit from the
 * frozen ratings (the pure calc the negotiation's `computedDefault` uses) and
 * maps it onto the weaker team's `*_to_tie`; `*_to_win`/`*_to_lose` stay null
 * (Fargo points plays all games to totals — no match-level point threshold).
 *
 * Degrades safely (0/0 credit, logged) rather than throwing — live scoring must
 * never break on a guard miss.
 */
function computeFargoStartPointThresholds(
  homeLineup: MatchPrepLineup,
  awayLineup: MatchPrepLineup,
  lineupSize: number,
  systemOverrides: SystemOverrides | undefined
): MatchPrepThresholds {
  const evenThresholds: MatchPrepThresholds = {
    home_to_win: null,
    home_to_tie: 0,
    home_to_lose: null,
    away_to_win: null,
    away_to_tie: 0,
    away_to_lose: null,
  };

  const mechanism = fargo5v5.handicapMechanism;
  if (mechanism?.kind !== 'start_points') {
    logger.warn('computeMatchPrepPayload: fargo5v5 start_points mechanism unavailable; defaulting start-credit to 0');
    return evenThresholds;
  }

  const homeRatings = ratingsForLineup(homeLineup, lineupSize);
  const awayRatings = ratingsForLineup(awayLineup, lineupSize);
  if (homeRatings.length !== lineupSize || awayRatings.length !== lineupSize) {
    logger.warn('computeMatchPrepPayload: incomplete Fargo ratings; defaulting start-credit to 0', {
      lineupSize,
      homeCount: homeRatings.length,
      awayCount: awayRatings.length,
    });
    return evenThresholds;
  }

  let result;
  try {
    result = mechanism.compute(homeRatings, awayRatings, systemOverrides ?? {});
  } catch (err) {
    logger.warn('computeMatchPrepPayload: Fargo start-points compute failed; defaulting start-credit to 0', {
      error: err instanceof Error ? err.message : String(err),
    });
    return evenThresholds;
  }

  const credit = result.startPointsForWeakerTeam;
  if (result.weakerTeam === 'home') {
    return { ...evenThresholds, home_to_tie: credit, away_to_tie: 0 };
  }
  if (result.weakerTeam === 'away') {
    return { ...evenThresholds, away_to_tie: credit, home_to_tie: 0 };
  }
  // weakerTeam === 'even' — rating-matched, zero credit both sides.
  return evenThresholds;
}

/**
 * Build the `prep_match` payload (thresholds + game rows) for a single-actor
 * (LO) match setup. Async because the non-Fargo threshold path does a
 * team-bonus DB lookup via `calculateHandicapThresholds`.
 *
 * Dispatch mirrors `useMatchPreparation`:
 *  - Fargo + points (start_points)  → start-credit on the weaker team's `*_to_tie`.
 *  - Fargo + games-won              → `computeFargoGamesWonThresholds`.
 *  - otherwise (BCA points / %)     → `calculateHandicapThresholds`.
 *
 * @param args - Both lineups + the resolved league config needed to compute.
 * @returns A payload whose `thresholds` and `gameRows` map 1:1 onto the
 *          `prep_match(p_match_id, p_thresholds, p_game_rows)` parameters.
 */
export async function computeMatchPrepPayload(
  args: ComputeMatchPrepPayloadArgs
): Promise<MatchPrepPayload> {
  const {
    homeLineup,
    awayLineup,
    lineupSize,
    gameGeneration,
    handicapType,
    winCondition,
    mechanism,
    systemOverrides,
    homeTeamId,
    awayTeamId,
    seasonId,
    gameType,
  } = args;

  const useDoubleRoundRobin = (gameGeneration ?? 'double_round_robin') === 'double_round_robin';
  const resolvedGameGeneration: GameGeneration = useDoubleRoundRobin
    ? 'double_round_robin'
    : 'single_round_robin';

  // Threshold dispatch on (handicapType + winCondition + mechanism), exactly as
  // the live hook: a Fargo league with a games-won win condition gets games-won
  // thresholds, not start-points.
  const isFargoStartPoints =
    handicapType === 'fargo' && (mechanism === 'start_points' || winCondition === 'points');
  const isFargoGamesWon = handicapType === 'fargo' && !isFargoStartPoints;

  let thresholds: MatchPrepThresholds;

  if (isFargoStartPoints) {
    thresholds = computeFargoStartPointThresholds(homeLineup, awayLineup, lineupSize, systemOverrides);
  } else if (isFargoGamesWon) {
    const homeRatings = ratingsForLineup(homeLineup, lineupSize);
    const awayRatings = ratingsForLineup(awayLineup, lineupSize);
    const totalGames = computeGameCount(lineupSize, resolvedGameGeneration);
    const fargoThresholds = computeFargoGamesWonThresholds({
      homeRatings,
      awayRatings,
      totalGames,
    });
    thresholds = {
      home_to_win: fargoThresholds.home.games_to_win,
      home_to_tie: fargoThresholds.home.games_to_tie,
      home_to_lose: fargoThresholds.home.games_to_lose,
      away_to_win: fargoThresholds.away.games_to_win,
      away_to_tie: fargoThresholds.away.games_to_tie,
      away_to_lose: fargoThresholds.away.games_to_lose,
    };
  } else {
    // Non-Fargo (BCA points / percentage). arg1 = home, arg2 = away.
    const { homeThresholds, awayThresholds } = await calculateHandicapThresholds(
      homeLineup as never,
      awayLineup as never,
      homeTeamId,
      awayTeamId,
      seasonId,
      handicapType
    );
    thresholds = {
      home_to_win: homeThresholds.games_to_win,
      home_to_tie: homeThresholds.games_to_tie,
      home_to_lose: homeThresholds.games_to_lose,
      away_to_win: awayThresholds.games_to_win,
      away_to_tie: awayThresholds.games_to_tie,
      away_to_lose: awayThresholds.games_to_lose,
    };
  }

  // Game rows from the canonical pairings generator (Module #8) — the SAME
  // generator the live prep uses, so LO-entered games match live exactly.
  const homeRecord = homeLineup as unknown as Record<string, unknown>;
  const awayRecord = awayLineup as unknown as Record<string, unknown>;
  const lineupIds = (rec: Record<string, unknown>): string[] =>
    Array.from({ length: lineupSize }, (_, i) => (rec[`player${i + 1}_id`] as string | null) ?? '');
  const allGames = generatePairings({
    lineupSize,
    gameGeneration: resolvedGameGeneration,
    homeLineup: lineupIds(homeRecord),
    awayLineup: lineupIds(awayRecord),
  });
  const gameRows: MatchPrepGameRow[] = allGames.map((game) => ({
    game_number: game.gameNumber,
    game_type: gameType || 'eight_ball',
    home_player_id: game.homePlayerId || null,
    away_player_id: game.awayPlayerId || null,
    home_position: game.homePosition,
    away_position: game.awayPosition,
    home_action: game.homeAction,
    away_action: game.awayAction,
  }));

  return { thresholds, gameRows };
}
