/**
 * @fileoverview Barrel exports for the league finances math engine.
 *
 * Pure functions only. No DB, no React, no I/O. Anywhere that needs
 * to compute "given these inputs, what's the number" calls into here.
 */

export type {
  LoCutKind,
  PayoutShape,
  ResolvedFinanceSettings,
  DroppedTeam,
  FinanceEntry,
  PrizeAllocation,
  ComputedFinances,
} from './types';

export {
  computeProjectedIncome,
  computeProjectedGreenFees,
  computeAppFee,
} from './computeIncome';

export { computeLoCut } from './computeLoCut';

export { distributePrizes, percentagesForShape } from './distributePrizes';
