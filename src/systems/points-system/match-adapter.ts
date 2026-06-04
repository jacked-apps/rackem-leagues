/**
 * @fileoverview Match running-totals adapter — NEW modular engine path.
 *
 * This is the FIRST step of cutting live scoring over from the legacy
 * per-mutation calculator (`src/utils/match/computeMatchRunningTotals.ts`)
 * to the new composable Points System engine
 * (`src/systems/points-system/runtime.ts`).
 *
 * `computeMatchRunningTotalsViaEngine` produces the SAME four running totals
 * the legacy calculator produces — `home_games_won`, `away_games_won`,
 * `home_points_earned`, `away_points_earned` — but computes the points half
 * through `evaluatePointsSystem` over a per-system composition rather than
 * through the bundled `getCalculator(...)` registry.
 *
 * **Isolation contract (this PR).** This adapter is wired into NOTHING. It
 * exists alongside the legacy path, proven equivalent by
 * `__tests__/match-adapter.test.ts`. No production caller imports it yet.
 *
 * **Why a parallel adapter rather than an in-place swap?** Per the locked
 * "two independent paths that audit each other" pattern: the legacy
 * calculator stays the source of truth for parity while the engine path is
 * proven byte-for-byte equal across every band/mode/param set. Only once the
 * parity gate is green do we wire the engine path into live scoring.
 *
 * ----------------------------------------------------------------------------
 * Legacy → engine mapping (the load-bearing equivalences this file encodes)
 * ----------------------------------------------------------------------------
 *
 * Game counting is IDENTICAL to legacy: only fully-confirmed
 * (both sides confirmed), non-tiebreaker games with a winner count; the
 * winner is attributed to home/away by `winner_team_id`.
 *
 * Calculator → composition dispatch:
 *   - `'linear_above_threshold'`          → `buildPoints3ManComposition`
 *   - `'accumulate_with_milestone_jumps'` → `buildPercent5ManComposition`
 *   - `'accumulated_per_game'`            → `buildTenPointComposition`
 *   - `'none'` / `null` / unknown         → 0 points (game counts still returned)
 *
 * Start-credit reconciliation (the subtle part — see `addsStartCreditViaEngine`):
 *   - Legacy folds a `*_to_tie` start-credit into points ONLY when
 *     `winCondition === 'points'`.
 *   - The 10-Point composition ALREADY awards the head-start at match start
 *     (via its `match_start` triggers, computed from lineup ratings). So for
 *     the 10-Point path the engine ALREADY includes the credit — the adapter
 *     must NOT add `*_to_tie` again (that would double-count).
 *   - The Points 3-Man + Percentage 5-Man compositions have NO `match_start`
 *     points triggers, so the engine does NOT include any start-credit. For
 *     those, when `winCondition === 'points'`, the adapter folds in
 *     `*_to_tie` exactly the way legacy does.
 *
 * @see ./runtime.ts — the engine evaluator this adapter drives
 * @see src/utils/match/computeMatchRunningTotals.ts — the legacy source of truth
 * @see ./__tests__/match-adapter.test.ts — the parity gate
 * @see ./__tests__/cross-audit-points-3-man.test.ts — composition ↔ calculator audit
 * @see ./__tests__/cross-audit-percent-5-man.test.ts
 * @see ./__tests__/cross-audit-10-point.test.ts
 */

import type { HandicapThresholds } from '@/types/match';
import { evaluatePointsSystem, type RuntimeGameRecord } from './runtime';
import { buildPoints3ManComposition } from './compositions/points-3-man';
import { buildPercent5ManComposition } from './compositions/percent-5-man';
import { buildTenPointComposition } from './compositions/10-point';
import type { PerGameAllocator, PointsSystem, ThresholdInputs } from './types';

/**
 * Minimal `match_games` row shape this adapter consumes — identical to the
 * legacy `MinimalMatchGame` so callers can feed the exact same array to both
 * paths during the parity period. Re-declared (not imported) to keep the
 * adapter free of any dependency on the legacy file.
 */
export interface MinimalMatchGame {
  /** Winning team's ID. `null` for unscored or vacated games. */
  winner_team_id: string | null;
  /** Per-game input collected from the winner side (null when fixed-kind). */
  winner_value: number | null;
  /** Per-game input collected from the loser side (e.g. balls pocketed). */
  loser_value: number | null;
  /** Whether this game was a tiebreaker (excluded from regular running totals). */
  is_tiebreaker: boolean;
  /** Member ID of the home-team confirmer. `null` until home confirms. */
  confirmed_by_home: string | null;
  /** Member ID of the away-team confirmer. `null` until away confirms. */
  confirmed_by_away: string | null;
}

