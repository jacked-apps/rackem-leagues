/**
 * @fileoverview PointsCalculator interface — the calculator-as-type-with-params
 * pattern (Phase 1 Unit 1.1 of the modular-league-system v2 plan).
 *
 * A PointsCalculator is the runtime contract every points formula implements.
 * It encodes:
 *   - WHAT the formula computes (aggregate vs per-game input shape, math)
 *   - WHICH parameters the LO can edit (defaultParams + paramSchema)
 *   - HOW the per-game scoring popup should look (scoringPopupFields)
 *
 * The runtime is parameter-blind: it looks up a calculator by name in the
 * registry, hands it the right input + the league's stored params, gets a
 * points number back. It doesn't know what the parameter values mean — only
 * the calculator's `compute` function does. This is the same pattern as
 * `threshold_charts`: shape + editable values + parameter-blind dispatch.
 *
 * Calculators come in two kinds, distinguished by what they need as input:
 *   - **aggregate** — takes the team's total games_won + the threshold values.
 *     The points are a function of "how many games you won relative to your
 *     target." Used by `linear_above_threshold` (BCA 3v3 style) and
 *     `accumulate_with_milestone_jumps` (BCA 5v5 style).
 *   - **per_game** — takes the list of stored game records, including
 *     per-game details like balls pocketed. The points are accumulated
 *     game-by-game. Used by `accumulated_per_game` (Fargo 10-7 style).
 *
 * The discriminated-union top-level type means TypeScript narrows the
 * `compute` signature based on `kind`. An aggregate calculator can't be
 * given per-game input by accident (and vice versa) — the compiler enforces.
 *
 * Display metadata for the wizard (formula text, worked examples, descriptions)
 * deliberately lives ELSEWHERE — see the wizard's `CALCULATOR_DESCRIPTIONS`
 * map. Keeping the runtime interface narrow honors the plan's scope-guardian
 * finding: documentation/UX strings are wizard-layer concerns, not runtime
 * contract concerns.
 *
 * @see docs/plans/2026-05-01-001-feat-modular-league-system-v2-plan.md (Unit 1.1)
 */

import type { z } from 'zod';
import type { HandicapThresholds } from '@/types/match';

// ============================================================================
// Input shapes
// ============================================================================

/**
 * Input for an aggregate-style calculator. The team's total games-won is fed
 * in alongside the threshold values that define the bands (to-win, to-tie,
 * to-lose). The calculator works out the points purely from those numbers.
 */
export interface AggregateInput {
  gamesWon: number;
  thresholds: HandicapThresholds;
}

/**
 * Input for a per-game-style calculator. The list of stored games is fed in;
 * the calculator sums per-game contributions for the requested team.
 *
 * Tiebreaker filtering is the caller's responsibility — `linear_above_threshold`
 * never receives per-game input (it's aggregate; caller passes a regular-only
 * games_won scalar), but `accumulated_per_game` is given whatever subset of
 * games the caller decides to pass. Phase 5 Unit 5.5's per-game scoring
 * mutation is where the "what subset" decision lives.
 *
 * Field semantics:
 *   - `winner_team_id`: the winning team's ID. `null` for incomplete games
 *     (which the calculator should skip).
 *   - `winner_score` / `loser_score`: the counter values collected by the
 *     scoring popup at game-record time. The calculator's params describe
 *     what the values mean (e.g. for Fargo 10-7, `loser_score` = balls
 *     pocketed by the loser, range 0–7). When the calculator's per-side
 *     config for that side is `kind: 'fixed'`, the score field is unused.
 *     `null` means "not collected" — calculator handles defensively.
 *   - `is_tiebreaker`: whether this game was played as a tiebreaker.
 *     Calculators are free to consult this if their rule depends on it.
 *
 * Player IDs / positions / achievements are deliberately NOT in the calculator
 * input — those are league-preference-driven concerns separate from scoring.
 */
export interface PerGameInput {
  games: ReadonlyArray<{
    winner_team_id: string | null;
    winner_score: number | null;
    loser_score: number | null;
    is_tiebreaker: boolean;
  }>;
  /**
   * Which team's points to compute. The calculator iterates `games` and
   * applies winner-side or loser-side rules based on which side this team
   * was on for each game.
   */
  teamId: string;
}

// ============================================================================
// Scoring popup field spec — what fields the per-game UI should ask for
// ============================================================================

