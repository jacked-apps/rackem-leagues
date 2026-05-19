/**
 * @fileoverview Points System Module — type definitions for the composable primitives.
 *
 * Per the locked Points System README and the Ed-walked decomposition in
 * `docs/brainstorms/2026-05-18-points-system-decomposition-requirements.md`,
 * a Points System is a COMPOSITION of small single-purpose primitives that
 * combine to produce per-team match-total points. The decomposition replaces
 * the existing bundled calculators (`linear_above_threshold`,
 * `accumulate_with_milestone_jumps`, `accumulated_per_game`) which packed
 * multiple primitive kinds into single classes.
 *
 * **Five primitive kinds:**
 *
 * 1. **Threshold** — a pure function `(inputs) → number`. No firing logic,
 *    no side attribution, just math. Same architectural shape as the
 *    Threshold Charts Module. Used as a value-source by triggers and the
 *    end-of-match aggregate.
 *
 * 2. **PerGameAllocator** — per-side configs (`fixed` | `counter` | `formula`)
 *    that allocate points each game (winner gets X, loser gets Y). Formula
 *    shape receives a rich context bag (per-game role values + cumulative
 *    match-state) and returns a number.
 *
 * 3. **WhenCondition** — firing-semantics primitive. Kinds include
 *    `receipt` (fires immediately at match start), `side_reaches`,
 *    `all_sides_reach`, `total_games_played`, etc. Each kind may reference
 *    thresholds as comparison values.
 *
 * 4. **Action** — uniform `{ target, op, value }` shape. NO action categories.
 *    Target is a named variable in the system's mutable-state namespace;
 *    op is `assign | add | multiply`; value is a constant, threshold ref,
 *    or expression.
 *
 * 5. **EndOfMatchAggregate** — computes per-match points at match end.
 *    Reads named variables populated by triggers (homeWins/homeWinTarget/etc.)
 *    and applies its formula, including the locked tie-band absorption
 *    invariant. Stays a distinct primitive because it has a clear
 *    single-fire-at-end role.
 *
 * **Composition structure (D2b structured slots):**
 *
 * A `PointsSystem` is a record with named slots:
 * - `thresholds` — named map of value-producing functions
 * - `perGameAllocator` — optional; the per-game linear baseline
 * - `triggers` — ordered list of `{ when, action }` pairs (single-action)
 * - `endOfMatchAggregate` — optional; reads variables and applies formula
 *
 * **Single-mechanism-for-everything principle:** every value the system
 * tracks (chart targets, initial points, milestone jumps, win signals,
 * running totals, chips, flags) gets assigned via the SAME trigger
 * machinery into the unified named-variable namespace. Different
 * consumers (display, end-of-match aggregate, Win Calc) read from the
 * same variables. No drift possible.
 *
 * @see docs/brainstorms/2026-05-18-points-system-decomposition-requirements.md — design walkthrough
 * @see docs/league-system/modules/points-system/README.md — locked blueprint
 */

// ============================================================================
// Mutable-state namespace
// ============================================================================

/**
 * The match-state variable bag the runtime maintains during evaluation.
 * Every named variable any trigger might write to or read from lives here.
 *
 * Variable naming convention: snake_case for stable variables, with side
 * prefixes (`home_`, `away_`) where applicable. Stored as `Record<string, MatchStateValue>`
 * because the namespace is open — new triggers can introduce new variable
 * names as the system grows.
 */
export type MatchStateValue = number | boolean | string | null;
export type MatchStateBag = Record<string, MatchStateValue>;

// ============================================================================
// Threshold — pure value-producing primitive
// ============================================================================

/**
 * Inputs available to a threshold's compute. Phase A includes the minimum
 * needed for the 3 prepackaged systems' thresholds:
 *
 * - `homeRatings` / `awayRatings` — lineup rating values per side (for Fargo
 *   start-points formula, BCAPL handicap-diff lookups, etc.)
 * - `homeHandicapDiff` / `awayHandicapDiff` — pre-computed handicap difference
 *   per side (positive = stronger; negative = weaker)
 * - `gameCount` — total games in the match (from Team Geometry)
 * - `prefs` — open record of league preferences a threshold might consult
 *   (`games_to_win`, `milestone_percent`, etc.)
 *
 * Future thresholds can reference additional inputs by extending this type.
 */
