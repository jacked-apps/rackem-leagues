/**
 * @fileoverview Combo coherence validator (Phase 4 Unit 4.2 of the
 * modular-league-system v2 plan).
 *
 * Pure function: takes the wizard form data and returns a list of
 * structured errors and warnings. The Review step renders each error
 * with a destructive Alert (blocks Save) and each warning with a
 * warning Alert (allows "Save anyway" — non-blocking).
 *
 * Rule taxonomy:
 *   - ERRORS: combinations that produce undefined or contradictory
 *     runtime behavior (e.g. "decide by points" when the league isn't
 *     tracking any points). These block Save.
 *   - WARNINGS: combinations that work at runtime but fall outside the
 *     three Tested Presets (`bca3v3`, `bca5v5`, `fargo5v5`) or hit
 *     known limitations of a calculator. The LO can save anyway.
 *
 * The validator runs over WIZARD FORM DATA (not the DB-shape resolved
 * preferences). This gives the LO instant feedback at Review-step time,
 * while the form-data → preference-record mapping is tested separately.
 *
 * @see docs/plans/2026-05-01-001-feat-modular-league-system-v2-plan.md (Unit 4.2)
 */

import type { LeagueWizardFormData } from './leagueWizardTypes';
import { computeGameCount } from '@/systems/team-geometry';

/** Severity tier — drives the Alert variant in the Review-step UI. */
export type ComboFinding = {
  severity: 'error' | 'warning';
  /** Stable code for tests + telemetry (humans see `message`). */
  code: string;
  /** User-facing single-paragraph message rendered inside the Alert. */
  message: string;
};

/** Result of evaluating a wizard form's combo coherence. */
export interface ComboCoherenceResult {
  errors: ReadonlyArray<ComboFinding>;
  warnings: ReadonlyArray<ComboFinding>;
}

/** Tested Preset bundles — combos that match these get no warnings. */
const TESTED_PRESETS: ReadonlyArray<{
  lineupSize: number;
  gameGeneration: 'single_round_robin' | 'double_round_robin';
  pointsCalculator: string | null;
  winCondition: 'games' | 'points';
  pairingFormat: 'single_rack' | 'race_to_n';
}> = [
  // BCA 3v3
  {
    lineupSize: 3,
    gameGeneration: 'double_round_robin',
    pointsCalculator: 'linear_above_threshold',
    winCondition: 'games',
    pairingFormat: 'single_rack',
  },
  // BCA 5v5
  {
    lineupSize: 5,
    gameGeneration: 'single_round_robin',
    pointsCalculator: 'accumulate_with_milestone_jumps',
    winCondition: 'games',
    pairingFormat: 'single_rack',
  },
  // Fargo 5v5
  {
    lineupSize: 5,
    gameGeneration: 'single_round_robin',
    pointsCalculator: 'accumulated_per_game',
    winCondition: 'points',
    pairingFormat: 'single_rack',
  },
];

/**
 * Evaluate the wizard form data and return all coherence findings.
 *
 * Behavior:
 *   - For PRESET-format wizards (`league-format !== 'custom'`) the
 *     custom-path fields are absent — the validator returns an empty
 *     result (presets are by construction tested + coherent).
 *   - For CUSTOM-path wizards, the rules below fire on the form data.
 *
 * Currently implemented rules:
 *   ERROR
 *     - `points_calculator: null` + `win_condition: 'points'`
 *       (`error.no_points_to_decide_by`) — you can't decide a match by
 *       points if you're not tracking them.
 *     - `pairing_format: 'race_to_n'` + `points_calculator: 'accumulated_per_game'`
 *       (`error.race_format_without_ball_count`) — race format doesn't
 *       collect per-game ball-pocketed counts.
 *   WARNING
 *     - Combo doesn't match a Tested Preset bundle (`warning.off_preset_combo`).
 *     - `accumulate_with_milestone_jumps` + even total game count
 *       (`warning.milestone_jumps_even_games`) — calculator doesn't
 *       handle ties cleanly when the format can produce them.
 */
