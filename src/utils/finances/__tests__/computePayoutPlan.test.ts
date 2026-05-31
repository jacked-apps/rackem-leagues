/**
 * @fileoverview Tests for the calculator orchestrator. Covers the
 * three modes (auto / manual_pool / target_pct) and the
 * individual-awards carve-out.
 */

import { describe, it, expect } from 'vitest';
import { computePayoutPlan } from '../computePayoutPlan';

const BASE_INPUT = {
  pricePerPlayerPerNight: 10,
  greenFeePerPlayerPerNight: 2,
  lineupSize: 5,
  teamCount: 8,
  totalWeeks: 16,
  droppedTeams: [],
  loCutKind: 'percentage' as const,
  loCutFlatPerWeek: 0,
  loCutPercent: 10,
  totalExpenses: 0,
  totalCredits: 0,
  mode: 'auto' as const,
  payoutShape: '50_30_20' as const,
  payoutPlacesPaid: 3,
  payoutRoundingTarget: 0,
  customPayoutPercentages: null,
  individualAwards: [],
};

describe('computePayoutPlan', () => {
  it('auto mode uses the formula pool', () => {
    const plan = computePayoutPlan(BASE_INPUT);
    // income = 10 * 5 * 8 * 16 = 6400
    // green  =  2 * 5 * 8 * 16 = 1280
    // appFee = 8 * 16 * 1 + 10 = 138
    // preCut = 6400 - 1280 - 138 = 4982
    // loCut  = 4982 * 0.10 = 498.20
    // pool   = 4982 - 498.20 = 4483.80
    expect(plan.projectedIncome).toBe(6400);
    expect(plan.projectedGreenFees).toBe(1280);
    expect(plan.appFee).toBe(138);
    expect(plan.loCutAmount).toBeCloseTo(498.2, 2);
    expect(plan.prePoolDistributable).toBeCloseTo(4483.8, 2);
    expect(plan.teamPool).toBeCloseTo(4483.8, 2);
    expect(plan.prizeAllocations).toHaveLength(3);
  });

  it('manual_pool mode ignores formula and uses the typed amount', () => {
    const plan = computePayoutPlan({
      ...BASE_INPUT,
      mode: 'manual_pool',
      manualPool: 5000,
    });
    expect(plan.prePoolDistributable).toBe(5000);
    expect(plan.teamPool).toBe(5000);
    expect(plan.prizeAllocations[0].amount).toBeCloseTo(2500, 2); // 50% of 5000
    expect(plan.prizeAllocations[1].amount).toBeCloseTo(1500, 2); // 30%
    expect(plan.prizeAllocations[2].amount).toBeCloseTo(1000, 2); // 20%
  });

  it('target_pct mode scales the formula pool by the percentage', () => {
    const plan = computePayoutPlan({
      ...BASE_INPUT,
      mode: 'target_pct',
      targetPayoutPercent: 50,
    });
    // formula pool was 4483.80; 50% = 2241.90
    expect(plan.prePoolDistributable).toBeCloseTo(2241.9, 2);
  });

  it('individual awards (pool-funded) reduce the team pool', () => {
    const plan = computePayoutPlan({
      ...BASE_INPUT,
      mode: 'manual_pool',
      manualPool: 1000,
      individualAwards: [
        { id: 'a', label: 'Top Shooter', amount: 100, loFunded: false },
        { id: 'b', label: 'LO gift', amount: 50, loFunded: true },
      ],
    });
    expect(plan.totalIndividualAwardsFromPool).toBe(100);
    expect(plan.teamPool).toBe(900); // 1000 - 100, LO-funded ignored
  });

  it('clamps target_pct between 0 and 100', () => {
    const high = computePayoutPlan({ ...BASE_INPUT, mode: 'target_pct', targetPayoutPercent: 200 });
    const low = computePayoutPlan({ ...BASE_INPUT, mode: 'target_pct', targetPayoutPercent: -10 });
    expect(high.prePoolDistributable).toBeCloseTo(4483.8, 2); // capped at 100%
    expect(low.prePoolDistributable).toBe(0);
  });
});
