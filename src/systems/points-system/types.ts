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
 * Which side a Threshold's output represents.
 *
 * - `'home'` — value is specifically for the home side (e.g., chart_lookup
 *   with args.side='home' produces a home win target)
 * - `'away'` — value is specifically for the away side
 * - `'shared'` — value applies equally to either side (league-wide constants
 *   like `read_pref`'s output of `games_to_win`; both sides reach the same
 *   number)
 *
 * Compatibility (for trigger ↔ threshold binding): `'shared'` is a wildcard
 * — a `'shared'` threshold can feed a `'home'`/`'away'`/`'shared'` trigger,
 * and vice versa. Same-side matches always work. Cross-side (`'home'`
 * threshold into `'away'` trigger) is a composition error.
 */
export type ThresholdOutputSide = 'home' | 'away' | 'shared';

/**
 * Bounds on the numeric value a Threshold's output can take. The min/max
 * sides may be:
 *
 * - A concrete number (e.g., `0`, `7`)
 * - `'games_in_match'` — the bound is the match's total game count from
 *   Team Geometry (resolved per-match at runtime)
 * - `'unbounded'` — no upper or lower limit
 *
 * Range is informational on the row + trigger inputSpec; composition-build
 * validation enforces type and side strictly but treats range as a contract
 * for future strict checks once Team Geometry context is available at build
 * time.
 */
export interface ThresholdOutputRange {
  readonly min: number | 'unbounded';
  readonly max: number | 'games_in_match' | 'unbounded';
}

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

  /** Which side the output represents. DERIVED from operation (may depend on args). */
  readonly outputSide: ThresholdOutputSide;

  /** Bounds on the output value. DERIVED from operation (may depend on args). */
  readonly outputRange: ThresholdOutputRange;

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
 *
 * **Output declarations may be constants OR functions of args.** When an
 * operation's output side/range depends on its args (e.g., `chart_lookup_3v3`
 * with `args.side` parameter produces a home- or away-side value), declare
 * a function `(args) => value`. For static operations, declare the constant.
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
   * Which side the output represents. Constant if static; function of args
   * if arg-dependent (e.g., chart_lookup operations parametrized by side).
   */
  readonly producesOutputSide:
    | ThresholdOutputSide
    | ((args: Readonly<Record<string, unknown>>) => ThresholdOutputSide);

  /**
   * Bounds on the output value. Constant if static; function of args if
   * arg-dependent.
   */
  readonly producesOutputRange:
    | ThresholdOutputRange
    | ((args: Readonly<Record<string, unknown>>) => ThresholdOutputRange);

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


// ============================================================================
// Per-game allocator — sub-mechanism (A)
// ============================================================================

/**
 * Numeric range with a UI prompt label. Used as the `base` of a side that
 * collects scorer input each game (e.g., Fargo 10-Point's loser side accepts
 * `{ min: 0, max: 7, label: 'Balls pocketed' }`). The presence of this shape
 * (vs. a plain `number`) is itself the signal that a scorer input is needed
 * — no separate `input: boolean` flag.
 */
export interface SideInputRange {
  readonly min: number;
  readonly max: number;
  readonly label: string;
}

/**
 * Mechanism-internal context exposed to allocator-formula operations.
 *
 * **`ctx` is mechanism-internal ONLY.** It carries the per-game role values
 * that exist only inside this allocator's invocation:
 * - `winner` / `loser` — the resolved values for the winner/loser of THIS game
 *   (for a fixed-base side, the base value; for a range side, the scorer's
 *   input; after both sides are resolved, both are available to a formula)
 * - `thisSide` — which side ('winner' | 'loser') this formula is computing for
 *
 * **State variables are NOT in ctx.** Match-level cumulative state
 * (`home_wins`, `total_games`, `games_played`, etc.) is read directly from
 * the state bag passed alongside ctx — same access pattern as triggers.
 *
 * @see ./allocator-formula-registry.ts — operations consuming this context
 */
export interface FormulaContext {
  readonly winner: number;
  readonly loser: number;
  readonly thisSide: 'winner' | 'loser';
}

/**
 * Reference to a registered allocator-formula operation. Same data-driven
 * pattern as ThresholdRow's operationKind + operationArgs.
 */
export interface AllocatorFormulaRef {
  readonly operationKind: string;
  readonly operationArgs: Readonly<Record<string, unknown>>;
}

