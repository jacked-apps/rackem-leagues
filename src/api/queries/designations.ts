/**
 * @fileoverview Live resolution of a member's designations from the store.
 *
 * A designation describes the PERSON (developer today; host / may-own-org later)
 * — as opposed to a permission, which says what someone may do and where
 * (organization_staff). Read alongside the member profile to drive UI
 * affordances; the server-side helper `member_has_designation` is the authority.
 */

import { supabase } from '@/supabaseClient';

/**
 * Fetch the names of every ACTIVE designation a member holds.
 *
 * "Active" means the record has not been ended (`ended_at IS NULL`). Grants are
 * assigned by hand (SQL) in Phase 1 — there is deliberately no app write path.
 *
 * @param memberId - The member's primary-key id.
 * @returns Active designation names (e.g. `['developer']`); empty if none.
 * @throws If the database read fails.
 */
export async function getMemberDesignations(memberId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('member_designations')
    .select('designation')
    .eq('member_id', memberId)
    .is('ended_at', null);

  if (error) {
    throw new Error(`Failed to fetch designations: ${error.message}`);
  }

  return (data ?? []).map((row) => row.designation);
}