export interface ThresholdInputs {
  homeRatings: readonly number[];
  awayRatings: readonly number[];
  homeHandicapDiff: number;
  awayHandicapDiff: number;
  gameCount: number;
  prefs: Record<string, unknown>;
}

// ============================================================================
// Threshold — data-driven shape per the Ed-walked refactor (2026-05-19)
// ============================================================================

/**
 * Handicap encoding a Threshold operation consumes. Mirrors the existing
 * `handicap_type` preference values, plus `'none'` for operations that
 * don't consume handicap inputs (e.g., reading a constant from prefs).
 */
export type HandicapTypeRequirement =
  | 'fargo'
  | 'points'
  | 'percentage'
  | 'skill_level'
  | 'none';

/**
 * Shape of the input population a Threshold operation expects.
 *
 * - `lineup_sizes`: expects team arrays of one of the listed sizes; `'any'`
 *   means "size-agnostic" (formula-style operations that scale with
 *   `game_count`).
 * - `single`: expects a single handicap (per-pairing operations).
 * - `none`: doesn't consume team/individual-shape inputs (e.g., reads from
 *   prefs only).
 */
export type SizeRequirement =
  | { readonly kind: 'lineup_sizes'; readonly sizes: readonly number[] | 'any' }
  | { readonly kind: 'single' }
  | { readonly kind: 'none' };

/**
 * Output category a Threshold produces. Maps to the locked Handicap Mechanisms
 * 2x2 taxonomy plus `'numeric'` for thresholds that produce generic LO-tunable
 * values (jump targets, multipliers, milestone-trigger comparison values, etc.)
 * rather than handicap-shape outputs.
 */
export type ThresholdOutputType =
  | 'game_target'
  | 'points_target'
  | 'game_headstart'
  | 'points_headstart'
  | 'numeric';

/**
 * Data-shaped Threshold per the Ed-walked refactor. A row's worth of
 * information — names an operation kind from a code-side registry and
 * supplies args. Exposes its expected inputs + output type at the top level
 * (DERIVED from the operation's registry entry at write time) so consumers
 * never have to "dig" through the operation to see what it needs.
 *
 * Replaces the legacy `Threshold` interface that bundled a `(inputs) => number`
 * compute function inline (incompatible with future DB-row loading).
 *
 * @see ./threshold-registry.ts — the operation registry
 * @see ./threshold-resolver.ts — runtime evaluator
 */
export interface ThresholdRow {
  /** Stable identifier (also serves as DB-row primary key when persisted). */
  readonly name: string;

  /** Scope of the row (global / org / league) — for the eventual DB cascade. */
  readonly scope?: 'global' | 'org' | 'league';

  /**
   * Handicap encoding this threshold consumes from the league. DERIVED from
   * the operation's `consumesHandicapType`; validated at row construction.
   * Exposing it on the row lets consumers filter compatibility without
   * looking up the operation.
   */
  readonly expectedHandicapType: HandicapTypeRequirement;

  /** Shape of the input population. DERIVED from operation. */
  readonly expectedSize: SizeRequirement;

  /** Output category this threshold produces. DERIVED from operation. */
  readonly outputType: ThresholdOutputType;

  /** Names a `ThresholdOperation` registered in the operation registry. */
  readonly operationKind: string;

  /**
   * Operation-specific args. Holds values that aren't otherwise derivable
   * from match context — chart refs, pref keys, aggregation-method choices,
   * etc. Match-context values (`game_count`, `lineup_size`, ratings) come
   * from runtime inputs at evaluation time, never from stored args.
   */
  readonly operationArgs: Readonly<Record<string, unknown>>;
}

/**
 * Code-side registry entry describing a named Threshold operation. The
 * registry is the source of truth for what each `operationKind` consumes
 * and produces; threshold rows reference operations by name and the
 * registry resolves them at evaluation time.
 */
export interface ThresholdOperation {
  /** Name used as the key in the operation registry; threshold rows reference this. */
  readonly name: string;

  /** What handicap encoding this operation requires from the league. */
  readonly consumesHandicapType: HandicapTypeRequirement;

  /** Input population shape this operation handles. */
  readonly consumesSize: SizeRequirement;

  /** Output category this operation produces. */
  readonly producesOutputType: ThresholdOutputType;

