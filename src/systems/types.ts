/**
 * @fileoverview SystemModule Interface and Supporting Types
 *
 * Each shipped preset (bca3v3, bca5v5, fargo5v5) implements SystemModule
 * and owns its rating, scoring, and threshold behavior. The resolver
 * (src/systems/resolver.ts) maps a league's `handicap_type` string to one
 * of these modules.
 *
 * Threshold uses a discriminated union by design:
 * - BCAThreshold takes a scalar handicap diff and returns games-to-win/tie/lose
 * - FargoThreshold takes both teams' rosters and returns start-points for the weaker team
 *
 * Different signatures match what each system actually needs — no nullable
 * roundContext one-size-fits-all parameter that hides a runtime invariant
 * behind a permissive type.
 *
 * See docs/plans/2026-04-18-001-refactor-modular-handicap-scoring-systems-plan.md
 * for the design rationale.
 */

import type { SystemOverrides } from '@/types/systemOverrides';
import type { WinCalculator } from './win-calculators/types';
import type { TeamGeometry } from './team-geometry/types';
import type { MatchFormat } from './match-format/types';
import type { HandicapSystem } from './handicap-systems/types';
import type { ThresholdChart } from './threshold-charts/types';
import type { HandicapMechanism } from './handicap-mechanisms/types';
import type { PointsSystem } from './points-system/types';

// ============================================================================
// Ratings
// ============================================================================

/**
 * Player rating value. Numeric across all systems:
 * - BCA 3v3 (handicap_type='points'): integer -2..+2 (standard) or -1..+1 (reduced)
 * - BCA 5v5 (handicap_type='percentage'): 0-100
 * - Fargo 5v5 (handicap_type='fargo'): integer 100-850
 *
 * The module's `rating.validate()` enforces the expected range.
 */
export type RatingValue = number;

/**
 * Result of `rating.validate()`. Modules parse unknown input into a typed value
 * or return a human-readable error message for UI display.
 */
export type RatingValidationResult =
  | { ok: true; value: RatingValue }
  | { ok: false; message: string };

/**
 * Context passed to `rating.computeFromHistory()`.
 * Fargo doesn't use this (manual entry only), but BCA systems do.
 */
export interface PlayerHistoryContext {
  playerId: string;
  /** Recent games ordered most-recent-first. Module decides how far back to look. */
  recentGames: Array<{
    won: boolean;
    opponentId: string;
  }>;
  /** Weeks of play used by BCA 3v3's (W-L)/weeks formula */
  weeksPlayed: number;
}

// ============================================================================
// Scoring
// ============================================================================

/**
 * Per-game outcome captured by the scoring modal.
 * BCA games ignore Fargo-specific fields; Fargo games require them.
 */
export interface GameOutcome {
  winnerTeam: 'home' | 'away';

  /** Required for Fargo. Number of balls the losing player pocketed (0-7 for 8-ball). */
  loserBallsPocketed?: number;

  /**
   * Optional achievement flags. Future achievements extend this without
   * breaking existing callers. All default to false.
   */
  achievements?: {
    breakAndRun?: boolean;
    goldenBreak?: boolean;
  };
}

/**
 * Fields the scoring module contributes to a match_games row.
 * Consumers combine this with winner_team_id, winner_player_id, etc.
 * BCA modules return all nullable Fargo fields as null; Fargo populates them.
 */
export interface GameRecordFields {
  winner_points: number | null;
  loser_points: number | null;
  loser_balls_pocketed: number | null;
}

/**
 * A single game's stored record, as read back from match_games for match-result computation.
 * Includes the fields needed to reconstruct who won and how many points.
 */
export interface StoredGameRecord extends GameRecordFields {
  winner_team: 'home' | 'away';
}

/**
 * Final match result computed by `scoring.computeMatchResult()`.
 *
 * For Fargo 5v5 (25 games odd), the points → games-won cascade always produces
 * a decisive winner — no 'tie' return value needed. If future formats can tie
 * on both points AND games-won, the tiebreaker rule becomes operator-defined
 * at that point (not v1 scope).
 */
export interface MatchResult {
  winner: 'home' | 'away';
  home_points: number;
  away_points: number;
  home_games_won: number;
  away_games_won: number;
}

