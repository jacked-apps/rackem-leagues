/**
 * @fileoverview Percentage 5-Man Scoring System — Points System composition.
 *
 * Per the locked Points System README + the Ed-walked decomposition:
 *
 *   composition = (A) per-game allocator
 *               + (B) milestone trigger
 *               + (B) win-threshold trigger
 *
 * Where:
 * - (A) winner = `per_game_increment` (default 0.1), loser = 0
 * - (B) milestone: when any-side wins reaches `milestoneTarget = round(games_to_win × milestone_percent)`,
 *   jump that side's points to `milestone_jump_value` (default 1.5)
 * - (B) win: when any-side wins reaches `winTarget = games_to_win`,
 *   jump that side's points to `win_threshold_jump_value` (default 3.0)
 *
 * Cross-audited against the legacy `accumulate_with_milestone_jumps` bundled
 * calculator (`src/systems/calculators/accumulate_with_milestone_jumps.ts`).
 *
 * @see ./points-3-man.ts — the other prepackaged composition
 */

import { computedThreshold, constantThreshold, prefThreshold } from '../threshold-helpers';
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
 * Build a single-action "jump points to value when any side reaches threshold" trigger.
 * The triggering side is resolved at fire time and used to scope the target variable.
 */
function jumpToOnReach(
  triggerName: string,
  thresholdRef: string,
  jumpValue: number,
): Trigger {
  return {
    name: triggerName,
    when: {
      kind: 'side_reaches',
      thresholdRef,
      side: 'any',
      sideVarTemplate: '<side>_wins',
    },
    action: {
      target: { kind: 'side_scoped', variableNameTemplate: '<side>_points' },
      op: 'assign',
      value: { kind: 'literal', value: jumpValue },
    },
  };
}

/**
 * Build the Percentage 5-Man Scoring System's Points System composition.
 *
 * Note: `winTarget` is read from the `games_to_win` league preference (Percentage
 * 5-Man's chart provides this per-match). Other params are passed as the
 * composition factory's argument so cross-audit can vary them.
 */
export function buildPercent5ManComposition(
  params: Partial<Percent5ManParams> = {},
): PointsSystem {
  const p: Percent5ManParams = { ...DEFAULT_PARAMS, ...params };

  return {
    name: 'percent_5man',
    thresholds: {
      winTarget: prefThreshold('winTarget', 'games_to_win'),
      milestoneTarget: computedThreshold('milestoneTarget', (inputs) =>
        Math.round((inputs.prefs.games_to_win as number) * p.milestone_percent),
      ),
      // jump values are constants, but we model them as thresholds for
      // consistency with the "every value flows through trigger machinery" principle
      milestoneJumpValue: constantThreshold('milestoneJumpValue', p.milestone_jump_value),
      winThresholdJumpValue: constantThreshold('winThresholdJumpValue', p.win_threshold_jump_value),
    },
    perGameAllocator: {
      name: 'percent_per_game',
      winner: { kind: 'fixed', points: p.per_game_increment },
      loser: { kind: 'fixed', points: 0 },
    },
    triggers: [
      jumpToOnReach('milestone_jump', 'milestoneTarget', p.milestone_jump_value),
      jumpToOnReach('win_jump', 'winTarget', p.win_threshold_jump_value),
    ],
  };
}
