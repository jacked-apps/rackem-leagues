/**
 * @fileoverview Curated registry of "Available Data" the workshop UI
 * surfaces to LOs when they build a formula.
 *
 * Labels resolve based on which side the LO is editing. When editing
 * the WINNER side, `this_side_*` reads as "Winner …" and
 * `other_side_*` reads as "Loser …". On the loser side the labels
 * flip. The underlying variable names (the strings the runtime reads)
 * stay constant; only the display labels change. This keeps the
 * workshop guardrail intact (no free-text variable names) while
 * showing concrete role-based names instead of jargon.
 *
 * NOT exposed: vars that exist only inside specific compositions
 * (`winTarget`, `milestoneTarget`, etc.) — those vary by Scoring System
 * and surfacing them per-league is future work.
 */

export type SidePerspective = 'winner' | 'loser';

function otherSide(p: SidePerspective): SidePerspective {
  return p === 'winner' ? 'loser' : 'winner';
}

function cap(p: SidePerspective): string {
  return p === 'winner' ? 'Winner' : 'Loser';
}

export interface AvailableDatum {
  /** State-bag variable name the runtime reads. */
  readonly name: string;
  /** Label rendered from the editor's perspective. */
  readonly label: (p: SidePerspective) => string;
  /** Short hint shown beneath the label. */
  readonly description: (p: SidePerspective) => string;
}

export const AVAILABLE_DATA: readonly AvailableDatum[] = [
  // Per-game role values — what the scorer entered or the side's base
  // resolved to THIS game.
  {
    name: 'this_side_value',
    label: (p) => `${cap(p)} base (this game)`,
    description: (p) =>
      `The base value this game for the ${p}'s side (the fixed number or the scorer-entered range value, before this formula runs).`,
  },
  {
    name: 'other_side_value',
    label: (p) => `${cap(otherSide(p))} base (this game)`,
    description: (p) =>
      `The base value this game for the ${otherSide(p)}'s side. 17-Point's winner formula reads the loser's base via this entry.`,
  },
  // Per-game player handicaps (locked from match_lineups at match start).
  {
    name: 'this_side_handicap',
    label: (p) => `${cap(p)} handicap`,
    description: (p) =>
      `Locked handicap of the player currently in the ${p} role for this game (frozen at match start). Falls back to 0 if no handicap is on file.`,
  },
  {
    name: 'other_side_handicap',
    label: (p) => `${cap(otherSide(p))} handicap`,
    description: (p) =>
      `Locked handicap of the player currently in the ${otherSide(p)} role for this game. Falls back to 0 if no handicap is on file.`,
  },
  // Running totals.
  {
    name: 'this_side_wins',
    label: (p) => `${cap(p)} wins so far`,
    description: (p) =>
      `Games won so far in this match by the team currently in the ${p} role.`,
  },
  {
    name: 'other_side_wins',
    label: (p) => `${cap(otherSide(p))} wins so far`,
    description: (p) =>
      `Games won so far in this match by the team currently in the ${otherSide(p)} role.`,
  },
  {
    name: 'this_side_points',
    label: (p) => `${cap(p)} points so far`,
    description: (p) =>
      `Running points total in this match for the team currently in the ${p} role.`,
  },
  {
    name: 'other_side_points',
    label: (p) => `${cap(otherSide(p))} points so far`,
    description: (p) =>
      `Running points total in this match for the team currently in the ${otherSide(p)} role.`,
  },
  // Match-level (game-agnostic).
  {
    name: 'games_played',
    label: () => 'Games played so far',
    description: () => 'How many games have been completed in this match.',
  },
  {
    name: 'total_games',
    label: () => 'Total games in match',
    description: () => 'The full game count for this match (set at match start).',
  },
];

/** Look up the LO-facing label for a state-bag var name from a side perspective. */
export function labelForVar(name: string, perspective: SidePerspective): string {
  const datum = AVAILABLE_DATA.find((d) => d.name === name);
  return datum ? datum.label(perspective) : name;
}
