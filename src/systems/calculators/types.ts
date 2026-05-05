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
 * Display metadata splits along strings vs. structural-meta lines:
 *   - **Display STRINGS** for the wizard (formula text, worked examples,
 *     long descriptions) live elsewhere — wizard-layer concern, never on
 *     the calculator module.
 *   - **Display META** describing how the scoreboard should render params
 *     (e.g. "this param is a milestone marker") lives on the calculator
 *     itself via `displayHints` / `getDisplayHints`. This is structural
 *     meta-data ABOUT params (closer to `paramSchema`'s existing role)
 *     rather than UX strings.
 *
 * @see docs/plans/2026-05-03-001-feat-unified-scoreboard-plan.md (Unit 1
 *   Key Decision: "displayHints as a sibling field on CalculatorBase").
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
// Display hints — schema-derived markers the scoreboard renders
// ============================================================================

/**
 * Per-param display-hint declaration. Attached to a calculator's params via the
 * `displayHints` field on `CalculatorBase`. Tells the scoreboard "this param
 * represents a `role` (e.g. milestone marker); please render it according to
 * that role's renderer."
 *
 * `role` is an open enum (`string`) so future calculators can introduce new
 * roles without breaking existing types. The scoreboard recognizes a known set
 * (e.g. `'milestone'`) and falls back to a generic "label + value" rendering
 * for unknown roles — never crashes on an unrecognized role string.
 *
 * `label` is optional. When omitted, the scoreboard derives a default label
 * from the param key. Provide it when the param key alone wouldn't read well
 * to a player (e.g. `multiplier_at_tie` → "1.5x at tie").
 *
 * @example
 *   // accumulate_with_milestone_jumps declares its multiplier_at_tie param
 *   // is a milestone marker:
 *   displayHints: {
 *     multiplier_at_tie: { role: 'milestone', label: '1.5x at tie' },
 *   }
 */
export interface ParamDisplayHint {
  /**
   * Open-enum role string. Known roles get specialized rendering; unknown
   * roles fall back to a generic "label + value" treatment. Add a new role
   * only when a calculator actually needs one — avoid pre-designing for
   * theoretical calculators.
   */
  role: string;

  /**
   * Optional human-readable label shown alongside the rendered hint. When
   * omitted, the scoreboard derives a label from the param key.
   */
  label?: string;
}

/**
 * Runtime shape the scoreboard receives after resolving display hints against
 * the active calculator's params. The scoreboard renders these without
 * caring whether they came from the schema-derived `displayHints` field or
 * the imperative `getDisplayHints` escape hatch.
 *
 * `value` covers the common cases (number / string / boolean). For weirder
 * shapes a calculator should use the `getDisplayHints` escape hatch and
 * encode the structure into `label` + `value` as a string. Keeps the
 * scoreboard renderer's contract simple.
 */
export interface DisplayHint {
  /** Role from `ParamDisplayHint.role` (or directly from the escape hatch). */
  role: string;

  /** Resolved label (either from `ParamDisplayHint.label` or a derived default). */
  label: string;

  /** The param value being rendered (number is the common case). */
  value: number | string | boolean;

  /**
   * Origin-param key, set when the hint was schema-derived. Unset when the
   * hint came from `getDisplayHints` (since escape-hatch hints aren't tied
   * to a single param). Mostly useful for debugging / dev-mode display.
   */
  paramKey?: string;
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

  /**
   * Optional schema-derived display hints. Maps each (or some) param key to a
   * `ParamDisplayHint` declaring the param's display role. The unified
   * scoreboard reads this to know which params should surface as visual
   * markers (e.g. "1.5x at tie" milestone) and how to render them.
   *
   * **When to use this form:** aggregate calculators with primitive param
   * keys whose values are direct numeric targets the scoreboard can render
   * via a known role. The canonical example is
   * `accumulate_with_milestone_jumps`'s `multiplier_at_tie` param marked
   * `{ role: 'milestone' }`.
   *
   * **When to use `getDisplayHints` instead:** calculators with structural
   * param shapes where `keyof P` doesn't map to per-display-element targets
   * — e.g. `accumulated_per_game` whose `keyof P` is `'winner' | 'loser'`
   * (whole-side configs, not per-field markers). Those calculators leave
   * `displayHints` undefined and use the escape hatch instead.
   *
   * Calculators that have no visual markers worth declaring leave both
   * fields undefined; the scoreboard renders nothing extra (no crash).
   */
  displayHints?: { [K in keyof P]?: ParamDisplayHint };

  /**
   * Optional escape hatch: returns 0+ runtime `DisplayHint` objects derived
   * from the calculator's current `params`. Use this when:
   *   - The calculator's param shape doesn't fit `displayHints`'s
   *     `Record<keyof P, ...>` mold (e.g. `accumulated_per_game`).
   *   - The hint needs values computed from multiple params (rare).
   *   - The hint needs a transformed label or non-primitive value the
   *     schema-derived path can't express cleanly.
   *
   * The default behavior is schema-derived (`displayHints`). Only use this
   * when the schema-derived path is genuinely insufficient. The scoreboard
   * prefers `getDisplayHints` output when both forms are present, but most
   * calculators should pick one or the other (not both).
   */
  getDisplayHints?: (params: P) => DisplayHint[];
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
