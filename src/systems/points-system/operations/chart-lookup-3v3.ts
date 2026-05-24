/**
 * @fileoverview Threshold operation: chart lookup for the BCA 3v3 chart.
 *
 * Implements the `'chart_lookup_3v3'` operation kind for the Threshold
 * registry. Wraps the existing `get3v3GamesNeeded` chart lookup as a
 * registered operation that data-driven `ThresholdRow`s can reference.
 *
 * **What it does:**
 *  - Looks up the 3v3 chart by the requested side's handicap diff
 *  - Returns one of the chart's three output fields (`games_to_win`,
 *    `games_to_tie`, `games_to_lose`) per the `output_field` arg
 *  - `games_to_tie` is nullable at odd handicap diffs; the operation
 *    propagates `null` so the consumer can treat it as "no tie applies"
 *
 * **Arg shape:**
 *  - `side: 'home' | 'away'` — which side's handicap diff to look up
 *  - `output_field: 'games_to_win' | 'games_to_tie' | 'games_to_lose' | 'games_to_tie_or_win'`
 *    (the last is a derived lower-band edge: `games_to_tie ?? games_to_win`)
 *
 * **Registered declarations:**
 *  - consumesHandicapType: `'points'` (3v3 chart is Points-calibrated)
 *  - consumesSize: `{ lineup_sizes: [3] }` (chart calibrated for size-3 teams)
 *  - producesOutputType: `'game_target'` (per-side target wins/ties/losses)
 *
 * @see ../threshold-registry.ts — the registry this operation registers into
 * @see src/utils/handicap/get3v3GamesNeeded.ts — the underlying chart lookup
 */

import { get3v3GamesNeeded } from '@/utils/handicap/get3v3GamesNeeded';
import { registerThresholdOperation } from '../threshold-registry';
import type { ThresholdOperation } from '../types';

type ChartOutputField = 'games_to_win' | 'games_to_tie' | 'games_to_lose';

export const chartLookup3v3Operation: ThresholdOperation = {
  name: 'chart_lookup_3v3',
  consumesHandicapType: 'points',
  consumesSize: { kind: 'lineup_sizes', sizes: [3] },
  producesOutputType: 'game_target',
  // Output side comes from args.side — chart lookup returns the per-side
  // target for whichever side was requested.
  producesOutputSide: (args) => {
    const side = args.side;
    if (side === 'home' || side === 'away') return side;
    throw new Error(
      `chart_lookup_3v3: producesOutputSide expects args.side='home'|'away', got ${JSON.stringify(side)}`,
    );
  },
  // 3v3 chart returns game counts within match length (0..games_in_match).
  producesOutputRange: { min: 0, max: 'games_in_match' },
  compute: (args, inputs) => {
    const side = args.side;
    const field = args.output_field;
    if (side !== 'home' && side !== 'away') {
      throw new Error(
        `chart_lookup_3v3: expected args.side to be 'home' or 'away', got ${JSON.stringify(side)}`,
      );
    }
    if (
      field !== 'games_to_win' &&
      field !== 'games_to_tie' &&
      field !== 'games_to_lose' &&
      field !== 'games_to_tie_or_win'
    ) {
      throw new Error(
        `chart_lookup_3v3: expected args.output_field to be a chart field, got ${JSON.stringify(field)}`,
      );
    }
    const diff = side === 'home' ? inputs.homeHandicapDiff : inputs.awayHandicapDiff;
    const chart = get3v3GamesNeeded(diff);
    if (field === 'games_to_tie_or_win') {
      // Lower-band edge for end-of-match scoring: the tie target when a tie is
      // possible, else the win target. This collapses the below-band scoring to a
      // single linear band when ties are impossible — matching the legacy
      // aggregate's null-tie collapse, expressed as a threshold value so the
      // match_end trigger just compares against it.
      return chart.games_to_tie ?? chart.games_to_win;
    }
    return chart[field as ChartOutputField];
  },
};

/**
 * Side-effect: register the operation in the threshold registry at module
 * load time. Importing this file is enough to make `'chart_lookup_3v3'`
 * available for `ThresholdRow.operationKind` references.
 *
 * Tests that clear the registry must re-register the operation (or call
 * the helper below). Production code imports this once at app startup
 * (typically transitively through a composition that uses it).
 */
export function registerChartLookup3v3(): void {
  registerThresholdOperation(chartLookup3v3Operation);
}

// Auto-register on import. Composition modules pick this up by importing the
// file directly OR by importing the bundled operations index.
registerChartLookup3v3();
