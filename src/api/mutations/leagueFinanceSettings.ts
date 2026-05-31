/**
 * @fileoverview Mutations for league_finance_settings.
 *
 * Two operations:
 *   - upsertLeagueFinanceSettings: write per-league override row
 *   - deleteLeagueFinanceSettings: clear the override → falls back
 *     to org defaults again
 */

import { supabase } from '@/supabaseClient';
import type { LeagueFinanceSettingsRow } from '../queries/leagueFinances';

export type LeagueFinanceSettingsUpsertParams = Partial<
  Omit<LeagueFinanceSettingsRow, 'league_id'>
> & {
  league_id: string;
};

export async function upsertLeagueFinanceSettings(
  params: LeagueFinanceSettingsUpsertParams,
): Promise<void> {
  const { error } = await supabase
    .from('league_finance_settings')
    .upsert(params, { onConflict: 'league_id' });

  if (error) {
    throw new Error(
      `Failed to save league finance settings: ${error.message}`,
    );
  }
}

export async function deleteLeagueFinanceSettings(leagueId: string): Promise<void> {
  const { error } = await supabase
    .from('league_finance_settings')
    .delete()
    .eq('league_id', leagueId);

  if (error) {
    throw new Error(
      `Failed to clear league finance settings: ${error.message}`,
    );
  }
}
