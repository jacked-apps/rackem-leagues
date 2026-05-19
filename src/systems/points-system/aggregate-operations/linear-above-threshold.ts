/**
 * @fileoverview Aggregate operation: `linear_above_threshold`.
 *
 * The (D) end-of-match aggregate used by Points 3-Man. Computes per-side
 * per-match points from games-won relative to the per-side win/tie targets,
 * with the locked 3v3 9-9 tie-band absorption rule.
 *
 * **Reads from the state bag (by convention):**
 *  - `home_wins`, `away_wins` — cumulative game wins
 *  - `homeWinTarget`, `awayWinTarget` — per-side win thresholds (populated by
 *    the composition's receipt triggers)
 *  - `homeTieTarget`, `awayTieTarget` — per-side tie thresholds (may be null
 *    when ties aren't possible at the given handicap diff)
 *
 * **Arg shape:**
 *  - `multiplier: number` — scales the linear bands (default 1). The tie band
 *    stays at 0 regardless of multiplier.
 *
 * **Locked tie-band rule (per docs/league-system/modules/points-system/README.md):**
 * when a side's games_won lands in the tie band (tieTarget ≤ games_won ≤
 * winTarget), that side's per-match points = 0 — regardless of multiplier,
 * regardless of any subsequent Tiebreak System edge. Fixed in code, not
 * configurable. Stripping it breaks the documented Points 3-Man contract.
 *
 * **Three-band formula:**
 *  - Above-win:   games_won > W       → (games_won − W) × multiplier
 *  - Tie band:    T ≤ games_won ≤ W   → 0 (locked)
 *  - Below-tie:   games_won < T       → (games_won − T) × multiplier
 *
 * When tieTarget is null (ties impossible), the formula reduces to
 * `(games_won − W) × multiplier` everywhere.
 *
 * @see src/systems/calculators/linear_above_threshold.ts — legacy bundled
 *   implementation this replaces (cross-audited)
 */

import { registerAggregateOperation } from '../aggregate-registry';
import type { AggregateOperation, MatchStateBag } from '../types';

function readNumber(state: Readonly<MatchStateBag>, key: string): number {
  const v = state[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(
      `linear_above_threshold: state variable "${key}" expected numeric, got ${JSON.stringify(v)}`,
    );
  }
  return v;
}

function readNullableNumber(state: Readonly<MatchStateBag>, key: string): number | null {
  const v = state[key];
  if (v === undefined || v === null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return v;
}

function computeSidePoints(
  gamesWon: number,
  winTarget: number,
  tieTarget: number | null,
  multiplier: number,
): number {
  if (tieTarget === null) {
    return (gamesWon - winTarget) * multiplier;
  }
  if (gamesWon > winTarget) {
    return (gamesWon - winTarget) * multiplier;
  }
  if (gamesWon < tieTarget) {
    return (gamesWon - tieTarget) * multiplier;
  }
  // Tie band — locked invariant: 0 regardless of multiplier.
  return 0;
}

export const linearAboveThresholdOperation: AggregateOperation = {
  name: 'linear_above_threshold',
  compute: (args, state) => {
    const multiplier =
      typeof args.multiplier === 'number' && Number.isFinite(args.multiplier)
        ? args.multiplier
        : 1;
    return {
      homePoints: computeSidePoints(
        readNumber(state, 'home_wins'),
        readNumber(state, 'homeWinTarget'),
        readNullableNumber(state, 'homeTieTarget'),
        multiplier,
      ),
      awayPoints: computeSidePoints(
        readNumber(state, 'away_wins'),
        readNumber(state, 'awayWinTarget'),
        readNullableNumber(state, 'awayTieTarget'),
        multiplier,
      ),
    };
  },
};

export function registerLinearAboveThreshold(): void {
  registerAggregateOperation(linearAboveThresholdOperation);
}

registerLinearAboveThreshold();
