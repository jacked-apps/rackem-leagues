/**
 * @fileoverview Allocator-formula operation: `add_complement_of_other_side`.
 *
 * Computes `ctx[this_side] + (args.max - ctx[args.other_side])`. Used by the
 * 17-Point Scoring System's winner side: the winner gets their base value
 * (10) plus the complement of what the loser pocketed, so the total
 * distributed per game is always (winner_base + max) — a zero-sum
 * 17-point-per-game split.
 *
 * **Concrete use (17-Point winner):**
 *   `{ operationKind: 'add_complement_of_other_side',
 *      operationArgs: { max: 7, other_side: 'loser' } }`
 *
 * Then with a base of 10 and the loser pocketing 3 balls:
 *   `result = 10 + (7 - 3) = 14`
 *
 * **Arg shape:**
 *  - `max: number` — the cap that the other side's value is subtracted from
 *  - `other_side: 'winner' | 'loser'` — which side's value to read from ctx
 */

import { registerAllocatorFormulaOperation } from '../allocator-formula-registry';
import type { AllocatorFormulaOperation } from '../types';

export const addComplementOfOtherSideOperation: AllocatorFormulaOperation = {
  name: 'add_complement_of_other_side',
  argsShape: {
    max: { kind: 'number', required: true },
    other_side: { kind: 'side_name', required: true },
  },
  compute: (args, ctx) => {
    const max = args.max;
    const otherSide = args.other_side;
    if (typeof max !== 'number' || !Number.isFinite(max)) {
      throw new Error(
        `add_complement_of_other_side: args.max must be a finite number, got ${JSON.stringify(max)}`,
      );
    }
    if (otherSide !== 'winner' && otherSide !== 'loser') {
      throw new Error(
        `add_complement_of_other_side: args.other_side must be 'winner' or 'loser', got ${JSON.stringify(otherSide)}`,
      );
    }
    const thisSideValue = ctx[ctx.thisSide];
    const otherSideValue = ctx[otherSide];
    return thisSideValue + (max - otherSideValue);
  },
};

export function registerAddComplementOfOtherSide(): void {
  registerAllocatorFormulaOperation(addComplementOfOtherSideOperation);
}

registerAddComplementOfOtherSide();
