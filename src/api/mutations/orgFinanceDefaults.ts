/**
 * @fileoverview Mutation for org_finance_defaults — single upsert.
 * No delete needed; the org row either exists with defaults or
 * doesn't (in which case the hardcoded fallback applies).
 */

import { supabase } from '@/supabaseClient';
import type { OrgFinanceDefaultsRow } from '../queries/leagueFinances';

export type OrgFinanceDefaultsUpsertParams = OrgFinanceDefaultsRow;

export async function upsertOrgFinanceDefaults(
  params: OrgFinanceDefaultsUpsertParams,
): Promise<void> {
  const { error } = await supabase
    .from('org_finance_defaults')
    .upsert(params, { onConflict: 'organization_id' });

  if (error) {
    throw new Error(`Failed to save org finance defaults: ${error.message}`);
  }
}
