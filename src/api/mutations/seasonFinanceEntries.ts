/**
 * @fileoverview Mutations for season_finance_entries.
 * Add / delete only — no per-row edit in v1 (LO deletes + re-adds
 * if they typo'd something).
 */

import { supabase } from '@/supabaseClient';
import type { SeasonFinanceEntryType } from '../queries/seasonFinanceEntries';

export interface AddFinanceEntryParams {
  seasonId: string;
  entryType: SeasonFinanceEntryType;
  amount?: number; // required for expense/credit; ignored for dropped_team
  description: string;
  entryDate?: string; // ISO date; defaults to today
  loFunded?: boolean; // expenses only
  droppedTeamId?: string; // dropped_team only
  droppedAtWeek?: number; // dropped_team only
}

export async function addFinanceEntry(params: AddFinanceEntryParams): Promise<void> {
  const { error } = await supabase.from('season_finance_entries').insert({
    season_id: params.seasonId,
    entry_type: params.entryType,
    amount: params.amount ?? null,
    description: params.description,
    entry_date: params.entryDate ?? new Date().toISOString().slice(0, 10),
    lo_funded: params.loFunded ?? false,
    dropped_team_id: params.droppedTeamId ?? null,
    dropped_at_week: params.droppedAtWeek ?? null,
  });

  if (error) {
    throw new Error(`Failed to add finance entry: ${error.message}`);
  }
}

export async function deleteFinanceEntry(entryId: string): Promise<void> {
  const { error } = await supabase
    .from('season_finance_entries')
    .delete()
    .eq('id', entryId);

  if (error) {
    throw new Error(`Failed to delete finance entry: ${error.message}`);
  }
}