  /**
   * Pure compute function. Takes the threshold row's `operationArgs` plus
   * the runtime `ThresholdInputs`, produces a number (or `null` for "no
   * value applies" — e.g., a tie target on a chart that doesn't permit
   * ties at the given handicap diff).
   */
  readonly compute: (
    args: Readonly<Record<string, unknown>>,
    inputs: ThresholdInputs,
  ) => number | null;
}

/**
 * Legacy Threshold interface — function-valued compute, inline values.
 * Kept temporarily so existing compositions still type-check during the
 * incremental migration to `ThresholdRow`. After all three prepackaged
 * compositions migrate (slices 2-4 of the refactor), this gets deleted
 * in slice 5.
 *
 * @deprecated migrate to ThresholdRow + ThresholdOperation registry.
 */
export interface Threshold {
  readonly name: string;
  compute: (inputs: ThresholdInputs) => number | null;
}

// ============================================================================
// Per-game allocator — sub-mechanism (A)
// ============================================================================

/**
 * Formula context for a per-side `formula` allocator config. Spans both
 * per-game role data and cumulative match-state.
 *
 * - `winner` / `loser` — the resolved values for the winning and losing side
 *   of the CURRENT game. For a fixed side, the value is its base. For a
 *   counter side, the value is the per-game input. (Formula sides can't
 *   reference each other to avoid circular evaluation.)
 * - `thisSide` — which team this formula is being evaluated FOR ('home' | 'away')
 * - `home` / `away` — cumulative match-state BEFORE this game (wins, points)
 *
 * Future context fields can be added without breaking existing formulas.
 */
export interface FormulaContext {
  winner: number;
  loser: number;
  thisSide: 'home' | 'away';
  home: { wins: number; points: number };
  away: { wins: number; points: number };
}

/**
 * Per-side allocator config — one of three shapes per the locked spec.
 *
 * - `fixed` — a constant points value, no scorer input collected
 * - `counter` — a numeric range; scorer enters the actual value per game
 * - `formula` — derived via `(FormulaContext) → number`; `base` is the
 *   configurable constant the formula's context exposes as `ctx.winner`
 *   or `ctx.loser` (depending on which side this is)
 */
export type SideConfig =
  | { kind: 'fixed'; points: number }
  | { kind: 'counter'; min: number; max: number; label: string }
  | {
      kind: 'formula';
      /** The configurable constant; appears in formula as ctx.winner or ctx.loser depending on side. */
      base: number;
      formula: (ctx: FormulaContext) => number;
    };

/**
 * A per-game allocator. Independent configs for the winner-side and
 * loser-side of each game. The runtime resolves each side's value per
 * game (handling fixed/counter/formula) and adds the result to the
 * respective team's running points total.
 */
export interface PerGameAllocator {
  readonly name: string;
  winner: SideConfig;
  loser: SideConfig;
}

// ============================================================================
// WhenCondition — firing-semantics primitive
// ============================================================================

/**
 * A firing condition. Each kind encodes a different "when does this fire?"
 * semantic. Kinds reference thresholds by name; the runtime resolves the
 * threshold value at match start and uses it as a comparison value.
 *
 * Kinds:
 * - `receipt` — fires immediately at match start when its referenced threshold's
 *   value is computed. Used for initial points and chart-value assignment.
 * - `side_reaches` — fires when the given side's tracked variable reaches
 *   the threshold value. The `side` may be `'any'` to fire for whichever
 *   side hits first (per-side; fires once per side reaching the value).
 * - `all_sides_reach` — fires when ALL sides simultaneously hit the threshold.
 *   Used for things like "both sides at tie value at the same time."
 * - `total_games_played` — fires after the N-th game has been played
 *   (regardless of who won). The threshold provides N.
 * - `match_end` — fires once after all games are played.
 */
export type WhenCondition =
  | { kind: 'receipt'; thresholdRef: string }
  | {
      kind: 'side_reaches';
      thresholdRef: string;
      side: 'home' | 'away' | 'any';
      /** Which tracked variable to compare against the threshold (typically `home_wins` / `away_wins`). */
      sideVarTemplate: string;
    }
  | {
      kind: 'all_sides_reach';
      thresholdRef: string;
      /** Per-side variable name template (the runtime substitutes the side prefix). */
      sideVarTemplate: string;
    }
  | { kind: 'total_games_played'; thresholdRef: string }
  | { kind: 'match_end' };

// ============================================================================
// Action — uniform `{ target, op, value }` shape
// ============================================================================

