/**
 * @fileoverview Handicap Mechanisms Module — type definitions for the 3
 * shipping variants (plus the 'none' degenerate case).
 *
 * Per the locked Handicap Mechanisms README
 * (`docs/league-system/modules/handicap-mechanisms/README.md`), this is a
 * SELECTION-pattern System Module organizing variants in a 2x2 taxonomy:
 *
 *                | Games axis                    | Points axis
 * ---------------+-------------------------------+-----------------
 * Head-start     | (future: games_on_the_wire)   | start_points
 * Extended-finish| extra_games                   | (future: extra_points)
 *                | race_length_adjustment        |
 *
 * The Mechanism declares WHAT KIND of asymmetry the handicap creates in match
 * setup. It DOES NOT decide who wins the match (that's the Win Calculator) and
 * DOES NOT compute the chart values (that's a Threshold Chart). It only declares
 * the shape — the typed compute signature — and routes inputs through the chart
 * to produce the typed output that match setup uses.
 *
 * `'none'` collapses to a zero-handicap extra_games shape for type-system
 * convenience — callers consistently see `mechanism.kind === 'extra_games'`
 * with zero per-side delta. Per the locked spec.
 *
 * @see ./index.ts — `getHandicapMechanism()` registry factory
 * @see docs/league-system/modules/handicap-mechanisms/README.md — locked blueprint
 */

import type { HandicapThresholds } from '@/types/match';
import type { SystemOverrides } from '@/types/systemOverrides';
import type {
  FargoStartPointsResult,
  RaceLengthResult,
  RatingValue,
} from '../types';

/**
 * Discriminator for the 3 shipping Mechanism variants. The 'none' case is not
 * its own variant — it composes onto extra_games with zero output (per the
 * locked spec's "The `'none'` case" section).
 */
export type MechanismKind =
  | 'extra_games'
  | 'start_points'
  | 'race_length_adjustment';

/**
 * Extra Games Mechanism — extended-finish on the games axis (the stronger
 * team needs MORE games to win to compensate for skill diff). Team-aggregate
 * scope; threshold termination.
 *
 * Per the locked extra-games.md variant page: consumes a team-aggregate
 * handicap difference, produces per-side target wins.
 */
export interface ExtraGamesMechanism {
  readonly kind: 'extra_games';
  /**
   * @param handicapDiff Signed team-aggregate handicap difference
   *   (home_handicap − away_handicap from the requesting team's perspective).
   * @param overrides League-level dial overrides (currently unused by
   *   extra_games, reserved for future per-mechanism dials).
   * @returns Per-side target wins / tie / lose for the requesting team.
   */
  compute: (
    handicapDiff: number,
    overrides: SystemOverrides,
  ) => HandicapThresholds;
}

/**
 * Start Points Mechanism — head-start on the points axis (the weaker team
 * starts the match with bonus points already on the board). Team-aggregate
 * scope; threshold termination.
 *
 * Per the locked start-points.md variant page: consumes both teams' rating
 * lists (not just a single diff scalar — the calculation depends on the full
 * lineup), produces the bonus-points figure for the weaker team plus the
 * weakerTeam direction discriminator.
 */
export interface StartPointsMechanism {
  readonly kind: 'start_points';
  compute: (
    homeRatings: RatingValue[],
    awayRatings: RatingValue[],
    overrides: SystemOverrides,
  ) => FargoStartPointsResult;
}

/**
 * Race Length Adjustment Mechanism — extended-finish on the games axis,
 * per-pairing scope (each individual pairing plays a race-to-N where N
 * differs by skill diff). Per-pairing scope; race termination.
 *
 * Per the locked race-length-adjustment.md variant page: consumes both
 * players' handicaps for a single pairing, produces per-side race lengths.
 *
 * RESERVED today — no shipping Scoring System uses this Mechanism. The
 * factory `createRaceLengthAdjustmentMechanism()` wraps a `RaceLengthChart`
 * variant (currently both Race charts are RESERVED stubs). When a real chart
 * lands, the Mechanism wires through automatically.
 */
export interface RaceLengthAdjustmentMechanism {
  readonly kind: 'race_length_adjustment';
  compute: (
    homeRatings: RatingValue[],
    awayRatings: RatingValue[],
    overrides: SystemOverrides,
  ) => RaceLengthResult;
}

/**
 * Discriminated union of all 3 Mechanism variants. Consumers narrow by `kind`
 * to access the variant's specific `compute` signature.
 *
 * The `'none'` case (`handicap_type='none'` league) is represented as a
 * zero-handicap `ExtraGamesMechanism` instance per the locked spec, so
 * consumers see a uniform shape rather than a null/undefined branch.
 */
export type HandicapMechanism =
  | ExtraGamesMechanism
  | StartPointsMechanism
  | RaceLengthAdjustmentMechanism;
