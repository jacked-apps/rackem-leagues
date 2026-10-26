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
 * Target source. By default the four thresholds come from the 3v3 chart
 * (`chart_lookup_3v3`, keyed off the handicap diff). A LIVE match must instead
 * use `targetSource: 'saved'`: the targets are fixed when the match is prepped
 * and must never move mid-match (per Ed, 2026-10-26 — "Target is set at the
 * beginning of the match and cannot / should not change"). Re-deriving them
 * from the locked lineups on every scoring event let a tiebreaker re-lock
 * (fresh handicaps / team bonus) silently shift the targets, which produced
 * impossible results such as a match WIN stored at −1 points. In 'saved' mode
 * the thresholds read the saved values the adapter bridges into `prefs`
 * (see {@link SAVED_TARGET_PREF_KEYS}).
 *
 * Thresholds are data-driven (operation kind + args). The triggers are the
 * serializable v2 model (condition + flat-expression action), so a future
 * builder UI can render/edit them.
 *
 * @see ../runtime.ts — fires match_end triggers, then there is no aggregate
 * @see ../operations/chart-lookup-3v3.ts — the registered chart operation
 * @see docs/league-system/modules/points-system/trigger.md — end-of-match scoring pattern
 */

// Importing these auto-registers the operations into the registry.
import '../operations/chart-lookup-3v3';
import '../operations/read-pref';

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
 * `prefs` keys the 'saved' target source reads. The match adapter copies the
 * match row's saved targets into these keys before running the engine:
 *  - `*_to_win`      ← `*_to_win`
 *  - `*_lower_edge`  ← `*_to_tie ?? *_to_win` (same collapse as the chart's
 *                      `games_to_tie_or_win`)
 */
export const SAVED_TARGET_PREF_KEYS = {
  homeWinTarget: 'home_to_win',
  awayWinTarget: 'away_to_win',
  homeLowerEdge: 'home_lower_edge',
  awayLowerEdge: 'away_lower_edge',
} as const;

/**
 * Build one threshold row for the requested target source: a chart lookup
 * for `side` / `chartField`, or a `read_pref` of the saved target.
 */
function targetRow(
  name: keyof typeof SAVED_TARGET_PREF_KEYS,
  side: 'home' | 'away',
  chartField: 'games_to_win' | 'games_to_tie_or_win',
  targetSource: 'chart' | 'saved',
) {
  return targetSource === 'saved'
    ? buildThresholdRow({
        name,
        operationKind: 'read_pref',
        operationArgs: { pref_key: SAVED_TARGET_PREF_KEYS[name] },
      })
    : buildThresholdRow({
        name,
        operationKind: 'chart_lookup_3v3',
        operationArgs: { side, output_field: chartField },
      });
}

/**
 * Build the Points 3-Man Scoring System's Points System composition.
 *
 * @param params.multiplier Optional multiplier (default 1) for the linear bands.
 * @param params.targetSource `'chart'` (default) looks the targets up from the
 *   3v3 chart by handicap diff — used for previews / system definitions with
 *   no real match. `'saved'` reads the match's saved targets from `prefs`
 *   (keys in {@link SAVED_TARGET_PREF_KEYS}) — required for live scoring so
 *   the targets can never change mid-match.
 *
 * @example
 * // Live match: score against the targets saved at match prep.
 * buildPoints3ManComposition({ multiplier: 1, targetSource: 'saved' });
 */
export function buildPoints3ManComposition(
  params: { multiplier?: number; targetSource?: 'chart' | 'saved' } = {},
): PointsSystem {
  const mult = params.multiplier ?? 1;
  const source = params.targetSource ?? 'chart';

  const composition: PointsSystem = {
    name: 'points_3man',
    thresholds: {
      homeWinTarget: targetRow('homeWinTarget', 'home', 'games_to_win', source),
      awayWinTarget: targetRow('awayWinTarget', 'away', 'games_to_win', source),
      // Lower-band edge = the tie target when a tie is possible, else the win
      // target (so when ties are impossible the below-band scoring collapses to
      // one linear band — matching the legacy null-tie behavior). Math lives in
      // the threshold; the trigger just compares against the posted value.
      homeLowerEdge: targetRow('homeLowerEdge', 'home', 'games_to_tie_or_win', source),
      awayLowerEdge: targetRow('awayLowerEdge', 'away', 'games_to_tie_or_win', source),
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
