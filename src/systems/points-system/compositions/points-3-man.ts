/**
 * @fileoverview Points 3-Man Scoring System — Points System composition.
 *
 * Per the locked Points System README, Points 3-Man's composition is:
 *  - 2 thresholds — one PAR per side: the games total that scores exactly 0.
 *    Par = the side's tie target when a tie is possible, else its win target.
 *    Thresholds are state setters — the runtime writes each resolved value into
 *    the state bag under its name at match start (no copy-trigger needed).
 *  - End-of-match scoring as a `match_end` trigger pattern (NOT a distinct
 *    aggregate). Per side, ONE linear line through par:
 *      - above par: IF wins > par THEN points = (wins − par) × mult
 *      - below par: IF wins < par THEN points = (wins − par) × mult
 *      - at par:    neither fires → points keeps its default 0 (so a 9-9 tie
 *                   at par → both 0, whoever then wins the tiebreaker).
 *
 * The rule is Ed's league scoresheet formula, byte-for-byte (TABLE n!O19/P19:
 * `points = games_won − IF(to_tie = "X", to_win, to_tie)`). Example, tie
 * possible with to_tie 9 / to_win 10: win 10–8 → +1 / −1; 12–6 → +3 / −3.
 * An earlier version measured winners from the WIN target instead (10–8 → 0),
 * which leaked −1 into the league total on every decided tie-possible match
 * and pushed every team's standings points negative (fixed 2026-10-27).
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
 * Build one half of a side's points line: at match end, if
 * `<side>_wins <op> <targetVar>`, set
 * `<side>_points = (<side>_wins − <targetVar>) × multiplier`. A side gets an
 * above-par (`>`) and a below-par (`<`) trigger against the same par; exactly
 * at par neither fires and points keep their default 0.
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
 *  - `*_par` ← `*_to_tie ?? *_to_win` (same collapse as the chart's
 *              `games_to_tie_or_win`)
 */
export const SAVED_TARGET_PREF_KEYS = {
  homePar: 'home_par',
  awayPar: 'away_par',
} as const;

/**
 * Build one threshold row for the requested target source: a chart lookup
 * for `side` / `chartField`, or a `read_pref` of the saved target.
 */
function targetRow(
  name: keyof typeof SAVED_TARGET_PREF_KEYS,
  side: 'home' | 'away',
  chartField: 'games_to_tie_or_win',
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
      // Par = the tie target when a tie is possible, else the win target.
      // Math lives in the threshold; the triggers just compare against the
      // posted value.
      homePar: targetRow('homePar', 'home', 'games_to_tie_or_win', source),
      awayPar: targetRow('awayPar', 'away', 'games_to_tie_or_win', source),
    },
    // End-of-match scoring as match_end triggers (above/below par per side).
    // Exactly at par neither fires, so *_points keeps its default 0.
    triggers: [
      bandTrigger('homeAbovePar', 'home', 'homePar', '>', mult, 1),
      bandTrigger('homeBelowPar', 'home', 'homePar', '<', mult, 2),
      bandTrigger('awayAbovePar', 'away', 'awayPar', '>', mult, 3),
      bandTrigger('awayBelowPar', 'away', 'awayPar', '<', mult, 4),
    ],
  };

  validatePointsSystem(composition);
  return composition;
}
