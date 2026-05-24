/**
 * @fileoverview Win Calculator — the type contract (the judge's I/O + its config).
 *
 * The Win Calculator is a **pure judge**: at match end it reads the final match
 * state plus its own league-operator-assigned config, and returns one verdict —
 * a winning side, or "no winner" (a tie it hands up to the runtime). It
 * allocates no points, ends no match, records nothing. It *decides*.
 *
 * This file defines only the data shapes. Behavior lives in:
 *   - `comparators.ts` — the two per-metric resolvers (`most` / `met_goal`)
 *   - `judge.ts`       — `decideWinner(state, config)`: chip-first → comparators → no-winner
 *   - `configs.ts`     — `buildWinCalcConfig(win_condition)`: the code-defined config
 *
 * Canonical model: `docs/league-system/modules/win-calculator.md`.
 *
 * Workshop note: {@link WinCalcConfig} is the serializable "dial" shape a future
 * non-coder workshop screen will populate (which comparators, each metric's
 * mode, and the order). Today a developer sets it in code (`configs.ts`); the
 * shape is kept plain and serializable so that screen is a later bolt-on, not a
 * rewrite.
 */

/**
 * The Win Calculator's output: a winner, or a tie.
 *
 * A tie is the **absence** of a winner — never a value the judge stores for its
 * own sake. `{ tie: true }` means "no winner could be named"; the scoring
 * runtime then decides what happens next (break it, or let it stand). The
 * `winner` value is `'home'` or `'away'` — never `'tie'`.
 */
export type Verdict = { winner: 'home' | 'away' } | { tie: true };

/**
 * How a single metric is judged.
 *
 * - `'most'`     — the side with the higher total wins; equal totals = "no
 *   decision" (symmetric; head-start handicaps fold their advantage into the
 *   totals, so a raw compare is fair).
 * - `'met_goal'` — each side is measured against its own target; exactly one
 *   side reaching its target wins; neither reaching = "no decision"
 *   (asymmetric; easier-path handicaps put their advantage in the targets).
 */
export type ComparatorMode = 'most' | 'met_goal';

/**
 * The Win Calculator's configuration — its **dials**.
 *
 * There are exactly two comparators: one for games, one for points. Each
 * carries one {@link ComparatorMode}. `order` lists which comparators are
 * enabled and in what order they run; a metric **absent** from `order` is off
 * (the "look at only one" case). The winner-chip override is implicit and always
 * checked first — it is not a dial.
 *
 * This is the serializable shape a future workshop screen fills in. Today it is
 * produced in code by `buildWinCalcConfig` (see `configs.ts`).
 */
export interface WinCalcConfig {
  /** Enabled comparators, in evaluation order. A metric not listed here is off. */
  readonly order: ReadonlyArray<'games' | 'points'>;
  /** The games comparator's mode — present when `'games'` is in `order`. */
  readonly games?: { readonly mode: ComparatorMode };
  /** The points comparator's mode — present when `'points'` is in `order`. */
  readonly points?: { readonly mode: ComparatorMode };
}

/**
 * The slice of shared match state the judge reads.
 *
 * Every value originates in the shared match-state bag (the engine's
 * `MatchStateBag`) or the totals already accumulated by match end. The judge
 * reads **by name** and does not care which module wrote a value.
 *
 * - `*_games` / `*_points` — each side's final totals (used by `most`).
 * - `*_games_target` / `*_points_target` — each side's win-target (used by
 *   `met_goal`); `null` when no target applies. NOTE: points targets have no
 *   source field in code today (see `win-calculator.md` § Current implementation
 *   status), so a points `met_goal` comparator is unbuilt substrate — these will
 *   be `null` until a points-target source is added.
 * - `edge` — the **winner chip**: an affirmative winner written into shared
 *   state (by a clinch trigger, a comparator, or the Tiebreak System). The judge
 *   checks it FIRST as an unconditional override. Absent/`null` when no winner
 *   has been written.
 */
export interface WinCalcState {
  readonly home_games: number;
  readonly away_games: number;
  readonly home_points: number;
  readonly away_points: number;
  readonly home_games_target: number | null;
  readonly away_games_target: number | null;
  readonly home_points_target: number | null;
  readonly away_points_target: number | null;
  /** The winner chip (override): `'home'`/`'away'` if a winner was written; else absent/`null`. */
  readonly edge?: 'home' | 'away' | null;
}
