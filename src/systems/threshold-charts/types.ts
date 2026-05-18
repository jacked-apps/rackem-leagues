/**
 * @fileoverview Threshold Charts Module — type definitions for the 5 Chart variants.
 *
 * Per the locked Threshold Charts README
 * (`docs/league-system/modules/threshold-charts/README.md`), this is a
 * SELECTION-pattern System Module offering 5 Chart-kind variants:
 *
 * | Scope            | Discrete table     | Formula                       |
 * |------------------|--------------------|-------------------------------|
 * | Team-aggregate   | (LO-custom rows)   | games_needed_3v3 (Points)     |
 * |                  |                    | games_needed_5v5 (Percentage) |
 * | Per-pairing      | race_points        | fargo_formula (FargoRate)     |
 * |                  | race_percentage    |                               |
 *
 * Each variant has its own typed I/O contract (input domain bound to a
 * specific Handicap System encoding; output shape coupled to a specific
 * Handicap Mechanism). The Chart kind discriminator distinguishes them.
 *
 * @see ./index.ts — the `getThresholdChart()` registry factory
 * @see docs/league-system/modules/threshold-charts/README.md — the locked blueprint
 */

import type { HandicapThresholds } from '@/types/match';
import type { SystemOverrides } from '@/types/systemOverrides';
import type { FargoStartPointsResult, RaceLengthResult } from '../types';

/**
 * Discriminator for the 5 shipped Chart variants. Matches the locked Catalog
 * table on the Threshold Charts README.
 */
export type ChartKind =
  | 'games_needed_3v3'
  | 'games_needed_5v5'
  | 'fargo_formula'
  | 'race_points'
  | 'race_percentage';

/**
 * Games-needed Chart — Points-encoded handicap diff → asymmetric per-side
 * target wins (output shape coupled to the `extra_games` Mechanism).
 *
 * Variants: `games_needed_3v3` (5-man double round-robin, 18 games),
 * `games_needed_5v5` (8-man single round-robin, 25 games). The two differ
 * only in the lookup table they wrap; their I/O contract is identical.
 */
export interface GamesNeededChart {
  readonly kind: 'games_needed_3v3' | 'games_needed_5v5';
  /**
   * @param handicapDiff Signed integer (for 3v3) or percentage value (for 5v5).
   * @returns Per-side target wins as `HandicapThresholds`.
   */
  compute: (handicapDiff: number) => HandicapThresholds;
}

/**
 * FargoRate-formula Chart — continuous formula taking both teams' rating lists
 * and producing the bonus-points figure for the weaker team (output shape
 * coupled to the `start_points` Mechanism).
 *
 * Per the locked variant page, the formula is roster-agnostic — it works for
 * any lineup size, not just 5v5. Today's only consumer is the Fargo 5v5
 * SystemModule, but the variant itself doesn't assume 5v5.
 */
export interface FargoFormulaChart {
  readonly kind: 'fargo_formula';
  compute: (
    homeRatings: number[],
    awayRatings: number[],
    overrides: SystemOverrides,
  ) => FargoStartPointsResult;
}

/**
 * Race-length Chart — per-pairing race lengths (output shape coupled to the
 * `race_length_adjustment` Mechanism).
 *
 * Variants: `race_points` (Points encoding, 2D pairwise lookup),
 * `race_percentage` (Percentage encoding, 2D gap × tier lookup). Both are
 * RESERVED — no shipping code today; included in the registry so the catalog
 * surface is complete.
 */
export interface RaceLengthChart {
  readonly kind: 'race_points' | 'race_percentage';
  compute: (
    homeHandicap: number,
    awayHandicap: number,
    overrides: SystemOverrides,
  ) => RaceLengthResult;
}

/**
 * Discriminated union of all 5 Chart variants. Consumers narrow by `kind`
 * to access the variant's specific `compute` signature.
 */
export type ThresholdChart = GamesNeededChart | FargoFormulaChart | RaceLengthChart;
