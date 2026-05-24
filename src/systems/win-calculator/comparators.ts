/**
 * @fileoverview Win Calculator — the two per-metric comparators (pure).
 *
 * Each comparator judges ONE metric (games or points) in ONE mode. They are
 * pure: same inputs → same output, no state, no side effects. The judge
 * (`judge.ts`) dispatches to the right one per the active {@link ComparatorMode}
 * and walks them in the LO's order.
 *
 * A comparator returns a {@link ComparatorOutcome}: either a named winner, or
 * "no decision" — and, when it detects a configuration that can't happen with
 * correct inputs, it attaches an `anomaly` message rather than throwing or
 * guessing. Surfacing (not handling) that anomaly keeps the judge never-break:
 * the caller collects it for the runtime to route; diagnosing whose config is
 * wrong is not this module's job.
 *
 * Canonical model: `docs/league-system/modules/win-calculator.md`
 * (§ "The comparator switch").
 */

/**
 * A comparator's result.
 *
 * - `{ winner: 'home' | 'away' }` — that side is named the winner.
 * - `{ winner: null }` — no decision (e.g. equal totals, or neither side met
 *   its target). A normal, expected outcome.
 * - `{ winner: null, anomaly }` — no decision PLUS an impossible-with-correct-
 *   input condition worth surfacing (e.g. both sides met their target). The
 *   judge logs/collects `anomaly`; it never blocks the verdict.
 */
export type ComparatorOutcome =
  | { readonly winner: 'home' | 'away' }
  | { readonly winner: null; readonly anomaly?: string };

const NO_DECISION: ComparatorOutcome = { winner: null };

/**
 * `most` mode — the side with the higher total wins.
 *
 * Symmetric: a raw compare of the two totals. Equal totals → no decision.
 * (Head-start handicaps fold their advantage into the totals, so comparing the
 * raw numbers is fair.)
 *
 * @param homeVal home side's total for this metric (games or points)
 * @param awayVal away side's total for this metric
 */
export function most(homeVal: number, awayVal: number): ComparatorOutcome {
  if (homeVal === awayVal) return NO_DECISION;
  return { winner: homeVal > awayVal ? 'home' : 'away' };
}

/**
 * `met_goal` mode — each side is measured against its own win-target.
 *
 * Asymmetric: exactly one side reaching its target wins. Neither reaching → no
 * decision. BOTH reaching → no decision plus an anomaly flag: this is
 * impossible with correct targets, so the comparator names no winner (it can't
 * single one out) and surfaces the condition rather than breaking or picking a
 * side. A `null` target means that side cannot meet a goal (it contributes no
 * decision) — e.g. points targets, which have no source in code today.
 *
 * @param homeVal     home side's total for this metric
 * @param homeTarget  home side's win-target (or `null` if none applies)
 * @param awayVal     away side's total for this metric
 * @param awayTarget  away side's win-target (or `null` if none applies)
 */
export function metGoal(
  homeVal: number,
  homeTarget: number | null,
  awayVal: number,
  awayTarget: number | null,
): ComparatorOutcome {
  const homeMet = homeTarget !== null && homeVal >= homeTarget;
  const awayMet = awayTarget !== null && awayVal >= awayTarget;

  if (homeMet && awayMet) {
    return {
      winner: null,
      anomaly: 'both sides reached their win-target — impossible with correct targets',
    };
  }
  if (homeMet) return { winner: 'home' };
  if (awayMet) return { winner: 'away' };
  return NO_DECISION;
}
