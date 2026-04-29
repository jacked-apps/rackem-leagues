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

import type { HandicapThresholds } from '@/types/match';
import type { SystemOverrides } from '@/types/systemOverrides';
import type { ResolvedSystemConfig } from '@/types/resolvedSystemConfig';
import type {
  ExtraGamesThreshold,
  FargoStartPointsResult,
  RaceLengthResult,
  RaceLengthThreshold,
  StartPointsThreshold,
  SystemModule,
} from './types';
import { bca3v3 } from './bca3v3';
import { bca5v5 } from './bca5v5';
import { fargo5v5 } from './fargo5v5';
import { get3v3GamesNeeded } from '@/utils/handicap/get3v3GamesNeeded';
import { get5v5GamesNeeded } from '@/utils/handicap/get5v5GamesNeeded';

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
  const { lineup_size, handicap_type, game_generation, mechanism, scoring_method } = prefs;

  if (
    lineup_size === 3 &&
    handicap_type === 'points' &&
    game_generation === 'double_round_robin' &&
    mechanism === 'extra_games' &&
    scoring_method === 'winner_takes_all'
  ) {
    return bca3v3;
  }

  if (
    lineup_size === 5 &&
    handicap_type === 'percentage' &&
    game_generation === 'single_round_robin' &&
    mechanism === 'extra_games' &&
    scoring_method === 'winner_takes_all'
  ) {
    return bca5v5;
  }

  if (
    lineup_size === 5 &&
    handicap_type === 'fargo' &&
    game_generation === 'single_round_robin' &&
    mechanism === 'start_points' &&
    scoring_method === 'points_10_7'
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
 *   `custom_<lineup>v<lineup>_<handicap>_<mechanism>_<scoring>`
 */
function deriveAdHocKey(prefs: ResolvedSystemConfig): string {
  const { lineup_size, handicap_type, mechanism, scoring_method } = prefs;
  return `custom_${lineup_size}v${lineup_size}_${handicap_type}_${mechanism}_${scoring_method}`;
}

// ============================================================================
// Rating section dispatch
// ============================================================================

/**
 * Pick a rating capability for the ad-hoc module by handicap_type. We reuse
 * the shipped modules' rating shapes verbatim — the rating-system semantics
 * (how to validate / display / compute-from-history) don't change with
 * lineup size or scoring method, only with the underlying rating system.
 *
 * For `skill_level` (BCAPL SL — Phase 3 Unit 3.3) and `none` we provide
 * minimal stubs until the real implementations land.
 */
function pickRating(handicapType: string): SystemModule['rating'] {
  switch (handicapType) {
    case 'points':
      return bca3v3.rating;
    case 'percentage':
      return bca5v5.rating;
    case 'fargo':
      return fargo5v5.rating;
    case 'skill_level':
      // Stub: BCAPL Skill Level (1-9 integer). Real validate/display lands
      // with Unit 3.3's Layer 2 chart seed. Until then, accept integers
      // 1-9 and display as a bare number.
      return {
        requiresManualEntry: true,
        computeFromHistory: () => null,
        displayFormat: (value) => `SL${Math.round(value)}`,
        validate: (value) => {
          if (typeof value !== 'number' || !Number.isFinite(value)) {
            return { ok: false, message: 'Skill Level must be a number' };
          }
          if (!Number.isInteger(value)) {
            return { ok: false, message: 'Skill Level must be an integer' };
          }
          if (value < 1 || value > 9) {
            return { ok: false, message: 'Skill Level must be between 1 and 9' };
          }
          return { ok: true, value };
        },
      };
    case 'none':
      // No-handicap leagues: rating is informational only, accept anything
      // numeric for storage consistency.
      return {
        requiresManualEntry: false,
        computeFromHistory: () => null,
        displayFormat: () => '—',
        validate: (value) => {
          if (typeof value !== 'number' || !Number.isFinite(value)) {
            return { ok: false, message: 'Rating must be a number' };
          }
          return { ok: true, value };
        },
      };
    default:
      console.warn(
        `[buildSystemFromPreferences] Unknown handicap_type ${JSON.stringify(handicapType)} — defaulting to bca5v5 rating shape`,
      );
      return bca5v5.rating;
  }
}

// ============================================================================
// Scoring section dispatch
// ============================================================================

const NOT_YET_WIRED =
  'Ad-hoc system module scoring methods not yet wired (legacy paths still in use for non-Fargo combos)';

/**
 * Pick the scoring capability for the ad-hoc module by `scoring_method`.
 *
 * Today the only fully-wired scoring path through SystemModule is Fargo's
 * points_10_7 (recordGameOutcome / computeMatchResult). BCA-style winner-
 * takes-all still flows through legacy code paths in MatchEndVerification
 * pending Unit 5.2's refactor; ad-hoc winner_takes_all modules therefore
 * stub the same way bca3v3/bca5v5 do — calling them throws so that any
 * accidental routing through a not-yet-wired path is caught at runtime.
 *
 * race_winner is reserved for the BCAPL SL race-to-N format (Phase 3
 * Unit 3.3). Stubbed identically until that path lands.
 */
function pickScoring(scoringMethod: string): SystemModule['scoring'] {
  switch (scoringMethod) {
    case 'points_10_7':
      // Fargo points scoring is rating-system-agnostic — reuse fargo5v5's
      // implementation for any (any-rating + 10-7 scoring) combo.
      return {
        method: 'points_accumulated',
        recordGameOutcome: fargo5v5.scoring.recordGameOutcome,
        computeMatchResult: fargo5v5.scoring.computeMatchResult,
      };
    case 'winner_takes_all':
      return {
        method: 'games_won_with_team_bonus',
        recordGameOutcome: () => {
          throw new Error(NOT_YET_WIRED);
        },
        computeMatchResult: () => {
          throw new Error(NOT_YET_WIRED);
        },
      };
    case 'race_winner':
      return {
        method: 'games_won_with_team_bonus',
        recordGameOutcome: () => {
          throw new Error(`race_winner scoring not yet wired (BCAPL SL — Phase 3 Unit 3.3)`);
        },
        computeMatchResult: () => {
          throw new Error(`race_winner scoring not yet wired (BCAPL SL — Phase 3 Unit 3.3)`);
        },
      };
    default:
      console.warn(
        `[buildSystemFromPreferences] Unknown scoring_method ${JSON.stringify(scoringMethod)} — defaulting to winner_takes_all stubs`,
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
}

// ============================================================================
// Threshold section dispatch (mechanism → ExtraGames | StartPoints | RaceLength)
// ============================================================================

/** Zero-handicap threshold output — no extra games, no tie threshold, no losing threshold. */
function zeroExtraGames(): HandicapThresholds {
  return { games_to_win: 0, games_to_tie: null, games_to_lose: null };
}

/**
 * Build an ExtraGamesThreshold for an ad-hoc module. Routes by handicap_type
 * to the existing TS chart files until Unit 3.1 wires the `lookup_threshold`
 * SQL function for Layer 3 chart-id lookups.
 *
 * Behavior:
 *  - handicap_type='points' → 3v3 chart (regardless of lineup size — chart
 *    is the only Layer-2 source for integer points handicaps today)
 *  - handicap_type='percentage' → 5v5 chart
 *  - any other → zero handicap (graceful fallback) with a one-time warn
 */
function buildExtraGamesThreshold(handicapType: string): ExtraGamesThreshold {
  if (handicapType === 'points') {
    return {
      mode: 'extra_games',
      compute: (handicapDiff) => get3v3GamesNeeded(handicapDiff),
    };
  }
  if (handicapType === 'percentage') {
    return {
      mode: 'extra_games',
      compute: (handicapDiff) => get5v5GamesNeeded(handicapDiff),
    };
  }
  // Fargo / skill_level / none / unknown with extra_games mechanism: no
  // Layer 1 generative engine yet (Unit 3.2). Return zero-handicap and
  // warn — match plays unhandicapped rather than failing to start.
  return {
    mode: 'extra_games',
    compute: () => {
      console.warn(
        `[buildSystemFromPreferences] No Layer 1/2/3 extra_games chart for handicap_type=${JSON.stringify(handicapType)} — returning zero-handicap fallback (Unit 3.2 will provide Fargo Layer 1)`,
      );
      return zeroExtraGames();
    },
  };
}

/**
 * Build a StartPointsThreshold for an ad-hoc module. Reuses fargo5v5's
 * computeStartPoints which works for any roster size — the formula is
 * roster-agnostic (sums transformed ratings, multiplies by total games).
 *
 * For handicap systems other than Fargo (`points`, `percentage`,
 * `skill_level`) paired with a start-points mechanism, no calibrated
 * formula exists yet. Returns zero start-points with a warn.
 */
function buildStartPointsThreshold(handicapType: string): StartPointsThreshold {
  if (handicapType === 'fargo') {
    return {
      mode: 'start_points',
      compute: fargo5v5.threshold.mode === 'start_points'
        ? fargo5v5.threshold.compute
        : /* istanbul ignore next — fargo5v5.threshold.mode is always 'start_points' by construction */
          () => ({ startPointsForWeakerTeam: 0, weakerTeam: 'even' }),
    };
  }
  return {
    mode: 'start_points',
    compute: (homeRatings, awayRatings, overrides): FargoStartPointsResult => {
      void homeRatings;
      void awayRatings;
      void overrides;
      console.warn(
        `[buildSystemFromPreferences] No start_points formula for handicap_type=${JSON.stringify(handicapType)} — returning zero start-points fallback`,
      );
      return { startPointsForWeakerTeam: 0, weakerTeam: 'even' };
    },
  };
}

/**
 * Build a RaceLengthThreshold for an ad-hoc module. The BCAPL Skill Level
 * Layer 2 chart lands in Unit 3.3; until then we return equal race lengths
 * derived from `prefs.race_length` (or 7 if NULL — a sensible default for
 * 8-ball / 9-ball race-to-N).
 */
function buildRaceLengthThreshold(prefs: ResolvedSystemConfig): RaceLengthThreshold {
  const baseRace = prefs.race_length ?? 7;
  return {
    mode: 'race_length_adjustment',
    compute: (homeRatings, awayRatings, overrides): RaceLengthResult => {
      void homeRatings;
      void awayRatings;
      void overrides;
      console.warn(
        `[buildSystemFromPreferences] race_length_adjustment mechanism has no chart wired yet (Unit 3.3) — returning equal race lengths of ${baseRace}`,
      );
      return { homeRaceLength: baseRace, awayRaceLength: baseRace };
    },
  };
}

/**
 * Pick a threshold capability for the ad-hoc module by `mechanism`.
 *
 * `mechanism='none'` collapses to a zero-handicap ExtraGamesThreshold so
 * the threshold-shape contract is satisfied without applying any handicap.
 * Callers reading `module.threshold.mode === 'extra_games'` and getting
 * `{ games_to_win: 0, ... }` should interpret that as "play unhandicapped."
 */
function pickThreshold(prefs: ResolvedSystemConfig): SystemModule['threshold'] {
  switch (prefs.mechanism) {
    case 'extra_games':
      return buildExtraGamesThreshold(prefs.handicap_type);
    case 'start_points':
      return buildStartPointsThreshold(prefs.handicap_type);
    case 'race_length_adjustment':
      return buildRaceLengthThreshold(prefs);
    case 'none':
      return {
        mode: 'extra_games',
        compute: () => zeroExtraGames(),
      };
    default:
      console.warn(
        `[buildSystemFromPreferences] Unknown mechanism ${JSON.stringify(prefs.mechanism)} — defaulting to zero-handicap extra_games`,
      );
      return {
        mode: 'extra_games',
        compute: () => zeroExtraGames(),
      };
  }
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

  const preset = matchPreset(prefs);
  if (preset) {
    return preset;
  }

  return {
    key: deriveAdHocKey(prefs),
    teamFormat: {
      lineupSize: prefs.lineup_size,
      maxRosterSize: prefs.max_roster_size,
      gameGeneration:
        prefs.game_generation === 'double_round_robin' ||
        prefs.game_generation === 'single_round_robin'
          ? prefs.game_generation
          : 'single_round_robin',
    },
    rating: pickRating(prefs.handicap_type),
    scoring: pickScoring(prefs.scoring_method),
    threshold: pickThreshold(prefs),
  };
}
