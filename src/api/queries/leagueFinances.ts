/**
 * @fileoverview Query: resolved finance settings for a league.
 *
 * Merges league override → org default → hardcoded fallback into
 * one ResolvedFinanceSettings object the calculator can use directly.
 *
 * Also returns the org's raw default row and the league's raw
 * override row so the UI can show "you're inheriting from org" /
 * "you've overridden this" badges.
 */

import { supabase } from '@/supabaseClient';
import type { ResolvedFinanceSettings, PayoutShape, LoCutKind } from '@/utils/finances';

/** Hardcoded fallback applied when both league + org rows are absent. */
const HARDCODED_DEFAULTS: ResolvedFinanceSettings = {
  pricePerPlayerPerNight: 10,
  greenFeePerPlayerPerNight: 2,
  loCutKind: 'percentage',
  loCutFlatPerWeek: 0,
  loCutPercent: 10,
  payoutShape: '50_30_20',
  payoutPlacesPaid: 3,
  payoutRoundingTarget: 25,
  customPayoutPercentages: null,
};

export interface LeagueFinancesQueryResult {
  /** What the calculator should use — fully merged. */
  resolved: ResolvedFinanceSettings;
  /** The raw league override row, or null if no override exists. */
  leagueOverride: LeagueFinanceSettingsRow | null;
  /** The raw org default row, or null if the org hasn't set defaults. */
  orgDefaults: OrgFinanceDefaultsRow | null;
}

export interface OrgFinanceDefaultsRow {
  organization_id: string;
  price_per_player_per_night: number;
  green_fee_per_player_per_night: number;
  lo_cut_kind: LoCutKind;
  lo_cut_flat_per_week: number;
  lo_cut_percent: number;
  payout_shape: PayoutShape;
  payout_places_paid: number;
  payout_rounding_target: number;
}

export interface LeagueFinanceSettingsRow {
  league_id: string;
  price_per_player_per_night: number | null;
  green_fee_per_player_per_night: number | null;
  lo_cut_kind: LoCutKind | null;
  lo_cut_flat_per_week: number | null;
  lo_cut_percent: number | null;
  payout_shape: PayoutShape | null;
  payout_places_paid: number | null;
  payout_rounding_target: number | null;
  custom_payout_percentages: number[] | null;
}

export async function getLeagueFinances(
  leagueId: string,
): Promise<LeagueFinancesQueryResult> {
  // Fetch the league row to get organization_id
  const { data: league, error: leagueErr } = await supabase
    .from('leagues')
    .select('id, organization_id')
    .eq('id', leagueId)
    .single();

  if (leagueErr || !league) {
    throw new Error(`Failed to load league: ${leagueErr?.message ?? 'not found'}`);
  }

  // Fetch org defaults + league override in parallel
  const [orgRes, leagueOverrideRes] = await Promise.all([
    supabase
      .from('org_finance_defaults')
      .select('*')
      .eq('organization_id', league.organization_id)
      .maybeSingle(),
    supabase
      .from('league_finance_settings')
      .select('*')
      .eq('league_id', leagueId)
      .maybeSingle(),
  ]);

  const orgDefaults = (orgRes.data ?? null) as OrgFinanceDefaultsRow | null;
  const leagueOverride = (leagueOverrideRes.data ?? null) as LeagueFinanceSettingsRow | null;

  // Resolve: league override → org default → hardcoded
  const resolved: ResolvedFinanceSettings = {
    pricePerPlayerPerNight:
      leagueOverride?.price_per_player_per_night ??
      orgDefaults?.price_per_player_per_night ??
      HARDCODED_DEFAULTS.pricePerPlayerPerNight,
    greenFeePerPlayerPerNight:
      leagueOverride?.green_fee_per_player_per_night ??
      orgDefaults?.green_fee_per_player_per_night ??
      HARDCODED_DEFAULTS.greenFeePerPlayerPerNight,
    loCutKind:
      leagueOverride?.lo_cut_kind ??
      orgDefaults?.lo_cut_kind ??
      HARDCODED_DEFAULTS.loCutKind,
    loCutFlatPerWeek:
      leagueOverride?.lo_cut_flat_per_week ??
      orgDefaults?.lo_cut_flat_per_week ??
      HARDCODED_DEFAULTS.loCutFlatPerWeek,
    loCutPercent:
      leagueOverride?.lo_cut_percent ??
      orgDefaults?.lo_cut_percent ??
      HARDCODED_DEFAULTS.loCutPercent,
    payoutShape:
      leagueOverride?.payout_shape ??
      orgDefaults?.payout_shape ??
      HARDCODED_DEFAULTS.payoutShape,
    payoutPlacesPaid:
      leagueOverride?.payout_places_paid ??
      orgDefaults?.payout_places_paid ??
      HARDCODED_DEFAULTS.payoutPlacesPaid,
    payoutRoundingTarget:
      leagueOverride?.payout_rounding_target ??
      orgDefaults?.payout_rounding_target ??
      HARDCODED_DEFAULTS.payoutRoundingTarget,
    customPayoutPercentages: leagueOverride?.custom_payout_percentages ?? null,
  };

  return { resolved, leagueOverride, orgDefaults };
}
