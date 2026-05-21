/**
 * @fileoverview Points 3-Man Scoring System — Points System composition.
 *
 * Per the locked Points System README, Points 3-Man's composition is:
 *  - 6 thresholds (per-side win/tie/lose targets, derived from the 3v3 chart).
 *    Thresholds are state setters — the runtime writes each resolved value into
 *    the state bag under its name at match start (no copy-trigger needed).
 *  - End-of-match scoring as a `match_end` trigger pattern (NOT a distinct
 *    aggregate). Per side, two match_end triggers reproduce the three-band
 *    linear formula, using `winTarget` (upper edge) and `lowerEdge`
 *    (= tie target, or win target when ties are impossible):
 *      - above-win:  IF wins > winTarget  THEN points = (wins − winTarget) × mult
 *      - below-edge: IF wins < lowerEdge  THEN points = (wins − lowerEdge) × mult
 *      - tie band:   neither fires → points keeps its default 0 (the locked
 *                    9-9 tie-band absorption; per-side, so 9-9 → both 0). When
 *                    ties are impossible lowerEdge == winTarget, collapsing the
 *                    two bands into one continuous line (matching the legacy).
 *
 * Thresholds are data-driven (operation kind + args). The triggers are the
 * serializable v2 model (condition + flat-expression action), so a future
 * builder UI can render/edit them.
 *
 * @see ../runtime.ts — fires match_end triggers, then there is no aggregate
 * @see ../operations/chart-lookup-3v3.ts — the registered chart operation
 * @see docs/league-system/modules/points-system/trigger.md — end-of-match scoring pattern
 */

// Importing this auto-registers the chart operation into the registry.
import '../operations/chart-lookup-3v3';

import { validatePointsSystem } from '../composition-validator';
import { buildThresholdRow } from '../threshold-resolver';
import type { PointsSystem, Trigger } from '../types';

/**
 * Build one band trigger: at match end, if `<side>_wins <op> <targetVar>`, set
 * `<side>_points = (<side>_wins − <targetVar>) × multiplier`. Used for the
 * above-win (`>` vs winTarget) and below-tie (`<` vs tieTarget) bands; the tie
 * band in between is the default-0 (no trigger fires).
 */
function bandTrigger(
  name: string,
  side: 'home' | 'away',
  targetVar: string,
  op: '>' | '<',
  multiplier: number,
  orderNumber: number,
): Trigger {
  const winsVar = `${side}_wins`;
  return {
    name,
    type: 'match_end',
    condition: {
      kind: 'compare',
      left: { kind: 'var', name: winsVar },
      op,
      right: { kind: 'var', name: targetVar },
    },
    action: {
      target: `${side}_points`,
      value: {
        kind: 'expr',
        expr: {
          kind: 'op',
          op: '*',
          left: {
            kind: 'op',
            op: '-',
            left: { kind: 'var', name: winsVar },
            right: { kind: 'var', name: targetVar },
          },
          right: { kind: 'const', value: multiplier },
        },
      },
    },
    rearm: 'single_shot',
    order: { number: orderNumber, beforeAllocator: false },
  };
}

/**
 * Build the Points 3-Man Scoring System's Points System composition.
 *
 * @param params Optional multiplier (default 1) for the linear bands.
 */
export function buildPoints3ManComposition(
  params: { multiplier?: number } = {},
): PointsSystem {
  const mult = params.multiplier ?? 1;

  const composition: PointsSystem = {
    name: 'points_3man',
    thresholds: {
      homeWinTarget: buildThresholdRow({
        name: 'homeWinTarget',
        operationKind: 'chart_lookup_3v3',
        operationArgs: { side: 'home', output_field: 'games_to_win' },
      }),
      awayWinTarget: buildThresholdRow({
        name: 'awayWinTarget',
        operationKind: 'chart_lookup_3v3',
        operationArgs: { side: 'away', output_field: 'games_to_win' },
      }),
      // Lower-band edge = the tie target when a tie is possible, else the win
      // target (so when ties are impossible the below-band scoring collapses to
      // one linear band — matching the legacy null-tie behavior). Math lives in
      // the threshold; the trigger just compares against the posted value.
      homeLowerEdge: buildThresholdRow({
        name: 'homeLowerEdge',
        operationKind: 'chart_lookup_3v3',
        operationArgs: { side: 'home', output_field: 'games_to_tie_or_win' },
      }),
      awayLowerEdge: buildThresholdRow({
        name: 'awayLowerEdge',
        operationKind: 'chart_lookup_3v3',
        operationArgs: { side: 'away', output_field: 'games_to_tie_or_win' },
      }),
    },
    // End-of-match scoring as match_end triggers (two per side). The tie band is
    // the default-0 of *_points (neither band trigger fires inside it).
    triggers: [
      bandTrigger('homeAboveWin', 'home', 'homeWinTarget', '>', mult, 1),
      bandTrigger('homeBelowEdge', 'home', 'homeLowerEdge', '<', mult, 2),
      bandTrigger('awayAboveWin', 'away', 'awayWinTarget', '>', mult, 3),
      bandTrigger('awayBelowEdge', 'away', 'awayLowerEdge', '<', mult, 4),
    ],
  };

  validatePointsSystem(composition);
  return composition;
}
