/**
 * @fileoverview Shared types for the league finances / payout
 * calculator math engine. Keep these dependency-free (no React, no
 * supabase types) so the math layer is portable + easy to unit-test.
 */

export type LoCutKind = 'flat' | 'percentage' | 'both';

export type PayoutShape =
  | '50_30_20'
  | '40_30_20_10'
  | '35_25_20_12_8'
  | 'doubling'
  | 'sliding_scale'
  | 'flat'
  | 'custom';

/** Resolved finance settings — what the calculator actually uses,
 *  after merging league override → org default → hardcoded fallback. */
export interface ResolvedFinanceSettings {
  pricePerPlayerPerNight: number;
  greenFeePerPlayerPerNight: number;
  loCutKind: LoCutKind;
  loCutFlatPerWeek: number;
  loCutPercent: number;
  payoutShape: PayoutShape;
  payoutPlacesPaid: number;
  payoutRoundingTarget: number; // 0 = no rounding
  customPayoutPercentages: number[] | null; // only when payoutShape='custom'
}

/** A team that dropped mid-season — calculator subtracts their lost
 *  weeks from projected income. */
export interface DroppedTeam {
  teamId: string;
  droppedAtWeek: number; // 1-based
}

/** Per-season expense or credit line item (the polymorphic
 *  season_finance_entries shape, projected into the math layer). */
export interface FinanceEntry {
  id: string;
  type: 'expense' | 'credit';
  amount: number;
  description: string;
  loFunded: boolean; // expenses only — true = doesn't reduce pool
}

/** Output of `distributePrizes` — one row per paid place. */
export interface PrizeAllocation {
  place: number; // 1-based
  amount: number;
}

/** Calculator mode: how the prize pool size is determined.
 *  - 'auto'        — formula income − green fees − app fee − LO cut − expenses + credits
 *  - 'manual_pool' — LO types in a target pool dollar amount
 *  - 'target_pct'  — LO sets target % of the formula pool to pay out
 */
export type PayoutMode = 'auto' | 'manual_pool' | 'target_pct';

/** Individual award (Top Shooter, Outstanding Achievement, etc.).
 *  `loFunded=true` means the award is paid by the LO personally and
 *  does NOT reduce the prize pool. */
export interface IndividualAward {
  id: string; // stable client-side id for list keys + edits
  label: string;
  amount: number;
  loFunded: boolean;
}

/** Full computed snapshot ready for the calculator UI. */
export interface ComputedFinances {
  projectedIncome: number;
  projectedGreenFees: number;
  appFee: number;
  loCutAmount: number;
  totalExpenses: number; // only pool-funded
  totalCredits: number;
  totalIndividualAwardsFromPool: number; // non-LO-funded awards subtracted from team pool
  /** Pool BEFORE individual awards are carved out. */
  prePoolDistributable: number;
  /** Pool AFTER individual awards are carved out — what gets distributed to teams. */
  teamPool: number;
  prizeAllocations: PrizeAllocation[];
  individualAwards: IndividualAward[];
}
