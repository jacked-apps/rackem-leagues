/**
 * @fileoverview Percentage 5-Man Scoring System — Points System composition.
 *
 * Per the locked Points System README + the Ed-walked decomposition + the
 * locked Trigger Model:
 *
 *   composition = (A) per-game allocator
 *               + (B) per-side milestone bonus triggers (jump to 1.5)
 *               + (B) per-side win bonus triggers (jump to 3.0)
 *               + (B) per-side win-edge triggers (record who clinched first)
 *
 * **Jump semantics — `op: 'assign'`, not `'add'`.** The legacy
 * `accumulate_with_milestone_jumps` calculator replaces the running total
 * with the band base (1.5 at milestone, 3.0 at win) plus linear progression
 * ABOVE that base. The trigger action assigns the new band base; subsequent
 * games' allocator contributions accumulate on top of it.
 *
 * **No endmatch terminal.** BCA 5v5 plays all 25 games regardless of clinch,
 * so triggers fire on the clinching game but the match continues. Endmatch
 * is reserved for race-to-X formats where game play stops on clinch.
 *
 * **Trigger Model Lock-In (2026-05-19):** rebuilt around the locked trigger
 * primitive (one input + one when + one action; constants live ON the trigger
 * row, not in separate thresholds). The previous Slice 3 design that routed
 * jump values through `milestoneJumpValue` / `winThresholdJumpValue` thresholds
 * is replaced — those thresholds were over-architected. Per the locked model,
 * the `1.5` and `3.0` jump values are constants stored on the trigger rows as
 * `{ kind: 'literal' }` action values, LO-editable as properties of the
 * trigger itself.
 *
 * **Why one threshold per kind, not per side:** the milestone target and win
 * target values in Percent 5-Man are league-wide (not handicap-derived per
 * side), so a single `milestoneTarget` and `winTarget` threshold serve both
 * sides. Each per-side trigger reads the relevant shared threshold and
 * filters on its own `side` field. When a Scoring System uses per-side
 * handicap-derived thresholds (e.g., Points 3-Man), it declares them
 * separately as `home<Kind>Target` / `away<Kind>Target`.
 *
 * @see ../runtime.ts — runtime that consumes this composition
 * @see ../operations/read-pref.ts — registered read_pref operation
 * @see ../operations/arithmetic-round-product.ts — registered arithmetic op
 */

// Importing these auto-registers the operations into the threshold registry.
import '../operations/read-pref';
import '../operations/arithmetic-round-product';

import { validatePointsSystem } from '../composition-validator';
import { buildThresholdRow } from '../threshold-resolver';
import type { PointsSystem, Trigger } from '../types';

export interface Percent5ManParams {
  per_game_increment: number;
  milestone_percent: number;
  milestone_jump_value: number;
  win_threshold_jump_value: number;
}

const DEFAULT_PARAMS: Percent5ManParams = {
  per_game_increment: 0.1,
  milestone_percent: 0.7,
  milestone_jump_value: 1.5,
  win_threshold_jump_value: 3.0,
};

/**
 * Build a "side reaches threshold, jump side_points to constant" trigger.
 * The band base value (1.5 for milestone, 3.0 for win) replaces the running
 * total; subsequent games' allocator contributions accumulate on top.
 * The constant is baked into the trigger's action as a literal — it's a
 * stated property of THIS trigger row, LO-editable as a trigger field.
 */
function sideReachesJumpTrigger(
  triggerName: string,
  side: 'home' | 'away',
  thresholdRef: string,
  jumpValue: number,
): Trigger {
  return {
    name: triggerName,
    input: { thresholdRef },
    when: { kind: 'side_reaches', side, sideVar: `${side}_wins` },
    action: {
      target: { kind: 'concrete', variableName: `${side}_points` },
      op: 'assign',
      value: { kind: 'literal', value: jumpValue },
    },
  };
}

/**
 * Build an edge-marker trigger that records which side clinched first when
 * `winTarget` is reached.
 */
function sideReachesEdgeTrigger(
  triggerName: string,
  side: 'home' | 'away',
  thresholdRef: string,
): Trigger {
  return {
    name: triggerName,
    input: { thresholdRef },
    when: { kind: 'side_reaches', side, sideVar: `${side}_wins` },
    action: {
      target: { kind: 'concrete', variableName: 'edge' },
      op: 'assign',
      value: { kind: 'literal', value: side },
    },
  };
}

/**
 * Build the Percentage 5-Man Scoring System's Points System composition.
 *
 * Reads tunable values from league prefs at evaluation time. The
 * `params` argument here is for cross-audit + back-compat; eventually
 * everything flows from prefs via the resolver, no factory params at all.
 */
export function buildPercent5ManComposition(
  params: Partial<Percent5ManParams> = {},
): PointsSystem {
  const p: Percent5ManParams = { ...DEFAULT_PARAMS, ...params };

  const composition: PointsSystem = {
    name: 'percent_5man',
    thresholds: {
      // League-wide comparison values; both sides read the same threshold.
      winTarget: buildThresholdRow({
        name: 'winTarget',
        operationKind: 'read_pref',
        operationArgs: { pref_key: 'games_to_win' },
      }),
      milestoneTarget: buildThresholdRow({
        name: 'milestoneTarget',
        operationKind: 'arithmetic_round_product',
        operationArgs: {
          factor_pref_keys: ['games_to_win', 'milestone_percent'],
        },
      }),
    },
    perGameAllocator: {
      name: 'percent_per_game',
      // per_game_increment is read from prefs at runtime; for now inlined
      // pending per-game allocator audit (next refactor unit).
      winner: { kind: 'fixed', points: p.per_game_increment },
      loser: { kind: 'fixed', points: 0 },
    },
    triggers: [
      // Milestone band — fires when a side reaches the milestone target;
      // assigns side_points to the milestone jump value (replaces running total).
      sideReachesJumpTrigger(
        'homeMilestoneJump',
        'home',
        'milestoneTarget',
        p.milestone_jump_value,
      ),
      sideReachesJumpTrigger(
        'awayMilestoneJump',
        'away',
        'milestoneTarget',
        p.milestone_jump_value,
      ),
      // Win band — fires when a side reaches the win target; assigns
      // side_points to the win jump value (replaces running total) and
      // records which side clinched first via `edge`.
      sideReachesJumpTrigger(
        'homeWinJump',
        'home',
        'winTarget',
        p.win_threshold_jump_value,
      ),
      sideReachesJumpTrigger(
        'awayWinJump',
        'away',
        'winTarget',
        p.win_threshold_jump_value,
      ),
      sideReachesEdgeTrigger('homeWinEdge', 'home', 'winTarget'),
      sideReachesEdgeTrigger('awayWinEdge', 'away', 'winTarget'),
    ],
  };

  validatePointsSystem(composition);
  return composition;
}
