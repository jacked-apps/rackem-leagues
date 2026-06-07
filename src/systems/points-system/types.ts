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
 * **Four primitive kinds:**
 *
 * 1. **Threshold** — a pure function `(inputs) → number`. No firing logic,
 *    no side attribution, just math. Same architectural shape as the
 *    Threshold Charts Module. Used as a value-source by triggers.
 *
 * 2. **PerGameAllocator** — per-side configs (`fixed` | `counter` | `formula`)
 *    that allocate points each game (winner gets X, loser gets Y). Formula
 *    shape receives a rich context bag (per-game role values + cumulative
 *    match-state) and returns a number.
 *
 * 3. **Trigger** — state-in/state-out rule `{ name, type, condition, action,
 *    rearm, order }`. `type` (`match_start | match_end | anytime`) selects the
 *    firing phase; `condition` is a flat comparison (or `always`) over the
 *    state bag; `action` writes ONE named variable (either an arithmetic
 *    `Expression` or a literal `set`); `rearm` controls re-firing; `order`
 *    sequences firing (and partitions `anytime` triggers around the allocator).
 *
 * 4. **Condition / Expression** — the trigger's two halves. A `Condition` is a
 *    pure boolean check (no math); an `Expression` is the action's arithmetic.
 *    Both are evaluated by never-throw evaluators (`condition-evaluator.ts`,
 *    `expression-evaluator.ts`).
 *
 * End-of-match scoring (e.g. Points 3-Man) is NOT a separate primitive — it's
 * just `match_end` triggers (two per side reproduce the three-band linear
 * formula; the tie band is the default-0).
 *
 * **Composition structure (D2b structured slots):**
 *
 * A `PointsSystem` is a record with named slots:
 * - `thresholds` — named map of value-producing functions
 * - `perGameAllocator` — optional; the per-game linear baseline
 * - `triggers` — ordered list of `{ type, condition, action, rearm, order }` rules
 *
 * **Single-mechanism-for-everything principle:** every value the system
 * tracks (chart targets, initial points, milestone jumps, win signals,
 * running totals, chips, flags) gets assigned via the SAME trigger
 * machinery into the unified named-variable namespace. Different
 * consumers (display, Win Calc) read from the same variables. No drift possible.
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
  /**
   * Sum of the home lineup's handicaps (including any team bonus the
   * caller folded in). Written into the state bag at match start as
   * `home_team_handicap` so allocator formulas can reference the team
   * total. Optional — when absent the var defaults to 0.
   */
  homeTeamHandicap?: number;
  /** Sum of the away lineup's handicaps. See `homeTeamHandicap`. */
  awayTeamHandicap?: number;
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
 * Range is informational on the row; it's a contract for future strict checks
 * once Team Geometry context is available at build time.
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
  /**
   * Which actual team (home/away) won THIS game. Combined with `thisSide`
   * it tells a side-agnostic recipe whether "this side" maps to the home
   * team or the away team for state-bag reads. Needed for the workshop's
   * side-agnostic available data (e.g., "This Side's Wins So Far" must
   * resolve to home_wins when computing the winner side of a home-won
   * game, or away_wins when computing the winner side of an away-won
   * game).
   */
  readonly winnerSide: 'home' | 'away';
  /**
   * Locked handicap of the player who won THIS game (frozen at match
   * start via `match_lineups`). Optional because some callers (synthetic
   * inputs in the save-time guard / apply-time preview, older
   * snapshots) don't carry per-player position info. When absent, the
   * `this_side_handicap` / `other_side_handicap` virtual names fall back
   * to 0 with a console.warn.
   */
  readonly winnerHandicap?: number | null;
  /** Locked handicap of the player who lost THIS game. See `winnerHandicap`. */
  readonly loserHandicap?: number | null;
  /**
   * Lineup positions (1-5) of the home + away players who played THIS
   * game. Used by `evaluate_expression` to resolve `this_side_player_wins`
   * and `this_side_player_points` to the correct per-position state-bag
   * entry. Optional — when absent the player-counter virtuals fall back
   * to 0.
   */
  readonly homePosition?: number | null;
  readonly awayPosition?: number | null;
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
   * Declarative shape of `operationArgs` this operation expects.
   *
   * Drives two things:
   *   1. **Validator hardening (Unit 3).** `validatePerGameAllocator` runs
   *      the row's `operationArgs` through this shape. Missing required args
   *      and type mismatches are rejected at load time (the room's read-time
   *      guard) instead of throwing at compute time during a real match.
   *   2. **Workshop UI (Unit 6).** The editor renders an input per declared
   *      arg, typed by `kind`. New operations get UI support for free as
   *      long as their args use already-supported kinds.
   *
   * Optional for forward-compat: operations registered before Unit 3 may
   * omit it; in that case the validator only checks that the operation
   * name resolves (legacy behavior).
   */
  readonly argsShape?: Readonly<Record<string, ArgSpec>>;

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