/**
 * Per-side input config for the scoring popup. A side either contributes a
 * fixed number of points (no input field shown — value is implicit, e.g.
 * "winner gets 10 points always") or asks the scorer for a counter input
 * with a min/max range (e.g. "loser pocketed N balls, 0–7").
 */
export type ScoringPopupSideSpec =
  | {
      kind: 'fixed';
      /** The implicit points value contributed when this side is in this role. */
      points: number;
    }
  | {
      kind: 'counter';
      /** Inclusive lower bound for the counter. */
      min: number;
      /** Inclusive upper bound for the counter. */
      max: number;
      /** Display label shown next to the counter (e.g. "Balls pocketed by loser"). */
      label: string;
    };

/**
 * Spec describing the per-game scoring popup's calculator-driven fields.
 *
 * `perSideInputs` describes the calculator-driven scoring fields. Aggregate-
 * input calculators leave it `null` — the popup only needs a winner picker.
 * Per-game calculators populate it with per-side configuration derived from
 * the league's params (e.g. fargo 10-7 with default params produces
 * `{ winner: { kind: 'fixed', points: 10 }, loser: { kind: 'counter', min: 0,
 * max: 7, label: 'Balls pocketed' } }`).
 *
 * Achievement fields (golden break, break-and-run, etc.) are league-preference
 * driven and live OUTSIDE this spec. The popup composes the calculator-driven
 * fields with the league's achievement preferences.
 */
export interface ScoringPopupFieldSpec {
  perSideInputs: {
    winner: ScoringPopupSideSpec;
    loser: ScoringPopupSideSpec;
  } | null;
}

// ============================================================================
// PointsCalculator (discriminated union by kind)
// ============================================================================

/** Common fields every calculator declares regardless of input kind. */
interface CalculatorBase<P> {
  /**
   * Stable name used as the value in `preferences.points_calculator` and
   * `match.system_snapshot.points_calculator`. Must be unique across the
   * registry. Lowercase snake_case by convention.
   */
  name: string;

  /**
   * The Tested Preset values for this calculator. The wizard pre-fills these
   * when the LO selects this calculator card; the LO can override.
   */
  defaultParams: P;

  /**
   * zod schema for the params object. Used to validate at save time when the
   * LO submits the wizard form. The runtime ALSO validates at compute time
   * (defense in depth) so a malformed params blob produces a logged warning
   * + safe-default fallback rather than NaN propagating into match scoring.
   */
  paramSchema: z.ZodSchema<P>;

  /**
   * Returns the per-game scoring popup field spec for this calculator at
   * the given params. The popup adapts to whatever the league has configured.
   *
   * For aggregate calculators this returns `{ perSideInputs: null }` — only a
   * winner picker is needed. For per-game calculators it returns the per-side
   * counter / fixed-points spec.
   */
  scoringPopupFields: (params: P) => ScoringPopupFieldSpec;
}

/**
 * Aggregate-input calculator. Compute takes `(gamesWon, thresholds, params)`.
 *
 * Used by formulas where points are a pure function of the team's total
 * games-won relative to the threshold (linear above-threshold, milestone
 * jumps, etc.).
 */
export interface AggregatePointsCalculator<P> extends CalculatorBase<P> {
  kind: 'aggregate';
  compute: (input: AggregateInput, params: P) => number;
}

/**
 * Per-game-input calculator. Compute takes `(games, teamId, params)`.
 *
 * Used by formulas that accumulate points game-by-game from stored game
 * records (e.g. winner gets fixed points + loser gets balls pocketed).
 */
export interface PerGamePointsCalculator<P> extends CalculatorBase<P> {
  kind: 'per_game';
  compute: (input: PerGameInput, params: P) => number;
}

/**
 * The PointsCalculator interface — discriminated by `kind`. Use the
 * discriminator to narrow the `compute` signature at the call site.
 *
 * @example (in a caller — pseudo-pattern, see Unit 5.5 for actual scoring flow)
 *   const calculator = getCalculator(snapshot.points_calculator);
 *   if (calculator?.kind === 'aggregate') {
 *     const points = calculator.compute({ gamesWon, thresholds }, params);
 *   } else if (calculator?.kind === 'per_game') {
 *     const points = calculator.compute({ games, teamId }, params);
 *   }
 */
export type PointsCalculator<P = unknown> =
  | AggregatePointsCalculator<P>
  | PerGamePointsCalculator<P>;
