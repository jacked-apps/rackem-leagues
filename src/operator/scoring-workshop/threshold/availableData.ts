/**
 * @fileoverview Curated "Available Data" the threshold room's formula view
 * surfaces in the shared `ExpressionBuilder`.
 *
 * A threshold is authored from a neutral perspective: `this_side` is whichever
 * side the expansion is currently computing for, `other_side` is the opposite.
 * The `evaluate_expression` threshold operation resolves these virtuals against
 * `ThresholdInputs` per the active binding (so one formula yields a value and
 * its mirror). The names here MUST match the virtuals that operation builds.
 *
 * @see src/systems/points-system/operations/evaluate-threshold-expression.ts
 */

import type { ExpressionAvailableDatum } from '../_shared/ExpressionBuilder';

export const THRESHOLD_AVAILABLE_DATA: readonly ExpressionAvailableDatum[] = [
  {
    name: 'this_side_handicap_diff',
    label: 'My side — handicap gap',
    description: "This side's handicap minus the other side's (positive = this side is stronger).",
  },
  {
    name: 'other_side_handicap_diff',
    label: 'Other side — handicap gap',
    description: "The other side's handicap gap (the mirror of this side's).",
  },
  {
    name: 'this_side_team_handicap',
    label: 'My side — team handicap total',
    description: "Sum of this side's lineup handicaps (locked at match start).",
  },
  {
    name: 'other_side_team_handicap',
    label: 'Other side — team handicap total',
    description: "Sum of the other side's lineup handicaps.",
  },
  {
    name: 'this_side_rating_sum',
    label: 'My side — rating sum',
    description: "Sum of this side's player ratings.",
  },
  {
    name: 'other_side_rating_sum',
    label: 'Other side — rating sum',
    description: "Sum of the other side's player ratings.",
  },
  {
    name: 'game_count',
    label: 'Total games in match',
    description: 'The full game count for this match (set at match start).',
  },
];

/** Look up the LO-facing label for a threshold virtual name. */
export function thresholdLabelForVar(name: string): string {
  const datum = THRESHOLD_AVAILABLE_DATA.find((d) => d.name === name);
  return datum ? datum.label : name;
}
