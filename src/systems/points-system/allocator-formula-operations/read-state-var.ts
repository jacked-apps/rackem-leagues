/**
 * @fileoverview Allocator-formula operation: `read_state_var`.
 *
 * Reads a single named value from the shared match-state bag and returns it
 * as the side's per-game contribution. Honors **R11** of the Per-Game
 * Allocator Room plan: anywhere the allocator takes a number, that number
 * can be either a literal OR a reference to a state-bag value by name.
 *
 * **Concrete use (Ed's example — "points per game set by a threshold"):**
 *   `{ operationKind: 'read_state_var',
 *      operationArgs: { var_name: 'pointsPerGame' } }`
 *
 * Paired with a threshold that writes `pointsPerGame` at match start
 * (e.g. a "this league is 5-point" threshold), the winner side reads
 * the bag every game and gets that many points. The allocator does not
 * know what wrote `pointsPerGame` — the bag is the only connection.
 * Same rule triggers already follow ([[feedback_state_bag_starts_empty]],
 * `docs/league-system/modules/points-system/trigger.md`).
 *
 * **Arg shape:** declared on the operation; the validator
 * (`composition-validator.ts`) checks the row at load time.
 *   - `var_name: string` — the state-bag variable name to read.
 *
 * **Missing or non-numeric state:** returns `0` and console.warns. The
 * allocator-evaluator's never-throw discipline + the runtime backstop
 * (Unit 4) keep the page rendering and W/L recording intact even when
 * a variation references a name no one writes — the variation's
 * derived output may be wrong, but the ground rules survive.
 *
 * **First-class UI affordance.** Workshop UI (Unit 6) surfaces this
 * recipe as a peer-level side kind ("state-bag value"), not buried in
 * the formula picker. The free-text "variable name" input maps to the
 * `var_name` arg.
 */

import { registerAllocatorFormulaOperation } from '../allocator-formula-registry';
import type { AllocatorFormulaOperation } from '../types';

export const readStateVarOperation: AllocatorFormulaOperation = {
  name: 'read_state_var',
  argsShape: {
    var_name: { kind: 'state_var_name', required: true },
  },
  compute: (args, _ctx, state) => {
    const varName = args.var_name;
    if (typeof varName !== 'string') {
      // Validator should have caught this; defensive fallback.
      console.warn(
        `read_state_var: args.var_name must be a string, got ${JSON.stringify(varName)}; returning 0`,
      );
      return 0;
    }
    const value = state[varName];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      console.warn(
        `read_state_var: state variable "${varName}" is missing or non-numeric (got ${JSON.stringify(value)}); returning 0`,
      );
      return 0;
    }
    return value;
  },
};

export function registerReadStateVar(): void {
  registerAllocatorFormulaOperation(readStateVarOperation);
}

registerReadStateVar();
