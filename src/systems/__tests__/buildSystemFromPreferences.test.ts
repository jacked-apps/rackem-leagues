/**
 * @fileoverview Tests for buildSystemFromPreferences (Phase 5 Unit 5.1)
 *
 * Covers:
 *   - Fast-path: prefs matching one of the three shipped presets returns
 *     the existing module instance unchanged (characterization equivalence).
 *   - Ad-hoc path: novel combos produce a SystemModule with the right
 *     teamFormat shape, rating dispatch, scoring dispatch, and threshold
 *     dispatch.
 *   - Mechanism dispatch: extra_games / start_points / race_length_adjustment
 *     / none each produce the right threshold mode.
 *   - Graceful fallback: combos with no Layer 1/2/3 implementation yet
 *     return zero-handicap with a console.warn rather than throwing.
 *   - resolveSystem export: thin wrapper produces the same result as
 *     buildSystemFromPreferences.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildSystemFromPreferences } from '../buildSystemFromPreferences';
import { resolveSystem } from '../resolver';
import { bca3v3 } from '../bca3v3';
import { bca5v5 } from '../bca5v5';
import { fargo5v5 } from '../fargo5v5';
import type { ResolvedSystemConfig } from '@/types/resolvedSystemConfig';
import type { SystemOverrides } from '@/types/systemOverrides';

// ============================================================================
// Helpers
// ============================================================================

const NOW = '2026-04-29T00:00:00.000Z';

function makeConfig(overrides: Partial<ResolvedSystemConfig> = {}): ResolvedSystemConfig {
  return {
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
    snapshot_at: NOW,
    ...overrides,
  };
}

function bca3v3Config(): ResolvedSystemConfig {
  return makeConfig({
    lineup_size: 3,
    max_roster_size: 5,
    game_generation: 'double_round_robin',
    handicap_type: 'points',
    mechanism: 'extra_games',
    points_calculator: 'linear_above_threshold',
  });
}

function bca5v5Config(): ResolvedSystemConfig {
  return makeConfig({
    lineup_size: 5,
    max_roster_size: 8,
    game_generation: 'single_round_robin',
    handicap_type: 'percentage',
    mechanism: 'extra_games',
    points_calculator: 'accumulate_with_milestone_jumps',
  });
}

function fargo5v5Config(): ResolvedSystemConfig {
  return makeConfig({
    lineup_size: 5,
    max_roster_size: 8,
    game_generation: 'single_round_robin',
    handicap_type: 'fargo',
    mechanism: 'start_points',
    points_calculator: 'accumulated_per_game',
  });
}

const EMPTY_OVERRIDES: SystemOverrides = {};

// ============================================================================
// Fast-path: known presets
// ============================================================================

describe('buildSystemFromPreferences — preset fast-path', () => {
  it('returns the existing bca3v3 module instance for a 3v3 / points / extra_games config', () => {
    const mod = buildSystemFromPreferences(bca3v3Config(), EMPTY_OVERRIDES);
    expect(mod).toBe(bca3v3);
    expect(mod.key).toBe('bca3v3');
  });

  it('returns the existing bca5v5 module instance for a 5v5 / percentage / extra_games config', () => {
    const mod = buildSystemFromPreferences(bca5v5Config(), EMPTY_OVERRIDES);
    expect(mod).toBe(bca5v5);
    expect(mod.key).toBe('bca5v5');
  });

  it('returns the existing fargo5v5 module instance for a 5v5 / fargo / start_points config', () => {
    const mod = buildSystemFromPreferences(fargo5v5Config(), EMPTY_OVERRIDES);
    expect(mod).toBe(fargo5v5);
    expect(mod.key).toBe('fargo5v5');
  });

  it('does NOT fast-path when one canonical axis differs (lineup_size 4 vs 3)', () => {
    const mod = buildSystemFromPreferences(
      makeConfig({
        lineup_size: 4,
        max_roster_size: 6,
        game_generation: 'double_round_robin',
        handicap_type: 'points',
        mechanism: 'extra_games',
        points_calculator: 'linear_above_threshold',
      }),
      EMPTY_OVERRIDES,
    );
    expect(mod).not.toBe(bca3v3);
    expect(mod.key).toMatch(/^custom_/);
  });

  it('does NOT fast-path when points_calculator differs (Fargo + games-won is ad-hoc)', () => {
    const mod = buildSystemFromPreferences(
      makeConfig({
        lineup_size: 5,
        max_roster_size: 8,
        game_generation: 'single_round_robin',
        handicap_type: 'fargo',
        mechanism: 'extra_games',
        points_calculator: 'linear_above_threshold',
      }),
      EMPTY_OVERRIDES,
    );
    expect(mod).not.toBe(fargo5v5);
    expect(mod.key).toMatch(/^custom_/);
  });
});

// ============================================================================
// Ad-hoc path: teamFormat
// ============================================================================

describe('buildSystemFromPreferences — ad-hoc teamFormat derivation', () => {
  it('derives teamFormat from prefs (4v4 single-RR + Fargo)', () => {
    const mod = buildSystemFromPreferences(
      makeConfig({
        lineup_size: 4,
        max_roster_size: 6,
        game_generation: 'single_round_robin',
        handicap_type: 'fargo',
        mechanism: 'extra_games',
        points_calculator: 'linear_above_threshold',
      }),
      EMPTY_OVERRIDES,
    );
    expect(mod.teamFormat).toEqual({
      lineupSize: 4,
      maxRosterSize: 6,
      gameGeneration: 'single_round_robin',
    });
  });

  it('falls back to single_round_robin when game_generation is unknown', () => {
    const mod = buildSystemFromPreferences(
      makeConfig({
        lineup_size: 6,
        max_roster_size: 10,
        game_generation: 'experimental_format',
      }),
      EMPTY_OVERRIDES,
    );
    expect(mod.teamFormat.gameGeneration).toBe('single_round_robin');
  });

  it('produces a deterministic ad-hoc key', () => {
    const mod = buildSystemFromPreferences(
      makeConfig({
        lineup_size: 4,
        handicap_type: 'fargo',
        mechanism: 'extra_games',
        points_calculator: 'linear_above_threshold',
      }),
      EMPTY_OVERRIDES,
    );
    expect(mod.key).toBe('custom_4v4_fargo_extra_games_linear_above_threshold');
  });
});

// ============================================================================
// Ad-hoc path: rating dispatch
// ============================================================================

describe('buildSystemFromPreferences — rating dispatch', () => {
  it('routes handicap_type=points to bca3v3 rating shape', () => {
    const mod = buildSystemFromPreferences(
      makeConfig({
        lineup_size: 4,
        handicap_type: 'points',
        mechanism: 'extra_games',
        points_calculator: 'linear_above_threshold',
      }),
      EMPTY_OVERRIDES,
    );
    // bca3v3 displays signed integers
    expect(mod.rating.displayFormat(2)).toBe('+2');
    expect(mod.rating.displayFormat(-1)).toBe('-1');
    expect(mod.rating.requiresManualEntry).toBe(false);
  });

  it('routes handicap_type=percentage to bca5v5 rating shape', () => {
    const mod = buildSystemFromPreferences(
      makeConfig({
        lineup_size: 6,
        handicap_type: 'percentage',
        mechanism: 'extra_games',
        points_calculator: 'linear_above_threshold',
      }),
      EMPTY_OVERRIDES,
    );
    expect(mod.rating.displayFormat(85)).toBe('85%');
  });

  it('routes handicap_type=fargo to fargo5v5 rating shape with manual entry', () => {
    const mod = buildSystemFromPreferences(
      makeConfig({
        lineup_size: 4,
        handicap_type: 'fargo',
        mechanism: 'start_points',
        points_calculator: 'accumulated_per_game',
      }),
      EMPTY_OVERRIDES,
    );
    expect(mod.rating.requiresManualEntry).toBe(true);
    expect(mod.rating.displayFormat(575)).toBe('575');
  });

  it('provides a stub for handicap_type=skill_level (BCAPL SL)', () => {
    const mod = buildSystemFromPreferences(
      makeConfig({
        lineup_size: 5,
        handicap_type: 'skill_level',
        mechanism: 'race_length_adjustment',
        pairing_format: 'race_to_n',
        points_calculator: null,
        race_length: 7,
      }),
      EMPTY_OVERRIDES,
    );
    expect(mod.rating.displayFormat(5)).toBe('SL5');
    expect(mod.rating.validate(5)).toEqual({ ok: true, value: 5 });
    expect(mod.rating.validate(0).ok).toBe(false);
    expect(mod.rating.validate(10).ok).toBe(false);
    expect(mod.rating.validate(5.5).ok).toBe(false);
  });

  it('provides a stub for handicap_type=none (no-handicap leagues)', () => {
    const mod = buildSystemFromPreferences(
      makeConfig({
        handicap_type: 'none',
        mechanism: 'none',
      }),
      EMPTY_OVERRIDES,
    );
    expect(mod.rating.displayFormat(500)).toBe('—');
    expect(mod.rating.validate(0)).toEqual({ ok: true, value: 0 });
    expect(mod.rating.validate('not-a-number').ok).toBe(false);
  });

  it('falls back to bca5v5 rating shape with a warn for unknown handicap_type', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mod = buildSystemFromPreferences(
      makeConfig({ handicap_type: 'experimental_rating' }),
      EMPTY_OVERRIDES,
    );
    expect(mod.rating.displayFormat(50)).toBe('50%');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

// ============================================================================
// Ad-hoc path: scoring dispatch
// ============================================================================

describe('buildSystemFromPreferences — scoring dispatch', () => {
  it('routes points_calculator=accumulated_per_game to fargo5v5 scoring (points_accumulated)', () => {
    const mod = buildSystemFromPreferences(
      makeConfig({
        lineup_size: 4,
        handicap_type: 'fargo',
        mechanism: 'start_points',
        points_calculator: 'accumulated_per_game',
      }),
      EMPTY_OVERRIDES,
    );
    expect(mod.scoring.method).toBe('points_accumulated');
    // Sanity: recordGameOutcome works for a Fargo-style outcome
    const recorded = mod.scoring.recordGameOutcome(
      { winnerTeam: 'home', loserValue: 4 },
      EMPTY_OVERRIDES,
    );
    expect(recorded.loser_value).toBe(4);
  });

  it('stubs points_calculator=linear_above_threshold (legacy paths still in use)', () => {
    const mod = buildSystemFromPreferences(
      makeConfig({
        lineup_size: 4,
        handicap_type: 'points',
        mechanism: 'extra_games',
        points_calculator: 'linear_above_threshold',
      }),
      EMPTY_OVERRIDES,
    );
    expect(mod.scoring.method).toBe('games_won_with_team_bonus');
    expect(() =>
      mod.scoring.recordGameOutcome({ winnerTeam: 'home' }, EMPTY_OVERRIDES),
    ).toThrow(/not yet wired/i);
  });

  // Note: the `race_winner` calculator type was removed from the registry's
  // value space per the v2 plan's architectural decision (race-to-N produces
  // one game-win per race; no special calculator is needed for that case).
  // Race-format leagues use null or one of the registered calculators based
  // on what scoring math the LO actually wants. The "race_winner with Phase 3
  // reference" test that lived here previously is obsolete.

  it('falls back to NOT_YET_WIRED stubs with a warn for an unknown points_calculator', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mod = buildSystemFromPreferences(
      makeConfig({ points_calculator: 'experimental_calc' as ResolvedSystemConfig['points_calculator'] }),
      EMPTY_OVERRIDES,
    );
    expect(mod.scoring.method).toBe('games_won_with_team_bonus');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

// ============================================================================
// Ad-hoc path: threshold dispatch
// ============================================================================

describe('buildSystemFromPreferences — threshold dispatch by mechanism', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('mechanism=extra_games + handicap_type=points → 3v3 chart values', () => {
    const mod = buildSystemFromPreferences(
      makeConfig({
        lineup_size: 4,
        handicap_type: 'points',
        mechanism: 'extra_games',
        points_calculator: 'linear_above_threshold',
      }),
      EMPTY_OVERRIDES,
    );
    expect(mod.threshold.mode).toBe('extra_games');
    if (mod.threshold.mode === 'extra_games') {
      // handicap diff 0 from the 3v3 chart: games_to_win = 10
      const result = mod.threshold.compute(0, EMPTY_OVERRIDES);
      expect(result.games_to_win).toBe(10);
    }
  });

  it('mechanism=extra_games + handicap_type=percentage → 5v5 chart values', () => {
    const mod = buildSystemFromPreferences(
      makeConfig({
        lineup_size: 6,
        handicap_type: 'percentage',
        mechanism: 'extra_games',
        points_calculator: 'linear_above_threshold',
      }),
      EMPTY_OVERRIDES,
    );
    expect(mod.threshold.mode).toBe('extra_games');
    if (mod.threshold.mode === 'extra_games') {
      // handicap diff 0 from the 5v5 chart: games_to_win = 13 (decisive)
      const result = mod.threshold.compute(0, EMPTY_OVERRIDES);
      expect(result.games_to_win).toBeGreaterThan(0);
    }
  });

  it('mechanism=extra_games + handicap_type=fargo → zero-handicap fallback with warn (no Layer 1 yet)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mod = buildSystemFromPreferences(
      makeConfig({
        lineup_size: 4,
        handicap_type: 'fargo',
        mechanism: 'extra_games',
        points_calculator: 'linear_above_threshold',
      }),
      EMPTY_OVERRIDES,
    );
    expect(mod.threshold.mode).toBe('extra_games');
    if (mod.threshold.mode === 'extra_games') {
      const result = mod.threshold.compute(50, EMPTY_OVERRIDES);
      expect(result).toEqual({ games_to_win: 0, games_to_tie: null, games_to_lose: null });
      expect(warn).toHaveBeenCalled();
    }
  });

  it('mechanism=start_points + handicap_type=fargo → fargo5v5 start-points formula (works for any roster)', () => {
    const mod = buildSystemFromPreferences(
      makeConfig({
        lineup_size: 4,
        handicap_type: 'fargo',
        mechanism: 'start_points',
        points_calculator: 'accumulated_per_game',
      }),
      EMPTY_OVERRIDES,
    );
    expect(mod.threshold.mode).toBe('start_points');
    if (mod.threshold.mode === 'start_points') {
      // 4v4 even-rated teams → 0 start points, even
      const result = mod.threshold.compute(
        [500, 500, 500, 500],
        [500, 500, 500, 500],
        EMPTY_OVERRIDES,
      );
      expect(result.startPointsForWeakerTeam).toBe(0);
      expect(result.weakerTeam).toBe('even');
    }
  });

  it('mechanism=start_points + non-fargo handicap → zero start-points fallback with warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mod = buildSystemFromPreferences(
      makeConfig({
        handicap_type: 'percentage',
        mechanism: 'start_points',
        points_calculator: 'accumulated_per_game',
      }),
      EMPTY_OVERRIDES,
    );
    expect(mod.threshold.mode).toBe('start_points');
    if (mod.threshold.mode === 'start_points') {
      const result = mod.threshold.compute([60], [40], EMPTY_OVERRIDES);
      expect(result).toEqual({ startPointsForWeakerTeam: 0, weakerTeam: 'even' });
      expect(warn).toHaveBeenCalled();
    }
  });

  it('mechanism=race_length_adjustment → equal race lengths from prefs.race_length with warn (no chart yet)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mod = buildSystemFromPreferences(
      makeConfig({
        handicap_type: 'skill_level',
        mechanism: 'race_length_adjustment',
        pairing_format: 'race_to_n',
        points_calculator: null,
        race_length: 5,
      }),
      EMPTY_OVERRIDES,
    );
    expect(mod.threshold.mode).toBe('race_length_adjustment');
    if (mod.threshold.mode === 'race_length_adjustment') {
      const result = mod.threshold.compute([5], [3], EMPTY_OVERRIDES);
      expect(result).toEqual({ homeRaceLength: 5, awayRaceLength: 5 });
      expect(warn).toHaveBeenCalled();
    }
  });

  it('mechanism=race_length_adjustment → defaults to 7 when prefs.race_length is null', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mod = buildSystemFromPreferences(
      makeConfig({
        handicap_type: 'skill_level',
        mechanism: 'race_length_adjustment',
        pairing_format: 'race_to_n',
        points_calculator: null,
        race_length: null,
      }),
      EMPTY_OVERRIDES,
    );
    if (mod.threshold.mode === 'race_length_adjustment') {
      const result = mod.threshold.compute([5], [3], EMPTY_OVERRIDES);
      expect(result.homeRaceLength).toBe(7);
      expect(result.awayRaceLength).toBe(7);
    }
  });

  it('mechanism=none → zero-handicap extra_games shape (unhandicapped match)', () => {
    const mod = buildSystemFromPreferences(
      makeConfig({
        handicap_type: 'none',
        mechanism: 'none',
      }),
      EMPTY_OVERRIDES,
    );
    expect(mod.threshold.mode).toBe('extra_games');
    if (mod.threshold.mode === 'extra_games') {
      const result = mod.threshold.compute(99, EMPTY_OVERRIDES);
      expect(result).toEqual({ games_to_win: 0, games_to_tie: null, games_to_lose: null });
    }
  });

  it('unknown mechanism → zero-handicap fallback with warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mod = buildSystemFromPreferences(
      makeConfig({
        mechanism: 'experimental_mechanism' as ResolvedSystemConfig['mechanism'],
      }),
      EMPTY_OVERRIDES,
    );
    expect(mod.threshold.mode).toBe('extra_games');
    expect(warn).toHaveBeenCalled();
  });
});

// ============================================================================
// Integration with resolver.ts (resolveSystem export)
// ============================================================================

describe('resolveSystem (resolver.ts wrapper)', () => {
  it('produces the same result as buildSystemFromPreferences for preset configs', () => {
    expect(resolveSystem(bca3v3Config(), EMPTY_OVERRIDES)).toBe(bca3v3);
    expect(resolveSystem(bca5v5Config(), EMPTY_OVERRIDES)).toBe(bca5v5);
    expect(resolveSystem(fargo5v5Config(), EMPTY_OVERRIDES)).toBe(fargo5v5);
  });

  it('produces an ad-hoc module for non-preset configs', () => {
    const mod = resolveSystem(
      makeConfig({
        lineup_size: 4,
        handicap_type: 'fargo',
        mechanism: 'start_points',
        points_calculator: 'accumulated_per_game',
      }),
      EMPTY_OVERRIDES,
    );
    expect(mod.key).toBe('custom_4v4_fargo_start_points_accumulated_per_game');
    expect(mod.threshold.mode).toBe('start_points');
  });
});