/**
 * Argument kind — what shape of value the workshop accepts for this arg and
 * the validator checks against the stored value.
 *
 * - `'number'`          — a finite numeric value (e.g. the 7 in `17 − loser`).
 * - `'state_var_name'`  — a string naming a state-bag variable to read
 *                          (e.g. `'pointsPerGame'`). The validator only
 *                          checks the string type; whether the bag actually
 *                          has that name is a runtime concern (open namespace
 *                          per [[feedback_state_bag_starts_empty]]).
 * - `'side_name'`       — exactly `'winner'` or `'loser'` (e.g. the
 *                          `other_side` arg in `add_complement_of_other_side`).
 *
 * New kinds can be added as new operations need them. The validator's
 * coverage extends automatically.
 */
export type ArgKind = 'number' | 'state_var_name' | 'side_name';

/**
 * One arg entry in an operation's `argsShape`.
 */
export interface ArgSpec {
  readonly kind: ArgKind;
  readonly required: boolean;
}

// ============================================================================
// Expression — trigger ACTION arithmetic (state-in/number-out)
// ============================================================================

/**
 * A flat arithmetic expression, stored as serializable data (a tree). This is
 * the home of the `Expression` type; the action-side evaluator
 * (`./expression-evaluator.ts`) re-exports it for back-compat consumers.
 *
 * - `const` — a literal number (e.g., `1.5`, `0`).
 * - `var` — reads a named value off the state bag (e.g., `home_wins`, `winTarget`).
 * - `op` — a binary operation; operands are themselves expressions, so nesting
 *   expresses parentheses (e.g., `(home_wins − winTarget) × multiplier`).
 *
 * @see ./expression-evaluator.ts — the never-throw evaluator
 */
export type Expression =
  | { readonly kind: 'const'; readonly value: number }
  | { readonly kind: 'var'; readonly name: string }
  | {
      readonly kind: 'op';
      readonly op: '+' | '-' | '*' | '/';
      readonly left: Expression;
      readonly right: Expression;
    };

// ============================================================================
// Condition — trigger CONDITION (the "if" check, no math)
// ============================================================================

/**
 * A condition operand: a constant or a state-variable read. NOT an arithmetic
 * expression — conditions never compute (that's the ACTION's job). Home of the
 * `ConditionOperand` type; `./condition-evaluator.ts` re-exports it.
 */
export type ConditionOperand =
  | { readonly kind: 'const'; readonly value: number }
  | { readonly kind: 'var'; readonly name: string };

/**
 * A trigger's firing condition. Home of the `Condition` type;
 * `./condition-evaluator.ts` re-exports it.
 *
 * - `always` — always true (pass-through triggers, e.g. initial points).
 * - `compare` — one flat comparison between two operands.
 *
 * @see ./condition-evaluator.ts — the never-throw evaluator
 */
export type Condition =
  | { readonly kind: 'always' }
  | {
      readonly kind: 'compare';
      readonly left: ConditionOperand;
      readonly op: '==' | '>' | '<' | '>=' | '<=';
      readonly right: ConditionOperand;
    };

// ============================================================================
// Trigger — state-in/state-out rule (condition + action)
// ============================================================================

/**
 * When a trigger fires. The runtime drives firing phases by this:
 * - `match_start` — fires once at match start, after thresholds resolve.
 * - `match_end` — fires once after all games are played.
 * - `anytime` — fires during the per-game phase, partitioned around the
 *   per-game allocator by `order.beforeAllocator`.
 */
export type TriggerType = 'match_start' | 'match_end' | 'anytime';

/**
 * Re-arm policy — controls whether a trigger can fire more than once.
 * - `single_shot` — fires at most once per match.
 * - `periodic` — may fire every time its condition holds.
 * - `manual` — treated like `single_shot` for now (explicit reset is future).
 */
export type ReArm = 'single_shot' | 'periodic' | 'manual';

/** Fire-order. number = within-group order (ascending). beforeAllocator only
 *  meaningful for `anytime` triggers (moot for match_start/match_end). */
export interface TriggerOrder { readonly number: number; readonly beforeAllocator: boolean; }

/** ACTION writes ONE state var. `expr` = arithmetic (numeric). `set` = a literal
 *  string/bool/number written directly (e.g. edge='home', endmatch=true). */
export type TriggerAction = {
  readonly target: string;
  readonly value:
    | { readonly kind: 'expr'; readonly expr: Expression }
    | { readonly kind: 'set'; readonly value: MatchStateValue };
};

/**
 * A trigger: a state-in/state-out rule. When its `condition` holds (subject to
 * its `rearm` policy), its `action` writes exactly one state variable. Triggers
 * never throw — the runtime logs and skips on any evaluator failure.
 */
export interface Trigger {
  readonly name: string;
  readonly type: TriggerType;
  readonly condition: Condition;
  readonly action: TriggerAction;
  readonly rearm: ReArm;
  readonly order: TriggerOrder;
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
 *   Omitted by Scoring Systems that score only at match end (via match_end triggers).
 * - `triggers` — list of single-action triggers. Firing order within a phase
 *   is driven by `trigger.order.number` (and partitioned around the per-game
 *   allocator by `trigger.order.beforeAllocator` for `anytime` triggers).
 *   End-of-match scoring is just `match_end` triggers — there is no separate
 *   aggregate slot.
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
}
