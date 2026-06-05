/**
 * @fileoverview Mutations for season_locked_payouts.
 *
 *   - lockSeasonPayouts: insert the immutable snapshot
 *   - unlockSeasonPayouts: delete the row (escape hatch — useful in
 *     dev / when LO catches a mistake before standings publish)
 */

import { supabase } from '@/supabaseClient';
import type { LockedTeamPayout, LockedIndividualAward } from '../queries/seasonLockedPayouts';

export interface LockSeasonPayoutsParams {
  seasonId: string;
  totalIncome: number;
  totalDeductions: number; // expenses subtracted from pool
  totalCredits: number;
  appFee: number;
  loCutAmount: number;
  finalPrizePool: number;
  teamPayouts: LockedTeamPayout[];
  individualAwards: LockedIndividualAward[];
  lockedByMemberId?: string | null;
}

export async function lockSeasonPayouts(params: LockSeasonPayoutsParams): Promise<void> {
  const { error } = await supabase.from('season_locked_payouts').insert({
    season_id: params.seasonId,
    total_income: params.totalIncome,
    total_deductions: params.totalDeductions,
    total_credits: params.totalCredits,
    app_fee: params.appFee,
    lo_cut_amount: params.loCutAmount,
    final_prize_pool: params.finalPrizePool,
    team_payouts: params.teamPayouts,
    individual_awards: params.individualAwards,
    locked_by_member_id: params.lockedByMemberId ?? null,
  });

  if (error) {
    throw new Error(`Failed to lock payouts: ${error.message}`);
  }
}

export async function unlockSeasonPayouts(seasonId: string): Promise<void> {
  const { error } = await supabase
    .from('season_locked_payouts')
    .delete()
    .eq('season_id', seasonId);

  if (error) {
    throw new Error(`Failed to unlock payouts: ${error.message}`);
  }
}