// ============================================================================
// Threshold / Mechanism output shapes (consumed by Handicap Mechanism variants)
// ============================================================================

/**
 * Output of the Start Points Mechanism's `compute()`. `weakerTeam` identifies
 * which team receives the deficit (or 'even' if teams are perfectly matched).
 * `startPointsForWeakerTeam` is always non-negative — 0 means no handicap applies.
 */
export interface FargoStartPointsResult {
  startPointsForWeakerTeam: number;
  weakerTeam: 'home' | 'away' | 'even';
}

/**
 * Output of the Race Length Adjustment Mechanism's `compute()`. Per-pairing race
 * targets for each side. Both must be ≥ 1.
 */
export interface RaceLengthResult {
  homeRaceLength: number;
  awayRaceLength: number;
}

// ============================================================================
// SystemModule (main interface)
// ============================================================================

/**
 * A complete scoring system. The resolver returns one of these per league.
 *
 * Each preset module (bca3v3, bca5v5, fargo5v5) exports a single SystemModule
 * instance implementing all four capability groups. Callers that need specific
 * behavior (rating computation, game outcome recording, match-result
 * calculation, threshold lookup) delegate through the module.
 */
export interface SystemModule {
  /**
   * Module identity. Stable for the three preset modules (`'bca3v3'`,
   * `'bca5v5'`, `'fargo5v5'`); free-form for ad-hoc resolved modules
   * built by `buildSystemFromPreferences()` (Phase 5 Unit 5.1).
   *
   * Type widened from a closed literal union to `string` per Phase 1
   * Unit 1.2 of the modular-league plan. Switch statements that branch
   * on `key` must add a `default` case (with `console.warn` graceful
   * fallback) to honor the graceful-degradation principle.
   */
  key: string;

  /** Game outcome recording and match-result computation. */
  scoring: {
    /**
     * How this system assigns points per game and determines the match winner.
     * BCA systems use 'games_won_with_team_bonus'; Fargo uses 'points_accumulated'.
     */
    method: 'games_won_with_team_bonus' | 'points_accumulated';

    /**
     * Given an in-UI game outcome, produce the Fargo-relevant fields for the
     * match_games row. BCA modules return all nulls; Fargo populates them
     * based on the ball count and the override-able winner_points default.
     */
    recordGameOutcome: (
      outcome: GameOutcome,
      overrides: SystemOverrides
    ) => GameRecordFields;

    /**
     * Given all stored games for a completed match, produce the final match
     * result. For Fargo 5v5, the cascade (higher points → higher games-won)
     * always yields a decisive winner.
     */
    computeMatchResult: (
      games: StoredGameRecord[],
      overrides: SystemOverrides,
      context?: { fargoStartPoints?: number; fargoStartPointsFor?: 'home' | 'away' | 'even' }
    ) => MatchResult;
  };

  /**
   * Team Geometry Module — passive configuration record bundling the three
   * structural axes (lineup_size, max_roster_size, game_generation) plus the
   * derived game_count (lineup_size² × multiplier(game_generation)).
   *
   * Added in the new Unit 1 of the modular-framework migration (per
   * `docs/plans/2026-05-17-001-refactor-modular-framework-migration-plan.md`).
   *
   * Coexists with the existing `teamFormat` field during the strangler-fig
   * transition — both fields carry the same axis values; consumers gradually
   * migrate from `teamFormat` to `teamGeometry` in Phase C. The legacy field
   * gets deprecated/removed once no consumers remain.
   *
   * @see src/systems/team-geometry/index.ts — `getTeamGeometry()` factory
   * @see docs/league-system/modules/team-geometry.md — the locked blueprint
   */
  teamGeometry: TeamGeometry;

