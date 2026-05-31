/**
 * @fileoverview Query for the season's finance line items.
 */

import { supabase } from '@/supabaseClient';

export type SeasonFinanceEntryType = 'expense' | 'credit' | 'dropped_team';

export interface SeasonFinanceEntryRow {
  id: string;
  season_id: string;
  entry_type: SeasonFinanceEntryType;
  amount: number | null;
  description: string;
  entry_date: string;
  lo_funded: boolean;
  dropped_team_id: string | null;
  dropped_at_week: number | null;
  created_at: string;
  updated_at: string;
}

export async function getSeasonFinanceEntries(
  seasonId: string,
): Promise<SeasonFinanceEntryRow[]> {
  const { data, error } = await supabase
    .from('season_finance_entries')
    .select('*')
    .eq('season_id', seasonId)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load finance entries: ${error.message}`);
  }
  return (data ?? []) as SeasonFinanceEntryRow[];
}