/**
 * Per-side allocator config — the locked discriminated-union shape.
 *
 * **Two fields, always:**
 * - `base` is either a `number` (fixed value, no scorer input) OR a
 *   `SideInputRange` (range requiring scorer input). The shape itself signals
 *   whether an input is needed — no separate `input: boolean` flag.
 * - `formula` is optional (`null` when no transformation needed). When
 *   non-null, the registered operation transforms the resolved base/input
 *   value using `ctx` and the state bag.
 *
 * **Scenarios:**
 * - Fixed value: `{ base: 10, formula: null }` (Fargo winner)
 * - Scorer input: `{ base: { min: 0, max: 7, label: 'Balls pocketed' }, formula: null }` (Fargo loser)
 * - Anchor + formula: `{ base: 10, formula: { operationKind: 'add_complement_of_other_side', operationArgs: { max: 7, other_side: 'loser' } } }` (17-Pt winner)
 * - State-driven: `{ base: 0, formula: { operationKind: 'state_diff_times_constant', operationArgs: { ... } } }` (behind-boost)
 */
export interface SideConfig {
  readonly base: number | SideInputRange;
  readonly formula: AllocatorFormulaRef | null;
}

/**
 * A per-game allocator. Independent configs for the winner-side and
 * loser-side of each game. The runtime resolves each side's value per
 * game (handling base + optional formula) and adds the result to the
 * respective team's running points total.
 */
export interface PerGameAllocator {
  readonly name: string;
  readonly winner: SideConfig;
  readonly loser: SideConfig;
}

/**
 * Code-side registry entry for a named allocator-formula operation. Parallel
 * to ThresholdOperation but with a different signature — allocator-formula
 * operations consume mechanism-internal `ctx` plus the match-state bag, not
 * `ThresholdInputs`.
 *
 * @see ./allocator-formula-registry.ts — registry implementation
 */
export interface AllocatorFormulaOperation {
  /** Name used as the key in the registry; SideConfig.formula references this. */
  readonly name: string;

  /**
   * Pure compute function. Takes the operation's args, the mechanism-internal
   * ctx (winner/loser/thisSide for THIS game), and the cumulative state bag
   * (read-only — formulas don't mutate state). Returns a number.
   */
  readonly compute: (
    args: Readonly<Record<string, unknown>>,
    ctx: FormulaContext,
    state: Readonly<MatchStateBag>,
  ) => number;
}

// ============================================================================
// WhenCondition — firing-semantics primitive
// ============================================================================

/**
 * A firing condition. Each kind encodes a different "when does this fire?"
 * semantic. Conditions reference the trigger's bound input value `n`
 * (resolved from `Trigger.input.thresholdRef` at evaluation time) — they
 * never name a threshold themselves.
 *
 * Kinds:
 * - `receipt` — fires immediately at match start. Typical use: receipt-style
 *   triggers that read `n` and write it to a named variable.
 * - `side_reaches` — fires when the named side won the current game AND its
 *   `sideVar` value equals `n`. Concrete side (no 'any' shorthand); concrete
 *   var name (no template substitution). To handle home and away symmetrically,
 *   declare TWO triggers (one per side).
 * - `all_sides_reach` — fires when both home and away vars equal `n` at the
 *   same time. Both var names are concrete.
 * - `total_games_played` — fires after the N-th game (regardless of winner);
 *   N comes from the trigger's bound input.
 * - `match_end` — fires once after all games are played.
 */
export type WhenCondition =
  | { kind: 'receipt' }
  | {
      kind: 'side_reaches';
      side: 'home' | 'away';
      /** Concrete state-bag variable name (e.g., `'home_wins'`). */
      sideVar: string;
    }
  | {
      kind: 'all_sides_reach';
      homeVar: string;
      awayVar: string;
    }
  | { kind: 'total_games_played' }
  | { kind: 'match_end' };

// ============================================================================
// Action — uniform `{ target, op, value }` shape
// ============================================================================

/**
 * Value source for an action's payload.
 *
 * - `literal` — a constant baked into THIS trigger (e.g., `1.5` for a milestone
 *   bonus, `'home'` for an edge marker, `true` for endmatch). LO-editable as a
 *   property of the trigger row.
 * - `input_ref` — the trigger's bound input value (`n`), resolved from
 *   `Trigger.input.thresholdRef` at evaluation time.
 * - `variable_ref` — the current value of another named variable in the
 *   match-state bag.
 *
 * No "threshold_ref" — the trigger has exactly one input (its `Trigger.input`).
 * No "triggering_side" — triggers are per-side (declare separate triggers for
 * home and away), so the side is concrete in `target.variableName`.
 */
export type ActionValue =
  | { kind: 'literal'; value: MatchStateValue }
  | { kind: 'input_ref' }
  | { kind: 'variable_ref'; variableName: string };