  /**
   * Match Format Module — passive configuration record bundling the two per-pairing
   * structural axes (pairing_format, race_length).
   *
   * Added in the Match Format extraction Unit (per
   * `docs/plans/2026-05-17-001-refactor-modular-framework-migration-plan.md`),
   * following the strangler-fig pattern proven by Team Geometry.
   *
   * Currently no SystemModule consumer reads pairing_format / race_length directly —
   * the Pairings Generator code that would do so is itself a future extraction Unit
   * (currently bundled into runtime code). When that landlines, it'll consume
   * `matchFormat.pairingFormat` and `matchFormat.raceLength` via the Module rather
   * than via scattered preference reads.
   *
   * @see src/systems/match-format/index.ts — `getMatchFormat()` factory
   * @see docs/league-system/modules/match-format.md — the locked blueprint
   */
  matchFormat: MatchFormat;

  /**
   * Win Calculator Module — the metric-precedence-stack walker that decides
   * the match winner. Added in Unit 1 of the modular-framework migration
   * (per `docs/plans/2026-05-17-001-refactor-modular-framework-migration-plan.md`).
   *
   * Replaces the runtime branching on `win_condition` that lived in
   * `computeMatchRunningTotals`, `MatchEndVerification`, and other
   * consumers. Each SystemModule declares which Win Calculator it uses;
   * the runtime calls `winCalculator.decide(matchData)` to get a typed
   * `WinnerDecision` ('home_win' / 'away_win' / 'tied').
   *
   * In Unit 1, every Win Calculator's metric stack has exactly one entry
   * (matching the SystemModule's traditional `win_condition` value).
   * Multi-entry stacks, the `edge` entry, and the Tiebreak System trigger
   * integration are enabled by the interface but not implemented until
   * Unit 9 (Tiebreak System extraction).
   *
   * @see src/systems/win-calculators/index.ts — `getWinCalculator()` factory
   * @see docs/league-system/modules/win-calculator.md — the locked blueprint
   */
  winCalculator: WinCalculator;

  /**
   * Handicap System Module — encapsulates the player rating encoding (kind,
   * manual-vs-derived, displayFormat, validate, optional computeFromHistory).
   *
   * Added in the Handicap Systems extraction Unit (per
   * `docs/plans/2026-05-17-001-refactor-modular-framework-migration-plan.md`),
   * following the strangler-fig pattern proven by Team Geometry and Match Format.
   *
   * Replaces the legacy `rating` capability that was a stranded API — declared
   * but never consumed by production code. Phase C was a no-op (no consumers to
   * swap); Phase D deleted the field and its 4 construction sites.
   *
   * The four shipping variants:
   * - Points (kind: 'points')           — BCA 3v3
   * - Percentage (kind: 'percentage')   — BCA 5v5
   * - FargoRate (kind: 'fargo')         — Fargo 5v5
   * - Skill Level (kind: 'skill_level') — reserved; no current consumer
   *
   * `null` reflects the blueprint's "no handicap" case (`handicap_type='none'` —
   * league self-sorts into skill tiers; no equalization Module is applied).
   * The locked Handicap Systems README explicitly defines this as "no Module"
   * rather than a 5th variant.
   *
   * @see src/systems/handicap-systems/index.ts — `getHandicapSystem()` factory
   * @see docs/league-system/modules/handicap-systems/README.md — the locked blueprint
   */
  handicapSystem: HandicapSystem | null;

  /**
   * Threshold Chart Module — the passive data lookup that maps a handicap
   * input (a difference, a rating pair, or a derived value) to a threshold
   * value that the active Mechanism applies to match setup.
   *
   * Added in the Threshold Charts extraction Unit (per
   * `docs/plans/2026-05-17-001-refactor-modular-framework-migration-plan.md`),
   * following the strangler-fig pattern proven by Team Geometry / Match Format
   * / Handicap Systems.
   *
   * Coexists with the legacy `threshold` capability above during the
   * strangler-fig transition — the legacy field's `compute` function internally
   * delegates to the same Chart code paths this field references. Consumers
   * gradually migrate from `systemModule.threshold.compute(...)` to
   * `systemModule.thresholdChart.compute(...)` in Phase C; the legacy
   * `threshold` capability is removed in Phase D.
   *
   * The five shipping variants:
   * - games_needed_3v3 — BCA 3v3 (Points × extra_games)
   * - games_needed_5v5 — BCA 5v5 (Percentage × extra_games)
   * - fargo_formula   — Fargo 5v5 (FargoRate × start_points)
   * - race_points     — RESERVED (Points × race_length_adjustment)
   * - race_percentage — RESERVED (Percentage × race_length_adjustment)
   *
   * `null` reflects combos with no calibrated Chart for the active
   * (handicap_type × mechanism) pairing — e.g., `handicap_type='none'`
   * (no handicap applied) or unknown/unbuilt combinations. The legacy
   * `threshold` field continues to provide a zero-handicap fallback in
   * those cases so the match still plays.
   *
   * @see src/systems/threshold-charts/index.ts — `getThresholdChart()` factory
   * @see docs/league-system/modules/threshold-charts/README.md — the locked blueprint
   */
  thresholdChart: ThresholdChart | null;

