/**
 * @fileoverview Runtime resolver: build a SystemModule from resolved preferences
 *
 * R18 of the modular-league-system plan. Given a `ResolvedSystemConfig`
 * (the shape held in `match.system_snapshot` and produced by the
 * `resolved_league_preferences` view), produce a SystemModule the scoring
 * runtime can use to:
 *   - validate / display ratings
 *   - record per-game outcomes
 *   - compute the final match result
 *   - look up handicap thresholds (games-to-win / start-points / race lengths)
 *
 * Two paths:
 *   1. Fast-path — when the preferences exactly match one of the three
 *      shipped presets (bca3v3 / bca5v5 / fargo5v5), the existing module
 *      instance is returned unchanged. This preserves characterization
 *      equivalence: the three known leagues route through the exact same
 *      code post-refactor as pre-refactor.
 *   2. Ad-hoc path — for any other combo (4v4 + Fargo + games-won, BCA
 *      points at non-canonical lineup size, etc.) a new SystemModule is
 *      assembled by dispatching each capability section on the resolved
 *      axes. The ad-hoc module's `key` is a deterministic fingerprint
 *      (e.g. `"custom_4v4_fargo_extra_games_winner_takes_all"`) so logs
 *      and snapshots can identify which combo was resolved.
 *
 * Graceful-degradation principle: when the resolver hits a combo with no
 * Layer 1/2/3 implementation yet (Unit 3.x is still in flight), the
 * threshold returns a zero-handicap output and the runtime keeps going
 * with a console.warn. The plan's "match doesn't break, gets played,
 * honest labels" bar is honored — we never throw because a combo isn't
 * fully wired.
 *
 * @see docs/plans/2026-04-28-001-feat-modular-league-system-plan.md (Unit 5.1)
 */

import type { SystemOverrides } from '@/types/systemOverrides';
import type { ResolvedSystemConfig } from '@/types/resolvedSystemConfig';
import type { SystemModule } from './types';
import { bca3v3 } from './bca3v3';
import { bca5v5 } from './bca5v5';
import { fargo5v5 } from './fargo5v5';
import { getTeamGeometry } from './team-geometry';
import { getMatchFormat } from './match-format';
import {
  getHandicapSystem,
  type HandicapSystem,
  type HandicapType,
} from './handicap-systems';
import {
  gamesNeeded3v3Chart,
  gamesNeeded5v5Chart,
  fargoFormulaChart,
  type ThresholdChart,
  type GamesNeededChart,
  type FargoFormulaChart,
  type RaceLengthChart,
} from './threshold-charts';
import {
  createExtraGamesMechanism,
  createStartPointsMechanism,
  createRaceLengthAdjustmentMechanism,
  noneMechanism,
  type HandicapMechanism,
} from './handicap-mechanisms';
import { buildPoints3ManComposition } from './points-system/compositions/points-3-man';
import { buildPercent5ManComposition } from './points-system/compositions/percent-5-man';
import { buildTenPointComposition } from './points-system/compositions/10-point';
import type { PointsSystem } from './points-system/types';

// ============================================================================
// Preset detection (fast-path)
// ============================================================================

/**
 * Return one of the three shipped preset modules if `prefs` matches its
 * canonical shape exactly, otherwise null. Match is by the structural axes
 * that uniquely identify a preset — not every field has to match (e.g.
 * `standings_sort` priority can differ without changing the underlying
 * scoring math).
 */
function matchPreset(prefs: ResolvedSystemConfig): SystemModule | null {
  const { lineup_size, handicap_type, game_generation, mechanism, points_calculator } = prefs;

  if (
    lineup_size === 3 &&
    handicap_type === 'points' &&
    game_generation === 'double_round_robin' &&
    mechanism === 'extra_games' &&
    points_calculator === 'linear_above_threshold'
  ) {
    return bca3v3;
  }

  if (
    lineup_size === 5 &&
    handicap_type === 'percentage' &&
    game_generation === 'single_round_robin' &&
    mechanism === 'extra_games' &&
    points_calculator === 'accumulate_with_milestone_jumps'
  ) {
    return bca5v5;
  }

  if (
    lineup_size === 5 &&
    handicap_type === 'fargo' &&
    game_generation === 'single_round_robin' &&
    mechanism === 'start_points' &&
    points_calculator === 'accumulated_per_game'
  ) {
    return fargo5v5;
  }

  return null;
}

// ============================================================================
// Ad-hoc key fingerprint
// ============================================================================

/**
 * Deterministic key for an ad-hoc resolved module. Used in logs, snapshot
 * `key` field, and test assertions. Format:
 *   `custom_<lineup>v<lineup>_<handicap>_<mechanism>_<calculator>`
 */