/**
 * Value source for an action's payload. Either a literal constant, a
 * reference to a threshold by name, or a reference to a named variable.
 * Phase A keeps this simple; expression evaluation (combining multiple
 * variables / arithmetic) is a future extension.
 *
 * For triggers that reference the side that caused the firing (e.g., the
 * side whose wins crossed the milestone), `kind: 'triggering_side'`
 * resolves to a string literal `'home' | 'away'` at evaluation time.
 */
export type ActionValue =
  | { kind: 'literal'; value: MatchStateValue }
  | { kind: 'threshold_ref'; thresholdRef: string }
  | { kind: 'variable_ref'; variableName: string }
  | { kind: 'triggering_side' };

/**
 * Resolution strategy for the action's target variable name. Either a
 * concrete name (e.g., `home_points`) or a per-side template (e.g.,
 * `<side>_points`) that resolves against the side that triggered the
 * action.
 */
export type ActionTarget =
  | { kind: 'concrete'; variableName: string }
  | { kind: 'side_scoped'; variableNameTemplate: string };

/**
 * The uniform Action shape. NO action categories — every action is an
 * assignment to a named variable using one of three ops.
 */
export interface Action {
  target: ActionTarget;
  op: 'assign' | 'add' | 'multiply';
  value: ActionValue;
}

// ============================================================================
// Trigger — single-action declaration pairing a when-condition with an action
// ============================================================================

/**
 * A trigger fires when its `when` becomes true and runs its `action`. Single
 * action per trigger (compose multiple triggers with the same `when` if you
 * need multiple effects on the same firing event).
 */
export interface Trigger {
  readonly name: string;
  when: WhenCondition;
  action: Action;
}

// ============================================================================
// End-of-match aggregate — sub-mechanism (D)
// ============================================================================

/**
 * Aggregate-input shape passed to an EndOfMatchAggregate's compute. Bundles
 * the per-side resolved variables the aggregate needs.
 */
export interface AggregateInput {
  homeWins: number;
  awayWins: number;
  homeWinTarget: number;
  awayWinTarget: number;
  homeTieTarget: number | null;
  awayTieTarget: number | null;
  homeLoseTarget: number;
  awayLoseTarget: number;
}

/**
 * Result of an EndOfMatchAggregate evaluation. Per-side absolute per-match
 * points; the runtime assigns these to `home_points` and `away_points`.
 */
export interface AggregateResult {
  homePoints: number;
  awayPoints: number;
}

/**
 * End-of-match aggregate. Reads variables (already populated by triggers
 * at match start + during play) and computes per-match points using its
 * formula. The locked 3v3 9-9 tie-band absorption invariant lives INSIDE
 * the formula for aggregates that have a tie threshold.
 */
export interface EndOfMatchAggregate {
  readonly name: string;
  /** Open-shape params the formula may consume (`multiplier` etc.). */
  params: Record<string, unknown>;
  compute: (input: AggregateInput, params: Record<string, unknown>) => AggregateResult;
}

// ============================================================================
// Composition — the structured-slot PointsSystem record (D2b)
// ============================================================================

/**
 * A complete Points System composition. Each prepackaged Scoring System
 * declares one of these; future LO-customized leagues compose their own.
 *
 * Slot semantics:
 * - `thresholds` — named map; every value-producer the composition needs.
 * - `perGameAllocator` — optional; the linear per-game baseline.
 *   Omitted by Scoring Systems that use only an end-of-match aggregate.
 * - `triggers` — ordered list of single-action triggers. Order matters
 *   for cases where triggers might both fire on the same event (rare).
 * - `endOfMatchAggregate` — optional; the once-at-match-end formula.
 *   Omitted by Scoring Systems that compute totals via per-game accumulation.
 */
export interface PointsSystem {
  readonly name: string;
  /**
   * Named map of thresholds. Accepts either the legacy `Threshold` (function-
   * valued compute, being phased out) or the new `ThresholdRow` (data-shaped,
   * looks up an operation in the registry) during the per-composition
   * migration. After slice 5 lands, only `ThresholdRow` will be accepted.
   */
  thresholds: Record<string, Threshold | ThresholdRow>;
  perGameAllocator?: PerGameAllocator;
  triggers: readonly Trigger[];
  endOfMatchAggregate?: EndOfMatchAggregate;
}