/**
 * The action's target variable is always a concrete name. No side-scoped
 * templates — triggers are per-side, so the target is concrete per trigger
 * (e.g., `'home_points'` for the home milestone bonus, `'away_points'` for
 * the away one).
 */
export interface ActionTarget {
  readonly kind: 'concrete';
  readonly variableName: string;
}

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
 * Reference to the threshold whose resolved value feeds the trigger as `n`.
 * Optional — `receipt`/`match_end` triggers MAY omit input if they don't
 * read a threshold value. All other kinds require it.
 */
export interface TriggerInput {
  readonly thresholdRef: string;
}

/**
 * Trigger input safety contract — what shape of threshold the trigger expects.
 * Composition-build validation compares this against the bound threshold's
 * output declarations; mismatch is a composition error caught at build time
 * instead of producing wrong runtime values.
 *
 * **Type and side are enforced strictly.** Range is informational pending
 * Team Geometry context at build time (the `'games_in_match'` sentinel
 * resolves per-match at runtime, not at composition build).
 *
 * Optional — triggers without input (`receipt`/`match_end` only) omit this.
 */
export interface TriggerInputSpec {
  readonly outputType: ThresholdOutputType;
  readonly outputSide: ThresholdOutputSide;
  /** Informational; not strictly validated yet. */
  readonly outputRange?: ThresholdOutputRange;
}

/**
 * A trigger fires when its `when` becomes true and runs its `action`.
 *
 * **Single input, single action.** The trigger reads exactly one threshold
 * value (its `input`); the `when` predicate compares state against `n`; the
 * `action` mutates one variable using `n`, a constant, or another variable.
 * To produce multiple effects on the same firing event, declare multiple
 * triggers with the same `when` — each is one atomic rule.
 *
 * **Terminal triggers halt the cascade.** When a trigger with `terminal: true`
 * fires (typically `endmatch`), subsequent triggers in the array are NOT
 * evaluated for this tick AND the match ends. Composition-build validation
 * enforces terminal triggers appear last in the array.
 */
export interface Trigger {
  readonly name: string;
  /** The threshold the trigger reads as `n`. Optional for receipt/match_end. */
  readonly input?: TriggerInput;
  /** Safety contract on the input's shape. Composition-build validation enforces match. */
  readonly inputSpec?: TriggerInputSpec;
  when: WhenCondition;
  action: Action;
  /** When true, firing this trigger halts further trigger evaluation for the match. */
  readonly terminal?: boolean;
}

// ============================================================================
// End-of-match aggregate — sub-mechanism (D)
// ============================================================================

/**
 * Result of an end-of-match aggregate evaluation. Per-side absolute per-match
 * points; the runtime assigns these to `home_points` and `away_points`
 * (overwriting any per-game accumulation — aggregate-mode is an ALTERNATIVE
 * to per-game accumulation per the locked spec).
 */
export interface AggregateResult {
  homePoints: number;
  awayPoints: number;
}

/**
 * Code-side registry entry for a named aggregate operation. Same data-driven
 * pattern as ThresholdOperation / AllocatorFormulaOperation: the compute
 * logic lives in code; the EndOfMatchAggregate row references it by name + args.
 *
 * The operation reads the match-state bag DIRECTLY (home_wins, away_wins, and
 * the chart-target state vars receipt triggers populated — homeWinTarget,
 * homeTieTarget, etc.). No fixed input shape; the operation reads what it
 * needs by convention. Produces both sides' points in one call so coupled
 * rules (like the 3v3 tie-band: 9-9 → both 0) are expressed naturally.
 *
 * @see ./aggregate-registry.ts — registry implementation
 */
export interface AggregateOperation {
  readonly name: string;
  readonly compute: (
    args: Readonly<Record<string, unknown>>,
    state: Readonly<MatchStateBag>,
  ) => AggregateResult;
}

/**
 * End-of-match aggregate — data-driven row. References a registered aggregate
 * operation by name + args. The locked 3v3 9-9 tie-band absorption invariant
 * lives inside the operation's compute (fixed in code, not in args).
 */
export interface EndOfMatchAggregate {
  readonly operationKind: string;
  readonly operationArgs: Readonly<Record<string, unknown>>;
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
   * Named map of thresholds. Each value is a data-shaped `ThresholdRow`
   * that references a registered operation kind + args. The runtime
   * resolves each row to its number/null value at match start.
   */
  thresholds: Record<string, ThresholdRow>;
  perGameAllocator?: PerGameAllocator;
  triggers: readonly Trigger[];
  endOfMatchAggregate?: EndOfMatchAggregate;
}