/**
 * Arguments for {@link computeMatchRunningTotalsViaEngine}.
 *
 * Carries the same identifying + game inputs the legacy function takes, plus
 * the new-engine inputs:
 *  - `thresholdInputs` — a single combined `ThresholdInputs` (ratings,
 *    handicap diffs, game count, prefs). The caller builds this the same way
 *    the cross-audit tests do; the adapter folds calculator params that the
 *    percentage composition reads from `prefs` (see below) into a copy.
 *  - `homeThresholds` / `awayThresholds` — the snapshotted per-side
 *    `HandicapThresholds`. Only `*_to_tie` is consumed, and ONLY for the
 *    start-credit fold-in on compositions that don't award it themselves
 *    (Points 3-Man / Percentage 5-Man in points-mode).
 */
export interface ComputeMatchRunningTotalsViaEngineArgs {
  /** Home team's ID — attributes games-won + selects home side. */
  homeTeamId: string;
  /** Away team's ID — attributes games-won + selects away side. */
  awayTeamId: string;
  /**
   * The full set of `match_games` rows. May contain unscored, unconfirmed,
   * denied, vacated, or tiebreaker games — the adapter filters identically
   * to legacy. Order is preserved for the per-game engine pass.
   */
  games: ReadonlyArray<MinimalMatchGame>;
  /** Calculator name (from the match snapshot). `null`/`'none'` → 0 points. */
  pointsCalculator: string | null;
  /** Calculator-specific params (from the match snapshot). */
  pointsCalculatorParams: Record<string, unknown>;
  /**
   * Match win condition. When `'points'`, the legacy `*_to_tie` start-credit
   * is folded in for compositions that don't already award it at match start.
   */
  winCondition: 'games' | 'points';
  /**
   * Combined threshold inputs for the new engine (ratings, handicap diffs,
   * game count, prefs). Built by the caller per system — mirrors the
   * cross-audit setup.
   */
  thresholdInputs: ThresholdInputs;
  /** Home side's snapshotted thresholds — only `games_to_tie` is consumed. */
  homeThresholds: HandicapThresholds;
  /** Away side's snapshotted thresholds — only `games_to_tie` is consumed. */
  awayThresholds: HandicapThresholds;
  /**
   * Per-Game Allocator Room override (Unit 5). When non-null, the prepackaged
   * composition's `perGameAllocator` slot is REPLACED with this object after
   * `buildComposition` builds the prepackaged shape. Triggers and thresholds
   * stay untouched.
   *
   * Sourced from the match snapshot's `per_game_allocator` field, populated
   * at snapshot-write time by the loader. Live scoring never re-fetches the
   * row — the frozen object honors R9 (historical replay stability).
   *
   * `null` / `undefined` = no override, prepackaged composition unchanged.
   */
  perGameAllocatorOverride?: PerGameAllocator | null;
}

/** The four running totals — identical shape to the legacy result. */
export interface MatchRunningTotals {
  home_games_won: number;
  away_games_won: number;
  home_points_earned: number;
  away_points_earned: number;
}

/**
 * Whether the composition selected for `pointsCalculator` already awards the
 * start-credit head-start itself (via `match_start` triggers). Drives the
 * start-credit reconciliation: when `true` the engine result already includes
 * the credit and the adapter must NOT add `*_to_tie` again.
 *
 * Today only the 10-Point composition (`accumulated_per_game`) awards a
 * head-start at match start; the aggregate calculators do not.
 */
function compositionAwardsStartCredit(pointsCalculator: string): boolean {
  return pointsCalculator === 'accumulated_per_game';
}

/**
 * Build the engine composition for a calculator name, mapping the legacy
 * `pointsCalculatorParams` into the composition's own param interface.
 *
 * Returns `null` for `'none'` / unknown names — the caller short-circuits to
 * zero points (game counts still returned).
 *
 * Param mappings (legacy calc params → composition params):
 *  - `linear_above_threshold`: `per_extra_game_multiplier` → `multiplier`.
 *  - `accumulate_with_milestone_jumps`: `per_game_increment`,
 *    `milestone_jump_value`, `win_threshold_jump_value` map straight across;
 *    `milestone_percent` is NOT a composition param — it flows through
 *    `prefs.milestone_percent` (handled in
 *    {@link buildThresholdInputsForCalculator}).
 *  - `accumulated_per_game`: `winner.points` → `winner_points` (fixed kind),
 *    `loser.{min,max,label}` → `loser_{min,max,label}` (counter kind).
 */
