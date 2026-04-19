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

import type { HandicapThresholds } from '@/types/match';
import type { SystemOverrides } from '@/types/systemOverrides';

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
// Thresholds (discriminated union)
// ============================================================================

/**
 * BCA-style threshold: games-to-win/tie/lose determined by scalar handicap diff.
 * Returns the shape already used across the codebase (src/types/match.ts HandicapThresholds).
 */
export interface BCAThreshold {
  mode: 'games_to_win';
  compute: (handicapDiff: number, overrides: SystemOverrides) => HandicapThresholds;
}

/**
 * Fargo-style threshold: start points awarded to the weaker team at match start.
 * Takes both teams' rosters (ratings) because the calculation depends on the
 * full lineup, not a single diff scalar.
 */
export interface FargoThreshold {
  mode: 'start_points';
  compute: (
    homeRatings: RatingValue[],
    awayRatings: RatingValue[],
    overrides: SystemOverrides
  ) => FargoStartPointsResult;
}

/**
 * Output of `FargoThreshold.compute()`. `weakerTeam` identifies which team receives
 * the deficit (or 'even' if teams are perfectly matched). `startPointsForWeakerTeam`
 * is always non-negative — 0 means no handicap applies.
 */
export interface FargoStartPointsResult {
  startPointsForWeakerTeam: number;
  weakerTeam: 'home' | 'away' | 'even';
}

// ============================================================================
// Team format
// ============================================================================

/**
 * Structural facts about how a preset's matches are shaped.
 * Used by lineup and schedule code to know roster size, lineup size, and RR mode.
 */
export interface TeamFormatConstants {
  /** Players per team in a match night's lineup (3 for 3v3, 5 for 5v5). */
  lineupSize: number;

  /** Maximum roster size a team can carry (5 for 3v3, 8 for 5v5). */
  maxRosterSize: number;

  /** How games are generated from the lineup. */
  gameGeneration: 'double_round_robin' | 'single_round_robin';
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
  /** Module identity. Stable across versions; used as a debugging/logging key. */
  key: 'bca3v3' | 'bca5v5' | 'fargo5v5';

  /** Structural team-format constants for this preset. */
  teamFormat: TeamFormatConstants;

  /** Rating computation, validation, and display. */
  rating: {
    /**
     * True for Fargo (operator enters rating manually at lineup time).
     * False for BCA (rating derives from history).
     */
    requiresManualEntry: boolean;

    /**
     * Compute a rating from a player's recent game history.
     * Undefined for Fargo (manual-only). Returns null when the player has
     * insufficient history for the module's formula.
     */
    computeFromHistory?: (ctx: PlayerHistoryContext) => RatingValue | null;

    /** Format a numeric rating for display (e.g., '+2', '85%', '575'). */
    displayFormat: (value: RatingValue) => string;

    /**
     * Parse unknown input (string/number/null from a form field) into a
     * validated rating value. UI uses the error message when ok is false.
     */
    validate: (value: unknown) => RatingValidationResult;
  };

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

  /** Threshold lookup — discriminated union by mode. */
  threshold: BCAThreshold | FargoThreshold;
}
