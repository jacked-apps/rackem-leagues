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

export const AVAILABLE_DATA: readonly AvailableDatum[] = [
  {
    name: 'home_wins',
    label: 'Home Team Wins So Far',
    description: 'How many games the home team has won in this match up to now.',
  },
  {
    name: 'away_wins',
    label: 'Away Team Wins So Far',
    description: 'How many games the away team has won in this match up to now.',
  },
  {
    name: 'home_points',
    label: 'Home Team Points So Far',
    description: 'Running points total for the home team in this match.',
  },
  {
    name: 'away_points',
    label: 'Away Team Points So Far',
    description: 'Running points total for the away team in this match.',
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
