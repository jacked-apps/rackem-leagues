/**
 * @fileoverview The one part of buildSystemFromPreferences the live app uses:
 * which handicap method a league gets. composeMatchThresholds reads
 * `system.handicapMechanism` to set each team's targets when a lineup swap
 * is approved mid-match, so a league handed the wrong method gets the wrong
 * targets.
 *
 * Two rules guarded here (found by the mutation run, U8):
 *   1. A league matches a shipped preset only if EVERY defining setting
 *      matches. One different setting = a custom league, not the preset.
 *   2. "No handicap" in EITHER setting (handicap type or mechanism) means no
 *      handicap. The other setting can't switch one back on.
 *
 * @see src/utils/match/composeMatchThresholds.ts — the live reader
 * @see docs/plans/2026-11-17-001-feat-trustworthy-tests-plan.md (U8)
 */

import { describe, it, expect } from 'vitest';
import { buildSystemFromPreferences } from '../buildSystemFromPreferences';
import { bca3v3 } from '../bca3v3';
import { bca5v5 } from '../bca5v5';
import { fargo5v5 } from '../fargo5v5';
import type { ResolvedSystemConfig } from '@/types/resolvedSystemConfig';
import type { SystemModule } from '../types';

const config = (overrides: Partial<ResolvedSystemConfig>): ResolvedSystemConfig => ({
  lineup_size: 5,
  max_roster_size: 8,
  game_generation: 'single_round_robin',
  pairing_format: 'single_rack',
  race_length: null,
  points_calculator: 'linear_above_threshold',
  win_condition: 'games',
  handicap_type: 'percentage',
  mechanism: 'extra_games',
  threshold_chart_id: null,
  standings_sort: ['match_wins', 'games_won', 'points_earned'],
  tiebreaker_trigger: 'never',
  tiebreaker_format: 'accept_tie',
  overrides: {},
  snapshot_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

/** The five settings that define each shipped preset. */
const PRESETS: [string, SystemModule, Partial<ResolvedSystemConfig>][] = [
  ['bca3v3', bca3v3, { lineup_size: 3, handicap_type: 'points', game_generation: 'double_round_robin', mechanism: 'extra_games', points_calculator: 'linear_above_threshold' }],
  ['bca5v5', bca5v5, { lineup_size: 5, handicap_type: 'percentage', game_generation: 'single_round_robin', mechanism: 'extra_games', points_calculator: 'accumulate_with_milestone_jumps' }],
  ['fargo5v5', fargo5v5, { lineup_size: 5, handicap_type: 'fargo', game_generation: 'single_round_robin', mechanism: 'start_points', points_calculator: 'accumulated_per_game' }],
];

/** One setting changed to a different real value. */
const ONE_DIFFERENT: [keyof ResolvedSystemConfig, (v: unknown) => unknown][] = [
  ['lineup_size', (v) => (v === 3 ? 4 : 3)],
  ['handicap_type', (v) => (v === 'none' ? 'points' : 'none')],
  ['game_generation', (v) => (v === 'single_round_robin' ? 'double_round_robin' : 'single_round_robin')],
  ['mechanism', (v) => (v === 'none' ? 'extra_games' : 'none')],
  ['points_calculator', () => null],
];

describe('a league is a preset only when every defining setting matches', () => {
  const cases = PRESETS.flatMap(([name, preset, axes]) =>
    ONE_DIFFERENT.map(([key, change]) => [name, key, preset, { ...axes, [key]: change(axes[key]) }] as const));

  it.each(cases)('%s with a different %s is a custom league', (_name, _key, preset, axes) => {
    const system = buildSystemFromPreferences(config(axes), {});
    expect(system).not.toBe(preset);
    expect(system.key).toMatch(/^custom_/);
  });

  it.each(PRESETS)('%s with all five settings matching is the preset', (_name, preset, axes) => {
    expect(buildSystemFromPreferences(config(axes), {})).toBe(preset);
  });
});

describe('"no handicap" in either setting means no handicap', () => {
  // The no-handicap method never moves a target, however far apart the teams'
  // ratings are (99 here). A real chart would.
  const expectNoHandicap = (system: SystemModule) => {
    const m = system.handicapMechanism;
    expect(m?.kind).toBe('extra_games');
    if (m?.kind !== 'extra_games') throw new Error('expected the no-handicap method');
    expect(m.compute(99, {})).toEqual({ games_to_win: 0, games_to_tie: null, games_to_lose: null });
  };

  it('handicap type "none" with mechanism "extra games" → no handicap', () => {
    expectNoHandicap(buildSystemFromPreferences(config({ lineup_size: 4, handicap_type: 'none', mechanism: 'extra_games' }), {}));
  });

  it('mechanism "none" with handicap type "points" → no handicap', () => {
    expectNoHandicap(buildSystemFromPreferences(config({ lineup_size: 4, handicap_type: 'points', mechanism: 'none' }), {}));
  });
});
