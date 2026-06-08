/**
 * @fileoverview Returns the ACTUAL source code of a built-in threshold's
 * calculation, for read-only display.
 *
 * No hand-written representation (that would drift). We show the real running
 * function via `Function.prototype.toString()` — for the formula ops we point
 * at the underlying "tiny program" (the if/then math); for the rest we show the
 * operation's own `compute`. This is the honest "show the code, read-only"
 * surface; an editable code editor is a later, gated-to-technical-users step.
 *
 * Note: in a dev build this is the readable transpiled source; a production
 * build would minify it (a reason the eventual editor stores the code as text).
 */

import { getThresholdOperation } from '@/systems/points-system/threshold-registry';
// Ensure every operation is registered so we can read its compute.
import '@/systems/points-system/operations/register-all';
import { computeThresholds as gamesNeeded3v3Formula } from '@/systems/threshold-charts/games-needed-3v3-formula';
import { computeFargoGamesWonThresholds } from '@/utils/handicap/fargoGamesWonThresholds';

/** Ops whose meaningful "tiny program" lives one level below `compute`. */
const DEEP: Record<string, () => string> = {
  games_needed_3v3_formula: () => gamesNeeded3v3Formula.toString(),
  fargo_games_won: () => computeFargoGamesWonThresholds.toString(),
};

/** The real source code behind a built-in threshold, or null if none. */
export function builtinCode(operationKind: string): string | null {
  const deep = DEEP[operationKind];
  if (deep) return deep();
  const op = getThresholdOperation(operationKind);
  return op ? op.compute.toString() : null;
}
