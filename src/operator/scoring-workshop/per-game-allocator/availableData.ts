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
 * The picker is intentionally limited to data that is UNIVERSAL — vars
 * the runtime maintains in every state bag regardless of which other
 * modules (thresholds, head-starts, etc.) are wired into the league's
 * scoring system. Composition-specific names like `winTarget` or
 * start-points credits live in OTHER modules' contracts; surfacing
 * them here would lie to the LO about what's actually going to be in
 * the bag at runtime. Those names become available only once a future
 * threshold-room or head-start-room exposes them in a way the
 * allocator workshop can safely consume.
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
    label: (p) => `${cap(p)} base`,
    description: (p) =>
      `The base value for the ${p}'s side this game (the fixed number or the scorer-entered range value, before this formula runs).`,
  },
  {
    name: 'other_side_value',
    label: (p) => `${cap(otherSide(p))} base`,
    description: (p) =>
      `The base value for the ${otherSide(p)}'s side this game. 17-Point's winner formula reads the loser's base via this entry.`,
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
  // Team handicap totals — sum of the lineup's locked handicaps at match
  // start (home includes the team bonus when applicable).
  {
    name: 'this_side_team_handicap',
    label: (p) => `${cap(p)} team handicap`,
    description: (p) =>
      `Total locked handicap for the ${p}'s team — sum of all five lineup handicaps (home includes any team bonus). Set at match start; unchanged across games.`,
  },
  {
    name: 'other_side_team_handicap',
    label: (p) => `${cap(otherSide(p))} team handicap`,
    description: (p) =>
      `Total locked handicap for the ${otherSide(p)}'s team. Set at match start; unchanged across games.`,
  },
  // Per-player running stats — tracked by the runtime as games are
  // processed, indexed by lineup position. Resolved at compute time
  // based on which player played this game for the role.
  {
    name: 'this_side_player_wins',
    label: (p) => `${cap(p)} player games`,
    description: (p) =>
      `Games won so far in this match by the player currently in the ${p} role (the player at the ${p}-team lineup position who played this game).`,
  },
  {
    name: 'other_side_player_wins',
    label: (p) => `${cap(otherSide(p))} player games`,
    description: (p) =>
      `Games won so far in this match by the player currently in the ${otherSide(p)} role.`,
  },
  {
    name: 'this_side_player_points',
    label: (p) => `${cap(p)} player points`,
    description: (p) =>
      `Points earned so far in this match by the player currently in the ${p} role.`,
  },
  {
    name: 'other_side_player_points',
    label: (p) => `${cap(otherSide(p))} player points`,
    description: (p) =>
      `Points earned so far in this match by the player currently in the ${otherSide(p)} role.`,
  },
  // Running totals.
  {
    name: 'this_side_wins',
    label: (p) => `${cap(p)} team games`,
    description: (p) =>
      `Games won so far in this match by the team currently in the ${p} role.`,
  },
  {
    name: 'other_side_wins',
    label: (p) => `${cap(otherSide(p))} team games`,
    description: (p) =>
      `Games won so far in this match by the team currently in the ${otherSide(p)} role.`,
  },
  {
    name: 'this_side_points',
    label: (p) => `${cap(p)} team points`,
    description: (p) =>
      `Running points total so far in this match for the team currently in the ${p} role.`,
  },
  {
    name: 'other_side_points',
    label: (p) => `${cap(otherSide(p))} team points`,
    description: (p) =>
      `Running points total so far in this match for the team currently in the ${otherSide(p)} role.`,
  },
  // Match-level (game-agnostic).
  {
    name: 'games_played',
    label: () => 'Games played',
    description: () => 'How many games have been completed in this match so far.',
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