  /**
   * Handicap Mechanism Module — declares the KIND of asymmetry the handicap
   * creates in match setup (extra games to win, start points, race-length
   * adjustment). Bundled internally with the active Chart at construction.
   *
   * Added in the Handicap Mechanisms extraction Unit (per
   * `docs/plans/2026-05-17-001-refactor-modular-framework-migration-plan.md`),
   * following the strangler-fig pattern proven by Team Geometry / Match Format /
   * Handicap Systems / Threshold Charts.
   *
   * Coexists with the legacy `threshold` capability above during the
   * strangler-fig transition — both ultimately compute the same values
   * (the Mechanism's `compute` delegates to its bound Chart, same path as
   * the legacy field after Threshold Charts Phase D). Consumers gradually
   * migrate from `systemModule.threshold.compute(...)` to
   * `systemModule.handicapMechanism.compute(...)` in Phase C; the legacy
   * `threshold` capability is removed in Phase D, completing the cleanup
   * that Threshold Charts Phase D deferred.
   *
   * Variants per the locked 2x2 taxonomy:
   * - extra_games (BCA 3v3 + BCA 5v5)
   * - start_points (Fargo 5v5)
   * - race_length_adjustment (RESERVED — no shipping consumer)
   *
   * `null` reflects combos with no calibrated (Mechanism × Chart) pairing —
   * e.g., `handicap_type='none'` (no handicap applied) or unknown combos.
   * For `mechanism='none'` configs, the `noneMechanism` zero-handicap
   * instance fills this slot rather than null, so consumers see a uniform
   * shape per the locked spec.
   *
   * @see src/systems/handicap-mechanisms/index.ts — `buildHandicapMechanism()` factory
   * @see docs/league-system/modules/handicap-mechanisms/README.md — locked blueprint
   */
  handicapMechanism: HandicapMechanism | null;

  /**
   * Points System Module — the composed per-match point allocation rule set.
   * A `PointsSystem` is a structured-slot composition of primitives
   * (thresholds, optional per-game allocator, triggers, optional end-of-match
   * aggregate) per the locked Points System README and the Ed-walked
   * decomposition in
   * `docs/brainstorms/2026-05-18-points-system-decomposition-requirements.md`.
   *
   * Added in Phase B of the Points System extraction Unit (Unit 5). Coexists
   * with the legacy `scoring` capability above + the calculator-registry
   * dispatch (`src/systems/calculators/`) during the strangler-fig transition;
   * Phase C swaps consumers to the composed Points System; Phase D removes
   * the legacy calculator registry.
   *
   * The three prepackaged Scoring Systems each declare their composition:
   * - Points 3-Man — buildPoints3ManComposition() (just an end-of-match aggregate)
   * - Percentage 5-Man — buildPercent5ManComposition() (allocator + 2 jump triggers)
   * - FargoRate 10-Point 5-Man — buildFargo10pt5ManComposition() (initial points + allocator)
   *
   * `null` reflects combos where no Points System applies — currently the
   * `handicap_type='none' + mechanism='none'` case (a league running with
   * no points tracking at all). Cross-audited byte-equivalent to the legacy
   * bundled calculators across exhaustive input sweeps; see
   * `src/systems/points-system/__tests__/cross-audit-*.test.ts`.
   *
   * @see src/systems/points-system/runtime.ts — evaluatePointsSystem()
   * @see docs/league-system/modules/points-system/README.md — the locked blueprint
   */
  pointsSystem: PointsSystem | null;
}
