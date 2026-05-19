/**
 * @fileoverview `accumulated_per_game` points calculator —
 * per-game accumulation with per-side fixed-or-counter scoring (Phase 1 Unit
 * 1.4 of the modular-league-system v2 plan).
 *
 * The user's specification (verbatim from architectural conversation):
 *
 *   "winner points = {add+counter = false; points_added = 10}
 *    loser points = {add_counter = true; min = 0; max = 7;
 *                    loser-points = {counter entry}}"
 *
 * Each side (winner / loser) is independently configurable:
 *   - **fixed**: the side's contribution is a fixed points value, no input
 *     collected from the scorer (e.g., Fargo 10-7 winner: always 10 points).
 *   - **counter**: the side's contribution is a numeric value the scorer
 *     enters per game, clamped to a configured min/max range (e.g., Fargo
 *     10-7 loser: 0–7 balls pocketed).
 *
 * Tested Preset (Fargo 10-7):
 *   - winner: fixed 10
 *   - loser: counter 0–7, label "Balls pocketed"
 *
 * LO can edit any of the values to produce a different scoring system. A
 * 14/0 league sets winner=fixed-14 + loser=fixed-0. A "scorer enters racks
 * won" variant sets winner=counter + loser=fixed-0. Same calculator type;
 * different params.
 *
 * **Tiebreaker filtering:** the calculator does NOT filter on
 * `is_tiebreaker`. Phase 5 Unit 5.5's per-game scoring mutation decides
 * which subset of games to pass when computing running totals. Today's
 * only Tested Preset using this calculator (Fargo 5v5 10-7) plays 25 games
 * (odd, no ties possible) so this never comes up in practice. If a future
 * LO pairs this calculator with an even-game format AND ties happen, the
 * caller decides whether tiebreaker games count toward points.
 *
 * @see docs/plans/2026-05-01-001-feat-modular-league-system-v2-plan.md (Unit 1.4)
 */

import { z } from 'zod';
import type {
  PerGamePointsCalculator,
  ScoringPopupSideSpec,
} from './types';

// ============================================================================
// Params
// ============================================================================

/**
 * Per-side scoring config. Either a fixed points contribution (no input
 * collected per game) or a counter-with-range that the scorer fills in.
 */
export type SideScoringConfig =
  | { kind: 'fixed'; points: number }
  | { kind: 'counter'; min: number; max: number; label: string };

/**
 * Parameters for `accumulated_per_game`. Independent winner-side and
 * loser-side configs.
 */
export interface AccumulatedPerGameParams {
  winner: SideScoringConfig;
  loser: SideScoringConfig;
}

const sideConfigSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('fixed'),
    points: z.number().finite(),
  }),
  z.object({
    kind: z.literal('counter'),
    min: z.number().finite(),
    max: z.number().finite(),
    label: z.string(),
  }),
]);

export const accumulatedPerGameParamSchema = z.object({
  winner: sideConfigSchema,
  loser: sideConfigSchema,
});

/**
 * Tested Preset values (Fargo 10-7 default).
 *
 * Loser label is intentionally generic ("Points earned in this loss")
 * rather than 10-7-specific ("Balls pocketed"). The label happens to map
 * 1:1 with balls in Fargo 10-7's default config, but the column stores a
 * generic per-game value that the calculator's compute() interprets — a
 * future league with "2 points per ball" or any other formula reuses the
 * same label semantics. LOs can override the label per-league through
 * the calculator's params when the wizard exposes that surface.
 */
export const ACCUMULATED_PER_GAME_DEFAULT_PARAMS: AccumulatedPerGameParams = {
  winner: { kind: 'fixed', points: 10 },
  loser: { kind: 'counter', min: 0, max: 7, label: 'Points earned in this loss' },
};

// ============================================================================
// The math
// ============================================================================

/**
 * Resolve a side's per-game contribution given the side config and the
 * counter score (when applicable). For fixed configs, returns the fixed
 * value. For counter configs, clamps the score to [min, max]; defaults to
 * `min` (the safest fallback) when the score is null.
 */
function resolveSideContribution(
  config: SideScoringConfig,
  score: number | null,
): number {
  if (config.kind === 'fixed') {
    return config.points;
  }
  // counter — read the score, clamp to [min, max]; null/non-finite → min.
  if (score == null || !Number.isFinite(score)) return config.min;
  return Math.max(config.min, Math.min(config.max, score));
}

// ============================================================================
// Calculator
// ============================================================================

/**
 * The `accumulated_per_game` calculator. Per-game-input. Iterates the
 * games list; for each game with a winner, adds the appropriate side's
 * contribution to the requested team's running total.
 *
 * Tested Preset value: Fargo 10-7 default. LO can edit either side's
 * config (fixed → counter, fixed-points value, counter min/max/label).
 */
export const accumulatedPerGame: PerGamePointsCalculator<AccumulatedPerGameParams> = {
  name: 'accumulated_per_game',
  kind: 'per_game',
  defaultParams: ACCUMULATED_PER_GAME_DEFAULT_PARAMS,
  paramSchema: accumulatedPerGameParamSchema,

  /**
   * Per-game popup field spec — calculator-driven. Each side's spec maps
   * directly: 'fixed' shows nothing in the popup (implicit), 'counter'
   * shows a numeric input bound to [min, max] with the label as caption.
   */
  scoringPopupFields: (params) => {
    const sideToSpec = (config: SideScoringConfig): ScoringPopupSideSpec =>
      config.kind === 'fixed'
        ? { kind: 'fixed', points: config.points }
        : {
            kind: 'counter',
            min: config.min,
            max: config.max,
            label: config.label,
          };

    return {
      perSideInputs: {
        winner: sideToSpec(params.winner),
        loser: sideToSpec(params.loser),
      },
    };
  },

  // No display hints — per Ed's 2026-05-04 smoke-test feedback: the per-side
  // per-game point amounts (winner: 10, loser: 0-7) are static scoring rules
  // every player already knows from the league setup. Surfacing them on the
  // live scoreboard is noise. The escape-hatch interface remains available
  // on the calculator type if a future per-game calculator with genuinely
  // useful display info wants it. For Fargo 10-7 default config, nothing
  // renders.

  compute: ({ games, teamId }, params) => {
    // Empty/missing params → use defaults silently. The wizard writes
    // `{}` for leagues that didn't customize calculator params.
    const isEmpty =
      params == null ||
      (typeof params === 'object' && Object.keys(params as object).length === 0);

    let resolvedParams: AccumulatedPerGameParams;
    if (isEmpty) {
      resolvedParams = ACCUMULATED_PER_GAME_DEFAULT_PARAMS;
    } else {
      const parsed = accumulatedPerGameParamSchema.safeParse(params);
      if (parsed.success) {
        resolvedParams = parsed.data;
      } else {
        console.warn(
          '[accumulated_per_game] params failed zod validation — falling back to default params (Fargo 10-7)',
          { params, error: parsed.error.message },
        );
        resolvedParams = ACCUMULATED_PER_GAME_DEFAULT_PARAMS;
      }
    }

    let total = 0;
    for (const game of games) {
      // Skip games without a winner (incomplete or null winner — calculator
      // contributes nothing for those).
      if (game.winner_team_id == null) continue;

      if (game.winner_team_id === teamId) {
        // This team won — add the winner-side contribution.
        total += resolveSideContribution(resolvedParams.winner, game.winner_score);
      } else {
        // This team lost — add the loser-side contribution.
        total += resolveSideContribution(resolvedParams.loser, game.loser_score);
      }
    }
    return total;
  },
};