function buildComposition(
  pointsCalculator: string,
  params: Record<string, unknown>,
  perGameAllocatorOverride?: PerGameAllocator | null,
): PointsSystem | null {
  const prepackaged = buildPrepackagedComposition(pointsCalculator, params);
  if (prepackaged === null) return null;
  if (!perGameAllocatorOverride) return prepackaged;
  // Per-Game Allocator Room (Unit 5): replace ONLY the allocator slot. Triggers
  // and thresholds stay as the prepackaged composition declared them. Suffix
  // the composition name so logs distinguish a swapped composition from its
  // prepackaged peer.
  return {
    ...prepackaged,
    name: `${prepackaged.name}__custom_${perGameAllocatorOverride.name}`,
    perGameAllocator: perGameAllocatorOverride,
  };
}

/**
 * Build the prepackaged composition for a calculator name — the pre-Unit-5
 * behavior, untouched. The room's swap (`buildComposition`) wraps this and
 * replaces the allocator slot when an override is passed.
 */
function buildPrepackagedComposition(
  pointsCalculator: string,
  params: Record<string, unknown>,
): PointsSystem | null {
  switch (pointsCalculator) {
    case 'linear_above_threshold': {
      const multiplier =
        typeof params.per_extra_game_multiplier === 'number'
          ? params.per_extra_game_multiplier
          : undefined;
      return buildPoints3ManComposition(
        multiplier === undefined ? {} : { multiplier },
      );
    }

    case 'accumulate_with_milestone_jumps': {
      const passThrough: Parameters<typeof buildPercent5ManComposition>[0] = {};
      if (typeof params.per_game_increment === 'number') {
        passThrough.per_game_increment = params.per_game_increment;
      }
      if (typeof params.milestone_jump_value === 'number') {
        passThrough.milestone_jump_value = params.milestone_jump_value;
      }
      if (typeof params.win_threshold_jump_value === 'number') {
        passThrough.win_threshold_jump_value = params.win_threshold_jump_value;
      }
      return buildPercent5ManComposition(passThrough);
    }

    case 'accumulated_per_game': {
      const passThrough: Parameters<typeof buildTenPointComposition>[0] = {};
      const winner = params.winner as
        | { kind?: string; points?: number }
        | undefined;
      const loser = params.loser as
        | { kind?: string; min?: number; max?: number; label?: string }
        | undefined;
      if (winner?.kind === 'fixed' && typeof winner.points === 'number') {
        passThrough.winner_points = winner.points;
      }
      if (loser?.kind === 'counter') {
        if (typeof loser.min === 'number') passThrough.loser_min = loser.min;
        if (typeof loser.max === 'number') passThrough.loser_max = loser.max;
        if (typeof loser.label === 'string') passThrough.loser_label = loser.label;
      }
      return buildTenPointComposition(passThrough);
    }

    default:
      return null;
  }
}

/**
 * Produce the `ThresholdInputs` the engine should run with, folding in the
 * calculator params that a composition reads from `prefs` rather than from
 * factory params.
 *
 * Only the Percentage 5-Man composition needs this bridge: it resolves
 * `milestone_percent` and `games_to_win` from `prefs` at match start. The
 * legacy calculator carries `milestone_percent` in its params and reads
 * `games_to_win` from the snapshotted thresholds, so the adapter copies both
 * into `prefs` (without mutating the caller's object) when present and not
 * already supplied.
 *
 * For the other calculators the inputs pass through unchanged.
 */
function buildThresholdInputsForCalculator(
  pointsCalculator: string,
  params: Record<string, unknown>,
  thresholdInputs: ThresholdInputs,
  homeThresholds: HandicapThresholds,
): ThresholdInputs {
  if (pointsCalculator !== 'accumulate_with_milestone_jumps') {
    return thresholdInputs;
  }

  const prefs: Record<string, unknown> = { ...thresholdInputs.prefs };

  // milestone_percent: legacy param → prefs (composition reads from prefs).
  if (
    prefs.milestone_percent === undefined &&
    typeof params.milestone_percent === 'number'
  ) {
    prefs.milestone_percent = params.milestone_percent;
  }

  // games_to_win: legacy reads it from the snapshotted thresholds; the
  // composition reads it from prefs. Bridge it across when present.
  if (prefs.games_to_win === undefined && homeThresholds.games_to_win != null) {
    prefs.games_to_win = homeThresholds.games_to_win;
  }

  return { ...thresholdInputs, prefs };
}