function deriveAdHocKey(prefs: ResolvedSystemConfig): string {
  const { lineup_size, handicap_type, mechanism, points_calculator } = prefs;
  return `custom_${lineup_size}v${lineup_size}_${handicap_type}_${mechanism}_${points_calculator ?? 'null'}`;
}

// ============================================================================
// Handicap System Module dispatch
// ============================================================================

/**
 * Pick a Handicap System Module for the ad-hoc module by handicap_type.
 *
 * Mirrors pickRating's routing for parity (both fields coexist during the
 * strangler-fig transition). For the four shipping variants the registry
 * returns the Module instance; for `handicap_type='none'` the field is
 * `null` per the Handicap Systems blueprint ("no Module" rather than a
 * 5th variant). For unknown handicap_type values, falls back to null with
 * a warn, matching the resolver's graceful-degradation pattern.
 */
function pickHandicapSystem(handicapType: string): HandicapSystem | null {
  if (
    handicapType === 'points' ||
    handicapType === 'percentage' ||
    handicapType === 'fargo' ||
    handicapType === 'skill_level'
  ) {
    return getHandicapSystem(handicapType as HandicapType);
  }
  if (handicapType === 'none') {
    return null;
  }
  console.warn(
    `[buildSystemFromPreferences] Unknown handicap_type ${JSON.stringify(handicapType)} — handicapSystem field set to null`,
  );
  return null;
}

// ============================================================================
// Threshold Chart Module dispatch
// ============================================================================

/**
 * Pick a Threshold Chart Module for the ad-hoc module by (handicap_type ×
 * mechanism). Mirrors the pickThreshold routing logic but returns the Chart
 * Module rather than the wrapped Mechanism `compute` function. Coexists with
 * the legacy `threshold` field during the strangler-fig transition.
 *
 * Returns null for combos with no calibrated Chart:
 * - `mechanism='none'` or `handicap_type='none'` — no handicap applied
 * - `race_length_adjustment` combos — both Race Chart variants ship as RESERVED stubs
 * - Unknown handicap_type / mechanism — graceful-fallback path
 *
 * The legacy `threshold` field continues to provide a zero-handicap fallback
 * compute() in those cases, so the match still plays.
 */
function pickThresholdChart(
  handicapType: string,
  mechanism: string,
): ThresholdChart | null {
  if (mechanism === 'none' || handicapType === 'none') {
    return null;
  }
  if (mechanism === 'extra_games') {
    if (handicapType === 'points') return gamesNeeded3v3Chart;
    if (handicapType === 'percentage') return gamesNeeded5v5Chart;
    return null;
  }
  if (mechanism === 'start_points') {
    if (handicapType === 'fargo') return fargoFormulaChart;
    return null;
  }
  if (mechanism === 'race_length_adjustment') {
    // Both Race Chart variants (race_points / race_percentage) ship as RESERVED stubs.
    // No shipping Scoring System uses race_length_adjustment today; return null and
    // let the legacy `threshold` field's race-length fallback handle it.
    return null;
  }
  return null;
}

// ============================================================================
// Handicap Mechanism Module dispatch
// ============================================================================

/**
 * Pick a Handicap Mechanism Module for the ad-hoc module by (handicap_type ×
 * mechanism). Mirrors pickThresholdChart's routing logic, then wraps the
 * selected Chart in the matching Mechanism factory. Coexists with the legacy
 * `threshold` field during the strangler-fig transition.
 *
 * Returns `noneMechanism` for `mechanism='none'` / `handicap_type='none'`
 * (zero-handicap extra_games shape per the locked spec). Returns null for
 * combos with no calibrated Chart (the legacy threshold field still provides
 * a zero-handicap fallback).
 */
function pickHandicapMechanism(
  handicapType: string,
  mechanism: string,
  chart: ThresholdChart | null,
): HandicapMechanism | null {
  if (mechanism === 'none' || handicapType === 'none') {
    return noneMechanism;
  }
  if (chart === null) {
    // No calibrated Chart for this (handicap_type × mechanism) combo. The
    // legacy `threshold` field provides a zero-handicap fallback; the
    // Mechanism field signals null so consumers know the Module path is
    // unwired for this combo.
    return null;
  }
  if (mechanism === 'extra_games') {
    // Type-narrowed via chart.kind — only Games-Needed Charts pair with extra_games.
    if (
      chart.kind === 'games_needed_3v3' ||
      chart.kind === 'games_needed_3v3_formula' ||
      chart.kind === 'games_needed_5v5' ||
      chart.kind === 'games_needed_5v5_formula'
    ) {
      return createExtraGamesMechanism(chart as GamesNeededChart);
    }
    return null;
  }
  if (mechanism === 'start_points') {
    if (chart.kind === 'fargo_formula') {
      return createStartPointsMechanism(chart as FargoFormulaChart);
    }
    return null;
  }
  if (mechanism === 'race_length_adjustment') {
    if (chart.kind === 'race_points' || chart.kind === 'race_percentage') {
      return createRaceLengthAdjustmentMechanism(chart as RaceLengthChart);
    }
    return null;
  }
  return null;
}

