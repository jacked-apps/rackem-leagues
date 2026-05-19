/**
 * @fileoverview Percentage 5-Man Scoring System — Points System composition.
 *
 * Per the locked Points System README + the Ed-walked decomposition:
 *   composition = (A) per-game allocator + (B) milestone trigger + (B) win-threshold trigger
 *
 * **Slice 3 of the Threshold refactor (2026-05-19):** migrated to data-driven
 * `ThresholdRow`s + FIXES the Finding 1 drift from the architectural audit:
 *
 * 1. Thresholds now reference registered operations (`read_pref`,
 *    `arithmetic_round_product`) instead of inlining compute functions.
 *
 * 2. Jump values that were previously inlined as `{ kind: 'literal', value: 1.5 }`
 *    in trigger actions now flow through the named-threshold system via
 *    `threshold_ref`. The `milestoneJumpValue` and `winThresholdJumpValue`
 *    thresholds (which existed but were dead in earlier code) are now
 *    actually consumed by triggers. Per the single-mechanism principle —
 *    every value flows through one path, no shortcuts.
 *
 * 3. Receipt triggers assign the jump-value thresholds to variables so
 *    they're consistently surfaced for future display, same way the chart
 *    targets are.
 *
 * Cross-audited against the legacy accumulate_with_milestone_jumps calculator.
 *
 * @see ../runtime.ts — runtime that consumes this composition
 * @see ../operations/read-pref.ts — registered read_pref operation
 * @see ../operations/arithmetic-round-product.ts — registered arithmetic op
 */

// Importing these auto-registers the operations into the threshold registry.
import '../operations/read-pref';
import '../operations/arithmetic-round-product';

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
 * Receipt trigger that assigns the named threshold's value to a variable of
 * the same name. Common pattern for surfacing chart/pref values into the
 * variable namespace so LO can display them and other primitives can read them.
 */
function assignThresholdToSelf(name: string): Trigger {
  return {
    name: `assign_${name}`,
    when: { kind: 'receipt', thresholdRef: name },
    action: {
      target: { kind: 'concrete', variableName: name },
      op: 'assign',
      value: { kind: 'threshold_ref', thresholdRef: name },
    },
  };
}

/**
 * Build a "jump points to threshold value when side reaches another threshold" trigger.
 * Both halves reference thresholds by name — no inline literals.
 */
function jumpToThresholdOnReach(
  triggerName: string,
  firingThresholdRef: string,
  valueThresholdRef: string,
): Trigger {
  return {
    name: triggerName,
    when: {
      kind: 'side_reaches',
      thresholdRef: firingThresholdRef,
      side: 'any',
      sideVarTemplate: '<side>_wins',
    },
    action: {
      target: { kind: 'side_scoped', variableNameTemplate: '<side>_points' },
      op: 'assign',
      value: { kind: 'threshold_ref', thresholdRef: valueThresholdRef },
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
  void p; // params shape preserved for back-compat; actual values come from prefs

  return {
    name: 'percent_5man',
    thresholds: {
      // The firing-condition thresholds — when a side reaches these values, triggers fire.
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
      // The jump-value thresholds — actually consumed by triggers' actions
      // (Finding 1 fix: previously these existed but were dead code).
      milestoneJumpValue: buildThresholdRow({
        name: 'milestoneJumpValue',
        operationKind: 'read_pref',
        operationArgs: { pref_key: 'milestone_jump_value' },
      }),
      winThresholdJumpValue: buildThresholdRow({
        name: 'winThresholdJumpValue',
        operationKind: 'read_pref',
        operationArgs: { pref_key: 'win_threshold_jump_value' },
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
      // Receipt triggers — surface the threshold values into the variable
      // namespace so they're displayable + readable by downstream code via
      // the same mechanism as chart targets.
      assignThresholdToSelf('winTarget'),
      assignThresholdToSelf('milestoneTarget'),
      assignThresholdToSelf('milestoneJumpValue'),
      assignThresholdToSelf('winThresholdJumpValue'),
      // Play-time jump triggers — both halves reference thresholds by name.
      jumpToThresholdOnReach('milestone_jump', 'milestoneTarget', 'milestoneJumpValue'),
      jumpToThresholdOnReach('win_jump', 'winTarget', 'winThresholdJumpValue'),
    ],
  };
}
