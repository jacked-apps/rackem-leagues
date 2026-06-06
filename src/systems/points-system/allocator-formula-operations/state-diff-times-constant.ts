/**
 * @fileoverview Allocator-formula operation: `state_diff_times_constant`.
 *
 * Computes `(state[args.minuend_var] - state[args.subtrahend_var]) * args.multiplier`.
 * Demonstrates reading TWO state variables in one allocator formula —
 * the canonical "handicap-aware" pattern where points awarded per game
 * depend on cumulative match-state (e.g., a "behind-boost" that gives more
 * points per game won when a team is trailing).
 *
 * **Concrete use (behind-boost example):**
 *   `{ operationKind: 'state_diff_times_constant',
 *      operationArgs: {
 *        minuend_var: 'total_games',
 *        subtrahend_var: 'home_wins',
 *        multiplier: 0.5
 *      } }`
 *
 * Then `result = (total_games - home_wins) * 0.5` — winner gets more points
 * per game when home is further behind on wins.
 *
 * **Arg shape:**
 *  - `minuend_var: string` — name of the state variable for the minuend
 *  - `subtrahend_var: string` — name of the state variable for the subtrahend
 *  - `multiplier: number` — scalar applied to the difference
 *
 * Throws on missing/non-numeric state vars — composition error surfaced at
 * resolve time rather than silent NaN propagation.
 */

import { registerAllocatorFormulaOperation } from '../allocator-formula-registry';
import type { AllocatorFormulaOperation } from '../types';

export const stateDiffTimesConstantOperation: AllocatorFormulaOperation = {
  name: 'state_diff_times_constant',
  argsShape: {
    minuend_var: { kind: 'state_var_name', required: true },
    subtrahend_var: { kind: 'state_var_name', required: true },
    multiplier: { kind: 'number', required: true },
  },
  compute: (args, _ctx, state) => {
    const minuendVar = args.minuend_var;
    const subtrahendVar = args.subtrahend_var;
    const multiplier = args.multiplier;

    if (typeof minuendVar !== 'string') {
      throw new Error(
        `state_diff_times_constant: args.minuend_var must be a string, got ${JSON.stringify(minuendVar)}`,
      );
    }
    if (typeof subtrahendVar !== 'string') {
      throw new Error(
        `state_diff_times_constant: args.subtrahend_var must be a string, got ${JSON.stringify(subtrahendVar)}`,
      );
    }
    if (typeof multiplier !== 'number' || !Number.isFinite(multiplier)) {
      throw new Error(
        `state_diff_times_constant: args.multiplier must be a finite number, got ${JSON.stringify(multiplier)}`,
      );
    }

    const minuendValue = state[minuendVar];
    const subtrahendValue = state[subtrahendVar];
    if (typeof minuendValue !== 'number') {
      throw new Error(
        `state_diff_times_constant: state variable "${minuendVar}" expected numeric, got ${JSON.stringify(minuendValue)}`,
      );
    }
    if (typeof subtrahendValue !== 'number') {
      throw new Error(
        `state_diff_times_constant: state variable "${subtrahendVar}" expected numeric, got ${JSON.stringify(subtrahendValue)}`,
      );
    }

    return (minuendValue - subtrahendValue) * multiplier;
  },
};

export function registerStateDiffTimesConstant(): void {
  registerAllocatorFormulaOperation(stateDiffTimesConstantOperation);
}

registerStateDiffTimesConstant();