// ============================================================================
// Points System Module dispatch
// ============================================================================

/**
 * Pick a Points System composition for the ad-hoc module by `points_calculator`.
 * Mirrors the dispatch the legacy `pickScoring` does, but returns a composed
 * Points System rather than a bundled calculator. Phase B of the Points
 * System extraction; coexists with the legacy `scoring` capability.
 *
 * Returns null when `points_calculator` is null (the league doesn't track
 * points at all — no Points System applies).
 */
function pickPointsSystem(
  pointsCalculator: string | null,
  perGameAllocatorOverride?: import('./points-system/types').PerGameAllocator | null,
): PointsSystem | null {
  let composition: PointsSystem | null = null;
  if (pointsCalculator === null) {
    return null;
  }
  if (pointsCalculator === 'linear_above_threshold') {
    composition = buildPoints3ManComposition({ multiplier: 1 });
  } else if (pointsCalculator === 'accumulate_with_milestone_jumps') {
    composition = buildPercent5ManComposition({});
  } else if (pointsCalculator === 'accumulated_per_game') {
    composition = buildTenPointComposition({});
  } else {
    console.warn(
      `[buildSystemFromPreferences] Unknown points_calculator ${JSON.stringify(pointsCalculator)} — pointsSystem field set to null`,
    );
    return null;
  }

  // Per-Game Allocator Room (Unit 5) parity swap. The live-scoring path
  // through `match-adapter.ts` is the primary swap site; this branch keeps
  // `buildSystemFromPreferences` consumers (and its tests) consistent for
  // any future code that routes through here with an override.
  if (perGameAllocatorOverride && composition) {
    return {
      ...composition,
      name: `${composition.name}__custom_${perGameAllocatorOverride.name}`,
      perGameAllocator: perGameAllocatorOverride,
    };
  }
  return composition;
}

// ============================================================================
// Scoring section dispatch
// ============================================================================

const NOT_YET_WIRED =
  'Ad-hoc system module scoring methods not yet wired (legacy paths still in use for non-Fargo combos)';

/**
 * Pick the scoring capability for the ad-hoc module by `points_calculator`.
 *
 * Today the only fully-wired scoring path through SystemModule's god-function
 * `computeMatchResult` is Fargo's `accumulated_per_game` (recordGameOutcome /
 * computeMatchResult delegate to fargo5v5's implementation). The aggregate
 * calculators (`linear_above_threshold`, `accumulate_with_milestone_jumps`)
 * still flow through legacy code paths in MatchEndVerification pending the
 * Phase 5 Unit 5.5 refactor; ad-hoc modules with those calculators therefore
 * stub the SystemModule.scoring methods (calling them throws so any
 * accidental routing through a not-yet-wired path is caught at runtime).
 *
 * NULL means the league does not track points at all — scoring is effectively
 * a games-only counter, and no calculator runs. Stubbed identically.
 *
 * Phase 5 Unit 5.5 replaces this dispatch entirely with per-game calculator
 * dispatch in the scoring mutation. After that, this `scoring` capability
 * on SystemModule is deprecated.
 */