export function evaluateCombo(formData: LeagueWizardFormData): ComboCoherenceResult {
  const errors: ComboFinding[] = [];
  const warnings: ComboFinding[] = [];

  if (formData['league-format'] !== 'custom') {
    return { errors, warnings };
  }

  // Migration 20260503000000: "don't track points" is now the explicit
  // string `'none'` — null is no longer a valid stored value. Older
  // form-data drafts may still hold null (the previous convention),
  // so we normalize null → 'none' here for rule evaluation. undefined
  // (LO never reached the step) stays undefined so the off-preset
  // warning rule below can still distinguish it.
  const rawPointsCalc =
    'points-calculator' in formData ? formData['points-calculator'] : undefined;
  const pointsCalculator: string | undefined =
    rawPointsCalc === null ? 'none' : rawPointsCalc;
  const winCondition = formData['win-condition'];
  const pairingFormat = formData['pairing-format'];
  const lineupSize = formData['lineup-size'];
  const gameGeneration = formData['match-format'];

  // ERROR: decide-by-points without a calculator
  if (pointsCalculator === 'none' && winCondition === 'points') {
    errors.push({
      severity: 'error',
      code: 'error.no_points_to_decide_by',
      message:
        "You picked 'Don't track points' but also 'Points decide the winner.' These contradict — change one before saving.",
    });
  }

  // ERROR: race format with per-game-ball-count calculator
  if (pairingFormat === 'race_to_n' && pointsCalculator === 'accumulated_per_game') {
    errors.push({
      severity: 'error',
      code: 'error.race_format_without_ball_count',
      message:
        "Race-to-N format doesn't collect per-game balls-pocketed counts, but the 'Accumulated per Game' calculator needs them. Pick a different calculator or switch to single-rack pairing.",
    });
  }

  // WARNING: milestone jumps + even total game count
  if (
    pointsCalculator === 'accumulate_with_milestone_jumps' &&
    typeof lineupSize === 'number' &&
    gameGeneration
  ) {
    const totalGames = computeGameCount(lineupSize, gameGeneration);
    if (totalGames % 2 === 0) {
      warnings.push({
        severity: 'warning',
        code: 'warning.milestone_jumps_even_games',
        message:
          "The 'Accumulate with Milestone Jumps' calculator wasn't designed for formats that can end tied. With this lineup × match-format your matches can produce a tie at the threshold — pair with a tiebreaker option to handle it.",
      });
    }
  }

  // WARNING: combo doesn't match a Tested Preset bundle (off-preset)
  if (typeof lineupSize === 'number' && gameGeneration && pointsCalculator !== undefined) {
    // Tested Presets store `pointsCalculator` as null for the "no points
    // calc" historical reason; the migration replaced that with 'none'
    // at the runtime/data layer but the preset bundles still use null.
    // Normalize for the equality check.
    const normalizedCalc = pointsCalculator === 'none' ? null : pointsCalculator;
    const matchesPreset = TESTED_PRESETS.some(
      (p) =>
        p.lineupSize === lineupSize &&
        p.gameGeneration === gameGeneration &&
        p.pointsCalculator === (normalizedCalc ?? null) &&
        p.winCondition === winCondition &&
        (pairingFormat ?? 'single_rack') === p.pairingFormat,
    );
    if (!matchesPreset) {
      // Distinguish "off-preset but has a calibrated formula" from
      // "off-preset and falls back to zero handicap." Fargo + games-won
      // + extra_games has a calibrated formula (computeFargoGamesWonThresholds,
      // validated against FargoRate's HOT chart) — don't tell the LO
      // their handicaps will fall to zero in that case.
      const hasCalibratedFormulaPath =
        formData['handicap-system'] === 'fargo' &&
        ((winCondition === 'games' &&
          (formData['mechanism'] ?? 'extra_games') === 'extra_games') ||
          (winCondition === 'points' &&
            (formData['mechanism'] ?? 'start_points') === 'start_points'));

      warnings.push({
        severity: 'warning',
        code: 'warning.off_preset_combo',
        message: hasCalibratedFormulaPath
          ? 'This combination is outside the three Tested Preset bundles (BCA 3v3, BCA 5v5, Fargo 5v5). It will work — handicaps come from the FargoRate formula path. The Threshold Source step will confirm what runs at lineup lock.'
          : 'This combination is outside the three Tested Preset bundles (BCA 3v3, BCA 5v5, Fargo 5v5). It will work, but no calibrated handicap chart exists for this exact mix — captains enter thresholds at lineup lock, or pick "Play unhandicapped" on the Threshold Source step.',
      });
    }
  }

  return { errors, warnings };
}
