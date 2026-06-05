/**
 * @fileoverview Top-level orchestrator that combines the four math
 * functions + line items + individual awards + mode selection into
 * one `ComputedFinances` snapshot the calculator UI renders.
 *
 * Pure function. No React, no DB. Single source of truth for "what
 * does the calculator show right now."
 */

import { computeProjectedIncome, computeProjectedGreenFees, computeAppFee } from './computeIncome';
import { computeLoCut } from './computeLoCut';
import { distributePrizes } from './distributePrizes';
import type {
  ComputedFinances,
  DroppedTeam,
  IndividualAward,
  PayoutMode,
  PayoutShape,
  LoCutKind,
} from './types';

export interface PayoutPlanInput {
  // Formula inputs
  pricePerPlayerPerNight: number;
  greenFeePerPlayerPerNight: number;
  lineupSize: number;
  teamCount: number;
  totalWeeks: number;
  droppedTeams: DroppedTeam[];

  // LO cut (live-overridable from calculator)
  loCutKind: LoCutKind;
  loCutFlatPerWeek: number;
  loCutPercent: number;

  // Line items
  totalExpenses: number; // pool-funded only
  totalCredits: number;

  // Mode + per-mode params
  mode: PayoutMode;
  manualPool?: number; // for mode='manual_pool'
  targetPayoutPercent?: number; // for mode='target_pct' (0-100)

  // Distribution
  payoutShape: PayoutShape;
  payoutPlacesPaid: number;
  payoutRoundingTarget: number;
  customPayoutPercentages: number[] | null;

  // Individual awards
  individualAwards: IndividualAward[];
}

export function computePayoutPlan(input: PayoutPlanInput): ComputedFinances {
  const projectedIncome = computeProjectedIncome({
    pricePerPlayerPerNight: input.pricePerPlayerPerNight,
    lineupSize: input.lineupSize,
    teamCount: input.teamCount,
    totalWeeks: input.totalWeeks,
    droppedTeams: input.droppedTeams,
  });
  const projectedGreenFees = computeProjectedGreenFees({
    greenFeePerPlayerPerNight: input.greenFeePerPlayerPerNight,
    lineupSize: input.lineupSize,
    teamCount: input.teamCount,
    totalWeeks: input.totalWeeks,
    droppedTeams: input.droppedTeams,
  });
  const appFee = computeAppFee({ teamCount: input.teamCount, totalWeeks: input.totalWeeks });

  const preCutPool = Math.max(0, projectedIncome - projectedGreenFees - appFee);
  const loCutAmount = computeLoCut({
    kind: input.loCutKind,
    flatPerWeek: input.loCutFlatPerWeek,
    percent: input.loCutPercent,
    totalWeeks: input.totalWeeks,
    preCutPool,
  });

  // The formula-derived prize pool — what 'auto' mode uses
  const formulaPool = Math.max(
    0,
    preCutPool - loCutAmount - input.totalExpenses + input.totalCredits,
  );

  // Resolve the pool based on mode
  let prePoolDistributable: number;
  if (input.mode === 'manual_pool') {
    prePoolDistributable = Math.max(0, input.manualPool ?? 0);
  } else if (input.mode === 'target_pct') {
    const pct = Math.max(0, Math.min(100, input.targetPayoutPercent ?? 100));
    prePoolDistributable = Math.max(0, formulaPool * (pct / 100));
  } else {
    prePoolDistributable = formulaPool;
  }

  // Carve out pool-funded individual awards before distributing to teams
  const totalIndividualAwardsFromPool = input.individualAwards
    .filter((a) => !a.loFunded)
    .reduce((acc, a) => acc + (a.amount || 0), 0);

  const teamPool = Math.max(0, prePoolDistributable - totalIndividualAwardsFromPool);

  const prizeAllocations = distributePrizes({
    pool: teamPool,
    shape: input.payoutShape,
    placesPaid: input.payoutPlacesPaid,
    roundingTarget: input.payoutRoundingTarget,
    customPercentages: input.customPayoutPercentages,
  });

  return {
    projectedIncome,
    projectedGreenFees,
    appFee,
    loCutAmount,
    totalExpenses: input.totalExpenses,
    totalCredits: input.totalCredits,
    totalIndividualAwardsFromPool,
    prePoolDistributable,
    teamPool,
    prizeAllocations,
    individualAwards: input.individualAwards,
  };
}
