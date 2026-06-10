/**
 * @fileoverview Curated registry of "Available Data" the trigger room
 * surfaces to LOs in the CONDITION picker and the ACTION expression
 * builder.
 *
 * Triggers have no per-side perspective (a trigger writes to a chosen
 * target like `home_points` or `away_points`), so labels and
 * descriptions are plain strings — not perspective functions. The
 * shared `ExpressionBuilder` widget consumes the same row shape as the
 * allocator wrapper but without the per-side flip.
 *
 * The picker is intentionally limited to UNIVERSAL state-bag entries —
 * names the runtime maintains in every match regardless of which other
 * modules (thresholds, head-starts, allocators) are wired into the
 * league's scoring system. Composition-specific names like
 * `winTarget` or threshold output names belong to OTHER modules'
 * contracts; surfacing them here would lie to the LO about what's
 * actually going to be in the bag at runtime.
 *
 * The READ universe (this list) is large. The WRITE universe — the
 * targets a trigger's ACTION can write to — is small and lives next to
 * the editor: `['home_points', 'away_points']`. The save-time guard
 * enforces the smaller set; the loader rejects rows that escaped it.
 */

export interface TriggerAvailableDatum {
  /** State-bag variable name the runtime reads. */
  readonly name: string;
  /** LO-facing label rendered in the picker + token pills. */
  readonly label: string;
  /** Short hint shown beneath the label in the picker. */
  readonly description: string;
}

/** The five lineup positions. Used to expand the per-position counters. */
const POSITIONS = [1, 2, 3, 4, 5] as const;

const PER_POSITION_ENTRIES: readonly TriggerAvailableDatum[] = POSITIONS.flatMap(
  (pos) => [
    {
      name: `home_player_${pos}_wins`,
      label: `Home player ${pos} games won`,
      description: `Games won so far in this match by the player at home lineup position ${pos}.`,
    },
    {
      name: `away_player_${pos}_wins`,
      label: `Away player ${pos} games won`,
      description: `Games won so far in this match by the player at away lineup position ${pos}.`,
    },
    {
      name: `home_player_${pos}_points`,
      label: `Home player ${pos} points`,
      description: `Points earned so far in this match by the player at home lineup position ${pos}.`,
    },
    {
      name: `away_player_${pos}_points`,
      label: `Away player ${pos} points`,
      description: `Points earned so far in this match by the player at away lineup position ${pos}.`,
    },
  ],
);

export const TRIGGER_AVAILABLE_DATA: readonly TriggerAvailableDatum[] = [
  // Team-level running totals.
  {
    name: 'home_wins',
    label: 'Home team games won',
    description: 'Games won so far in this match by the home team.',
  },
  {
    name: 'away_wins',
    label: 'Away team games won',
    description: 'Games won so far in this match by the away team.',
  },
  {
    name: 'home_points',
    label: 'Home team points',
    description: 'Running points total so far in this match for the home team.',
  },
  {
    name: 'away_points',
    label: 'Away team points',
    description: 'Running points total so far in this match for the away team.',
  },
  // Team handicap totals (locked at match start; unchanged across games).
  {
    name: 'home_team_handicap',
    label: 'Home team handicap total',
    description:
      'Sum of locked lineup handicaps for the home team (includes any team bonus). Set at match start.',
  },
  {
    name: 'away_team_handicap',
    label: 'Away team handicap total',
    description:
      'Sum of locked lineup handicaps for the away team. Set at match start.',
  },
  // Match-level.
  {
    name: 'games_played',
    label: 'Games played',
    description: 'How many games have been completed in this match so far.',
  },
  {
    name: 'total_games',
    label: 'Total games in match',
    description: 'The full game count for this match (set at match start).',
  },
  // Per-position counters (5 positions × 2 teams × 2 stats = 20 entries).
  ...PER_POSITION_ENTRIES,
];

/** Look up the LO-facing label for a state-bag var name. */
export function triggerLabelForVar(name: string): string {
  const datum = TRIGGER_AVAILABLE_DATA.find((d) => d.name === name);
  return datum ? datum.label : name;
}

/**
 * Targets a trigger's ACTION is allowed to write to. The save-time
 * guard checks against this whitelist; the loader rejects rows whose
 * target escaped it. The editor uses this to drive the target picker.
 */
export const TRIGGER_WRITE_TARGETS = [
  { name: 'home_points', label: 'Home team points' },
  { name: 'away_points', label: 'Away team points' },
] as const;