/**
 * Map a confirmed-regular `MinimalMatchGame` to the engine's
 * `RuntimeGameRecord`. `winnerSide` is derived from `winner_team_id` vs the
 * home team's ID (anything that isn't the home team's win is treated as an
 * away win — the games are pre-filtered to confirmed home/away winners).
 */
function toRuntimeGameRecord(
  game: MinimalMatchGame,
  homeTeamId: string,
): RuntimeGameRecord {
  return {
    winnerSide: game.winner_team_id === homeTeamId ? 'home' : 'away',
    winnerCounterInput: game.winner_value,
    loserCounterInput: game.loser_value,
  };
}

/**
 * Compute the four match running totals via the NEW modular Points System
 * engine. Produces the SAME result the legacy
 * `computeMatchRunningTotals` produces for the same scenario — proven by the
 * parity test.
 *
 * Flow:
 *  1. Filter to confirmed, non-tiebreaker, winner-bearing games (identical to
 *     legacy) and count home/away wins by `winner_team_id`.
 *  2. If no calculator applies (`null` / `'none'` / unknown), return the game
 *     counts with 0 points.
 *  3. Build the composition for the calculator, mapping its params.
 *  4. Map the counted games to engine records and run `evaluatePointsSystem`.
 *  5. Read `home_points` / `away_points` off the resulting state bag.
 *  6. Fold in the legacy `*_to_tie` start-credit ONLY for points-mode AND
 *     compositions that don't already award it (avoids double-counting the
 *     10-Point head-start).
 */
export function computeMatchRunningTotalsViaEngine(
  args: ComputeMatchRunningTotalsViaEngineArgs,
): MatchRunningTotals {
  const {
    homeTeamId,
    awayTeamId,
    games,
    pointsCalculator,
    pointsCalculatorParams,
    winCondition,
    thresholdInputs,
    homeThresholds,
    awayThresholds,
    perGameAllocatorOverride,
  } = args;

  // 1. Count games exactly the way legacy does.
  const confirmedRegular = games.filter(
    (g) =>
      g.winner_team_id !== null &&
      g.confirmed_by_home !== null &&
      g.confirmed_by_away !== null &&
      !g.is_tiebreaker,
  );

  let home_games_won = 0;
  let away_games_won = 0;
  for (const g of confirmedRegular) {
    if (g.winner_team_id === homeTeamId) home_games_won += 1;
    else if (g.winner_team_id === awayTeamId) away_games_won += 1;
  }

  // 2. No calculator → game counts only, 0 points (matches legacy
  //    null/'none'/unknown short-circuits).
  const composition =
    pointsCalculator === null || pointsCalculator === 'none'
      ? null
      : buildComposition(
          pointsCalculator,
          pointsCalculatorParams,
          perGameAllocatorOverride,
        );

  if (composition === null) {
    return {
      home_games_won,
      away_games_won,
      home_points_earned: 0,
      away_points_earned: 0,
    };
  }

  // 3. Build engine inputs (prefs bridge for the percentage composition).
  const engineInputs = buildThresholdInputsForCalculator(
    pointsCalculator!,
    pointsCalculatorParams,
    thresholdInputs,
    homeThresholds,
  );

  // 4. Map games to engine records (only the same games legacy counts) and run.
  //    Aggregate calculators ignore per-game order; per-game ones honor it —
  //    preserving the input order keeps both correct.
  const gameRecords = confirmedRegular.map((g) =>
    toRuntimeGameRecord(g, homeTeamId),
  );
  const state = evaluatePointsSystem(composition, engineInputs, gameRecords);

  let home_points_earned = (state.home_points as number) ?? 0;
  let away_points_earned = (state.away_points as number) ?? 0;

  // 5. Start-credit reconciliation. Legacy folds *_to_tie into points-mode
  //    totals. Compositions that already award the head-start at match start
  //    (10-Point) must NOT have it added again.
  if (
    winCondition === 'points' &&
    !compositionAwardsStartCredit(pointsCalculator!)
  ) {
    home_points_earned += homeThresholds.games_to_tie ?? 0;
    away_points_earned += awayThresholds.games_to_tie ?? 0;
  }

  return {
    home_games_won,
    away_games_won,
    home_points_earned,
    away_points_earned,
  };
}
