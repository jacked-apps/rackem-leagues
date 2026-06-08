/**
 * @fileoverview Threshold operations: games-needed FORMULA variants.
 *
 * Wires the existing byte-exact games-needed formula charts
 * (`gamesNeeded3v3FormulaChart`, `gamesNeeded5v5FormulaChart`) as threshold
 * operations so they can be authored/cloned as workshop templates. These are
 * the FORMULA shape of "games to win" — unlike the chart (locked to the size it
 * was built for), the formula is size-agnostic (it scales with `game_count`).
 *
 * The handicap ENCODING is declared per operation — points for 3v3,
 * percentage for 5v5 — because a chart/formula is calibrated for a specific
 * encoding and the input must match it.
 *
 * Built-in math: an LO clones these to USE them; the formula itself isn't
 * editable in the arithmetic builder.
 *
 * @see src/systems/threshold-charts/games-needed-3v3-formula.ts
 * @see src/systems/threshold-charts/games-needed-5v5-formula.ts
 */

import {
  gamesNeeded3v3FormulaChart,
  gamesNeeded5v5FormulaChart,
} from '@/systems/threshold-charts';
import type { GamesNeededChart } from '@/systems/threshold-charts';
import { registerThresholdOperation } from '../threshold-registry';
import type {
  HandicapTypeRequirement,
  ThresholdInputs,
  ThresholdOperation,
  ThresholdOutputSide,
} from '../types';

type GamesNeededField = 'games_to_win' | 'games_to_tie' | 'games_to_lose';

function makeGamesNeededFormulaOp(
  name: string,
  encoding: HandicapTypeRequirement,
  chart: GamesNeededChart,
): ThresholdOperation {
  return {
    name,
    consumesHandicapType: encoding,
    consumesSize: { kind: 'lineup_sizes', sizes: 'any' },
    producesOutputType: 'game_target',
    producesOutputSide: (args): ThresholdOutputSide => {
      const side = args.side;
      return side === 'home' || side === 'away' ? side : 'shared';
    },
    producesOutputRange: { min: 0, max: 'games_in_match' },
    compute: (args, inputs: ThresholdInputs) => {
      const field = args.output_field;
      if (field !== 'games_to_win' && field !== 'games_to_tie' && field !== 'games_to_lose') {
        console.warn(`${name}: output_field must be games_to_win|games_to_tie|games_to_lose; returning null`);
        return null;
      }
      const diff = args.side === 'away' ? inputs.awayHandicapDiff : inputs.homeHandicapDiff;
      const thresholds = chart.compute(diff);
      return thresholds[field as GamesNeededField];
    },
  };
}

export const gamesNeeded3v3FormulaOp = makeGamesNeededFormulaOp(
  'games_needed_3v3_formula',
  'points',
  gamesNeeded3v3FormulaChart,
);

export const gamesNeeded5v5FormulaOp = makeGamesNeededFormulaOp(
  'games_needed_5v5_formula',
  'percentage',
  gamesNeeded5v5FormulaChart,
);

export function registerGamesNeededFormulaOps(): void {
  registerThresholdOperation(gamesNeeded3v3FormulaOp);
  registerThresholdOperation(gamesNeeded5v5FormulaOp);
}

registerGamesNeededFormulaOps();
