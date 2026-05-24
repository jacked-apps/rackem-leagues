/**
 * @fileoverview Extra Games Mechanism — extended-finish on the games axis.
 *
 * Per the locked extra-games.md variant page, the stronger team needs MORE
 * games to win the match than the weaker team. The Mechanism declares the
 * shape; the asymmetric per-side target values come from a Games-Needed
 * Threshold Chart.
 *
 * Factory pattern: `createExtraGamesMechanism(chart)` binds an instance of
 * this Mechanism to a specific Games-Needed Chart variant
 * (`gamesNeeded3v3Chart`, `gamesNeeded3v3FormulaChart`,
 * `gamesNeeded5v5Chart`, `gamesNeeded5v5FormulaChart`). The Module catalog
 * lists "Extra Games" as one Mechanism — the (Mechanism × Chart) pairing
 * happens at resolve time inside `buildSystemFromPreferences`.
 *
 * @see docs/league-system/modules/handicap-mechanisms/extra-games.md
 */

import type { GamesNeededChart } from '../threshold-charts/types';
import type { ExtraGamesMechanism } from './types';

/**
 * Build an Extra Games Mechanism instance bound to a specific Games-Needed
 * Chart. The Mechanism's `compute` delegates to the Chart's `compute`,
 * passing the signed handicap difference through.
 *
 * @param chart Any Games-Needed Chart variant (table or formula shape, 3v3
 *   or 5v5 calibration — all four implement the same compute signature).
 * @returns An ExtraGamesMechanism instance ready to feed into SystemModule.
 */
export function createExtraGamesMechanism(
  chart: GamesNeededChart,
): ExtraGamesMechanism {
  return {
    kind: 'extra_games',
    compute: (handicapDiff, overrides) => {
      void overrides; // reserved for future per-mechanism dials; not consumed today
      return chart.compute(handicapDiff);
    },
  };
}

/**
 * Pre-built zero-handicap Extra Games Mechanism — the `'none'` case.
 *
 * Per the locked spec's "The `'none'` case" section: `mechanism='none'`
 * collapses to a zero-handicap extra_games shape so callers see a uniform
 * `mechanism.kind === 'extra_games'` instead of a null/undefined branch.
 *
 * Used when `handicap_type='none'` — the league runs without handicapping;
 * no per-side asymmetry is applied.
 */
export const noneMechanism: ExtraGamesMechanism = {
  kind: 'extra_games',
  compute: () => ({
    games_to_win: 0,
    games_to_tie: null,
    games_to_lose: null,
  }),
};
