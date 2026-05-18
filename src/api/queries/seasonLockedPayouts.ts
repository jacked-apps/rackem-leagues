/**
 * @fileoverview Query: immutable end-of-season payout snapshot.
 *
 * Returns the row or null. Presence of a row means payouts are
 * locked — the calculator UI should switch to read-only mode and
 * standings should show official prize amounts.
 */

import { supabase } from '@/supabaseClient';

export interface LockedTeamPayout {
  team_id: string | null; // null until LO maps places → teams
  place: number;
  amount: number;
}

export interface LockedIndividualAward {
  id: string;
  label: string;
  amount: number;
  lo_funded: boolean;
  member_id?: string | null; // null until LO maps award → member
}

export interface SeasonLockedPayoutsRow {
  id: string;
  season_id: string;
  total_income: number;
  total_deductions: number;
  total_credits: number;
  app_fee: number;
  lo_cut_amount: number;
  final_prize_pool: number;
  team_payouts: LockedTeamPayout[];
  individual_awards: LockedIndividualAward[];
  locked_at: string;
  locked_by_member_id: string | null;
}

export async function getSeasonLockedPayouts(
  seasonId: string,
): Promise<SeasonLockedPayoutsRow | null> {
  const { data, error } = await supabase
    .from('season_locked_payouts')
    .select('*')
    .eq('season_id', seasonId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load locked payouts: ${error.message}`);
  }
  return (data ?? null) as SeasonLockedPayoutsRow | null;
}
