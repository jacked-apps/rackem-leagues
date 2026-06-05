/**
 * @fileoverview Curated registry of "Available Data" the workshop UI
 * surfaces to LOs when they build a formula.
 *
 * The state bag is an open namespace — anything a threshold or trigger
 * writes is readable by name. But exposing that as a free-text input
 * invites typos and broken formulas. Instead the workshop offers a
 * fixed, human-named list. Each entry maps the LO-facing label to the
 * actual state-var name the runtime reads.
 *
 * The set today covers the runtime-initialized vars in
 * `src/systems/points-system/runtime.ts` — the always-present ones.
 * As more compositions write to the bag (milestone counts, tiebreaker
 * markers, etc.) entries get added here so the LO can reference them.
 *
 * NOT exposed: vars that exist only inside specific compositions
 * (`winTarget`, `milestoneTarget`, etc.) — those vary by Scoring System
 * and surfacing them per-league is future work.
 */

export interface AvailableDatum {
  /** State-bag variable name the runtime reads. */
  readonly name: string;
  /** What the LO sees in the picker. */
  readonly label: string;
  /** Short hint shown beneath the label. */
  readonly description: string;
}

/**
 * Side-agnostic available data. The allocator computes per-side
 * contributions for the winner and loser of THIS game — it never
 * thinks in home/away. Exposing `home_wins` / `away_wins` to the LO
 * would invite unfair formulas (a formula that gives the winner
 * `home_wins` points would short-change away winners every time).
 *
 * Instead, the workshop offers virtual names like `this_side_wins`
 * that the `evaluate_expression` recipe resolves at compute time to
 * the right home_xxx or away_xxx state-bag entry based on who
 * actually won THIS game and which side this formula computes for.
 */
export const AVAILABLE_DATA: readonly AvailableDatum[] = [
  {
    name: 'this_side_wins',
    label: "This Side's Wins So Far",
    description:
      "Games won so far by the team this side computes for. When the formula runs for the winner of THIS game, this is the winner team's running wins; for the loser side, the loser team's.",
  },
  {
    name: 'other_side_wins',
    label: "Other Side's Wins So Far",
    description:
      "Games won so far by the team this side does NOT compute for. Mirror image of This Side's Wins.",
  },
  {
    name: 'this_side_points',
    label: "This Side's Points So Far",
    description:
      "Running points total for the team this side computes for in this match.",
  },
  {
    name: 'other_side_points',
    label: "Other Side's Points So Far",
    description:
      'Running points total for the opposite team in this match.',
  },
  {
    name: 'games_played',
    label: 'Games Played So Far',
    description: 'How many games have been completed in this match.',
  },
  {
    name: 'total_games',
    label: 'Total Games In Match',
    description: 'The full game count for this match (set at match start).',
  },
];

/** Look up the LO-facing label for a state-bag var name. */
export function labelForVar(name: string): string {
  return AVAILABLE_DATA.find((d) => d.name === name)?.label ?? name;
}