function pickScoring(pointsCalculator: string | null): SystemModule['scoring'] {
  if (pointsCalculator === 'accumulated_per_game') {
    // Per-game accumulation — reuse fargo5v5's implementation for any
    // (any-rating + accumulated_per_game) combo. Phase 5 Unit 5.5 will
    // replace this with calculator-registry dispatch in the per-game
    // scoring mutation.
    return {
      method: 'points_accumulated',
      recordGameOutcome: fargo5v5.scoring.recordGameOutcome,
      computeMatchResult: fargo5v5.scoring.computeMatchResult,
    };
  }

  if (
    pointsCalculator === 'linear_above_threshold' ||
    pointsCalculator === 'accumulate_with_milestone_jumps' ||
    pointsCalculator === null
  ) {
    // Aggregate calculators + the no-points case all flow through the
    // legacy MatchEndVerification path until Unit 5.5 refactors. Stub
    // SystemModule.scoring methods so any accidental call through this
    // surface throws loudly (caught at runtime).
    return {
      method: 'games_won_with_team_bonus',
      recordGameOutcome: () => {
        throw new Error(NOT_YET_WIRED);
      },
      computeMatchResult: () => {
        throw new Error(NOT_YET_WIRED);
      },
    };
  }

  console.warn(
    `[buildSystemFromPreferences] Unknown points_calculator ${JSON.stringify(pointsCalculator)} — defaulting to NOT_YET_WIRED stubs`,
  );
  return {
    method: 'games_won_with_team_bonus',
    recordGameOutcome: () => {
      throw new Error(NOT_YET_WIRED);
    },
    computeMatchResult: () => {
      throw new Error(NOT_YET_WIRED);
    },
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Build a SystemModule from resolved preferences + per-league dial overrides.
 *
 * Fast-paths to one of the three shipped preset modules when prefs match
 * exactly; otherwise assembles an ad-hoc module by dispatching each
 * capability section on the resolved axes.
 *
 * The `overrides` parameter is accepted for symmetry with the snapshot
 * shape (see `ResolvedSystemConfig.overrides`) and forward-compat with
 * future fingerprinting needs (e.g. caching ad-hoc modules by
 * key+overrides hash). Today threshold.compute methods accept overrides
 * as a per-call parameter so this argument is not consumed in the body —
 * marked with `void` to satisfy lint.
 *
 * @param prefs - Resolved per-match system configuration (from snapshot or live view)
 * @param overrides - Per-league JSONB dial overrides (reserved for future use)
 * @returns SystemModule ready for runtime scoring
 */
export function buildSystemFromPreferences(
  prefs: ResolvedSystemConfig,
  overrides: SystemOverrides,
): SystemModule {
  void overrides;

  // Per-Game Allocator Room (Unit 5): when a saved variation is embedded in
  // prefs (snapshot path), skip the preset fast path — the preset's hardcoded
  // pointsSystem would NOT carry the override, and falling through to the
  // ad-hoc builder lets `pickPointsSystem` apply it.
  const hasAllocatorOverride = Boolean(
    (prefs as { per_game_allocator?: unknown }).per_game_allocator,
  );
  if (!hasAllocatorOverride) {
    const preset = matchPreset(prefs);
    if (preset) {
      return preset;
    }
  }

  // Normalize game_generation to the strict enum the Team Geometry Module expects.
  // Falls back to single_round_robin for unknown values per the existing graceful-degradation
  // pattern this resolver uses elsewhere.
  const normalizedGameGeneration: 'single_round_robin' | 'double_round_robin' =
    prefs.game_generation === 'double_round_robin' ||
    prefs.game_generation === 'single_round_robin'
      ? prefs.game_generation
      : 'single_round_robin';

  return {
    key: deriveAdHocKey(prefs),
    // Team Geometry Module — replaces the legacy teamFormat field (Phase D of the
    // Team Geometry migration). Bundles lineup_size + max_roster_size + game_generation
    // axes plus derived gameCount.
    teamGeometry: getTeamGeometry(
      prefs.lineup_size,
      prefs.max_roster_size,
      normalizedGameGeneration,
    ),
    // Match Format Module — the per-pairing structural axes (pairing_format, race_length).
    // Per the Match Format extraction Unit; consumers may still read pairing_format /
    // race_length directly from prefs/snapshot during the strangler-fig transition.
    matchFormat: getMatchFormat(prefs.pairing_format, prefs.race_length),
    scoring: pickScoring(prefs.points_calculator),
    // Handicap System Module — replaces the legacy `rating` capability deleted
    // in Phase D of the Handicap Systems extraction Unit.
    handicapSystem: pickHandicapSystem(prefs.handicap_type),
    // Threshold Chart Module — the passive data layer (lookup table or formula).
    thresholdChart: pickThresholdChart(prefs.handicap_type, prefs.mechanism),
    // Handicap Mechanism Module — wraps the active Chart in the matching
    // Mechanism kind. Replaces the legacy `threshold` field deleted in Phase D
    // of the Handicap Mechanisms extraction Unit.
    handicapMechanism: pickHandicapMechanism(
      prefs.handicap_type,
      prefs.mechanism,
      pickThresholdChart(prefs.handicap_type, prefs.mechanism),
    ),
    // Points System Module — Phase B of the Points System extraction Unit.
    // Composes the per-match point allocation rule set from primitives.
    // Coexists with the legacy `scoring` capability + calculator-registry
    // dispatch until Phase D removes the legacy.
    pointsSystem: pickPointsSystem(
      prefs.points_calculator,
      // Per-Game Allocator Room (Unit 5) — snapshot may carry a resolved
      // override; non-snapshot callers leave it undefined and get the
      // prepackaged composition unchanged.
      (prefs as { per_game_allocator?: import('./points-system/types').PerGameAllocator | null }).per_game_allocator ?? null,
    ),
  };
}
