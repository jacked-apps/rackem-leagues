/**
 * @fileoverview 17-Point Scoring System — Points System composition.
 *
 * Per the official CSI / BCAPL / FargoRate terminology, this is the
 * **17-Point Scoring System** — the zero-sum format where each game
 * distributes exactly 17 points between the two sides. The winner gets
 * `10 + (7 - balls_pocketed_by_loser)`; the loser gets `balls_pocketed`.
 * Total per game = 17 always.
 *
 * **First-class composition (currently unused by us).** Documented by CSI as
 * a real scoring format used in BCAPL leagues. We don't run any leagues on
 * 17-Point today, but the composition is a real Scoring System, not an
 * illustrative example. Treat it the same as 10-Point: a complete
 * composition that could be selected by a league via preferences.
 *
 * **Size-agnostic.** Like the 10-Point composition, the allocator and
 * thresholds don't depend on lineup size. The same composition handles
 * any roster size.
 *
 * **Composition shape:**
 *   - Thresholds: per-side FargoRate start-points (same as 10-Point —
 *     FargoRate is the handicap layer applied on top of the scoring format)
 *   - Triggers: receipt triggers awarding the start-points head-start
 *   - Per-game allocator: zero-sum 17-Point split
 *     - winner: base 10, formula `add_complement_of_other_side` (max=7,
 *       other_side='loser') — produces 10 + (7 - loser_balls)
 *     - loser: SideInputRange { min: 0, max: 7, label: 'Balls pocketed' }
 *
 * @see ./10-point.ts — the parallel 10-Point composition (sibling format)
 * @see ../operations/fargo-start-points-for-side.ts — start-points operation
 * @see ../allocator-formula-operations/add-complement-of-other-side.ts — the zero-sum formula
 */

// Importing these auto-registers the operations.
import '../operations/fargo-start-points-for-side';
import '../allocator-formula-operations/add-complement-of-other-side';

import { validatePointsSystem } from '../composition-validator';
import { buildThresholdRow } from '../threshold-resolver';
import type { PointsSystem, Trigger } from '../types';

export interface SeventeenPointParams {
  /** Winner's base value (default 10 — yields the canonical 17-total split). */
  winner_base: number;
  /** Max value the loser can pocket (default 7). The "complement" formula reads this. */
  loser_max: number;
  /** Label shown to scorers when collecting the loser's input. */
  loser_label: string;
}

const DEFAULT_PARAMS: SeventeenPointParams = {
  winner_base: 10,
  loser_max: 7,
  loser_label: 'Balls pocketed by loser',
};

function awardInitialPoints(
  triggerName: string,
  thresholdRef: string,
  side: 'home' | 'away',
  targetVariable: string,
): Trigger {
  return {
    name: triggerName,
    input: { thresholdRef },
    inputSpec: { outputType: 'points_headstart', outputSide: side },
    when: { kind: 'receipt' },
    action: {
      target: { kind: 'concrete', variableName: targetVariable },
      op: 'add',
      value: { kind: 'input_ref' },
    },
  };
}

/**
 * Build the 17-Point Scoring System's Points System composition.
 *
 * Thresholds compute start-points from `inputs.homeRatings`/`awayRatings`
 * at evaluation time (no caller pre-computation needed).
 */
export function buildSeventeenPointComposition(
  params: Partial<SeventeenPointParams> = {},
): PointsSystem {
  const p: SeventeenPointParams = { ...DEFAULT_PARAMS, ...params };

  const composition: PointsSystem = {
    name: '17_point',
    thresholds: {
      initialHome: buildThresholdRow({
        name: 'initialHome',
        operationKind: 'fargo_start_points_for_side',
        operationArgs: { side: 'home' },
      }),
      initialAway: buildThresholdRow({
        name: 'initialAway',
        operationKind: 'fargo_start_points_for_side',
        operationArgs: { side: 'away' },
      }),
    },
    perGameAllocator: {
      name: '17pt_per_game',
      // Winner's value is computed by the zero-sum formula:
      //   winner_contribution = base + (loser_max - ctx.loser)
      // For default params: 10 + (7 - balls_pocketed) → 10 when loser
      // pockets 7, 17 when loser pockets 0. Total per game always = 17.
      winner: {
        base: p.winner_base,
        formula: {
          operationKind: 'add_complement_of_other_side',
          operationArgs: { max: p.loser_max, other_side: 'loser' },
        },
      },
      // Loser declares a range; scorer enters the value each game.
      loser: {
        base: { min: 0, max: p.loser_max, label: p.loser_label },
        formula: null,
      },
    },
    triggers: [
      awardInitialPoints('award_initial_home', 'initialHome', 'home', 'home_points'),
      awardInitialPoints('award_initial_away', 'initialAway', 'away', 'away_points'),
    ],
  };

  validatePointsSystem(composition);
  return composition;
}
