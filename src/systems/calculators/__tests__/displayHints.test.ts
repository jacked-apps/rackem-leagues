/**
 * @fileoverview Tests for the display-hint declarations on the three
 * registered calculators (Unit 2 of the unified-scoreboard plan).
 *
 * Each calculator either declares schema-derived `displayHints`, exposes the
 * `getDisplayHints` escape hatch, or declares nothing at all. These tests
 * verify the actual declarations match the plan's intent so the unified
 * scoreboard's role-renderer (Unit 3) has a stable contract to read against.
 *
 * Coverage:
 *   - `accumulate_with_milestone_jumps`: declares `displayHints` for
 *     `milestone_jump_value` with role `'milestone'`.
 *   - `linear_above_threshold`: declares NO display hints (its
 *     `per_extra_game_multiplier` param is a rate, not a visual landmark).
 *   - `accumulated_per_game`: uses `getDisplayHints` escape hatch (its
 *     `keyof P` is `'winner' | 'loser'`, structural — schema-derived doesn't
 *     fit). Returns per-side `progress_target` hints describing the points
 *     at stake for each side.
 *   - Registry lookup preserves the declarations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { accumulateWithMilestoneJumps } from '../accumulate_with_milestone_jumps';
import { linearAboveThreshold } from '../linear_above_threshold';
import {
  accumulatedPerGame,
  ACCUMULATED_PER_GAME_DEFAULT_PARAMS,
} from '../accumulated_per_game';
import {
  getCalculator,
  registerTestedPresetCalculators,
  clearRegistry,
} from '../index';

describe('displayHints — accumulate_with_milestone_jumps', () => {
  it('declares milestone_jump_value with role "milestone"', () => {
    expect(accumulateWithMilestoneJumps.displayHints).toBeDefined();
    expect(
      accumulateWithMilestoneJumps.displayHints?.milestone_jump_value?.role,
    ).toBe('milestone');
    expect(
      accumulateWithMilestoneJumps.displayHints?.milestone_jump_value?.label,
    ).toBe('Milestone bonus');
  });

  it('does not declare hints for rate parameters', () => {
    // per_game_increment and win_threshold_jump_value are rate / numeric
    // values, not visual landmarks — intentionally omitted.
    expect(
      accumulateWithMilestoneJumps.displayHints?.per_game_increment,
    ).toBeUndefined();
    expect(
      accumulateWithMilestoneJumps.displayHints?.win_threshold_jump_value,
    ).toBeUndefined();
    // milestone_percent could be surfaced but isn't in v1 — the milestone
    // role-renderer derives the in-game position from milestone_percent ×
    // games_to_win at render time (Unit 3).
    expect(
      accumulateWithMilestoneJumps.displayHints?.milestone_percent,
    ).toBeUndefined();
  });

  it('does not expose getDisplayHints escape hatch (schema-derived only)', () => {
    expect(accumulateWithMilestoneJumps.getDisplayHints).toBeUndefined();
  });
});

describe('displayHints — linear_above_threshold', () => {
  it('declares no display hints (rate-multiplier param has no visual landmark)', () => {
    expect(linearAboveThreshold.displayHints).toBeUndefined();
    expect(linearAboveThreshold.getDisplayHints).toBeUndefined();
  });
});

describe('displayHints — accumulated_per_game', () => {
  it('declares no display hints (per-side per-game amounts are static, not live)', () => {
    // Per Ed 2026-05-04 smoke-test feedback: the per-side scoring rules
    // (winner: 10, loser: 0–7 for default Fargo 10-7) are static league
    // config every player already knows. Surfacing them on the live
    // scoreboard is noise. The escape-hatch interface remains available
    // on the calculator type for future per-game calculators with
    // genuinely useful display info.
    expect(accumulatedPerGame.getDisplayHints).toBeUndefined();
    expect(accumulatedPerGame.displayHints).toBeUndefined();
  });

  it('default params still validate (test fixture survives the hint removal)', () => {
    // Sanity: the default params object still exists and remains valid
    // even though we don't surface them as display hints anymore.
    expect(ACCUMULATED_PER_GAME_DEFAULT_PARAMS.winner).toEqual({
      kind: 'fixed',
      points: 10,
    });
    expect(ACCUMULATED_PER_GAME_DEFAULT_PARAMS.loser).toEqual({
      kind: 'counter',
      min: 0,
      max: 7,
      label: 'Balls pocketed',
    });
  });
});

describe('displayHints — registry lookup preserves declarations', () => {
  beforeEach(() => {
    clearRegistry();
    registerTestedPresetCalculators();
  });

  it('returns accumulate_with_milestone_jumps with displayHints intact', () => {
    const calc = getCalculator('accumulate_with_milestone_jumps');
    expect(calc?.displayHints).toBeDefined();
    expect(calc?.displayHints?.milestone_jump_value?.role).toBe('milestone');
  });

  it('returns linear_above_threshold without display declarations', () => {
    const calc = getCalculator('linear_above_threshold');
    expect(calc?.displayHints).toBeUndefined();
    expect(calc?.getDisplayHints).toBeUndefined();
  });

  it('returns accumulated_per_game without display hints', () => {
    const calc = getCalculator('accumulated_per_game');
    expect(calc?.getDisplayHints).toBeUndefined();
    expect(calc?.displayHints).toBeUndefined();
  });
});
