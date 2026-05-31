/**
 * @fileoverview Query: organization-level finance defaults.
 *
 * Returns the raw row or null. The "merged" view (org → league)
 * already lives in `getLeagueFinances` — this query is just for the
 * org settings UI to edit the defaults directly.
 */

import { supabase } from '@/supabaseClient';
import type { OrgFinanceDefaultsRow } from './leagueFinances';

export async function getOrgFinanceDefaults(
  organizationId: string,
): Promise<OrgFinanceDefaultsRow | null> {
  const { data, error } = await supabase
    .from('org_finance_defaults')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load org finance defaults: ${error.message}`);
  }
  return (data ?? null) as OrgFinanceDefaultsRow | null;
}
