/**
 * @fileoverview Writes for the designations store.
 *
 * A designation is granted when a capability brings its own purchase path (the
 * host subscription is the first), or by hand (SQL) for developer. This is the
 * app-side grant used by the self-serve "Become a Host" flow.
 *
 * INTERIM AUTHORITY (A8): a proper grant verifies the caller's authority
 * server-side (a paid charge). Payments are mock today and RLS is disabled, so
 * this writes client-side — the same interim posture as the LO application's
 * createOrganization. Both new stores are explicitly in scope for the upcoming
 * security pass, where this moves behind a server-verified path.
 */

import { supabase } from '@/supabaseClient';

export interface GrantDesignationInput {
  /** The member receiving the designation. */
  memberId: string;
  /** Catalog designation name, e.g. 'host'. */
  designation: string;
  /** How it was obtained: 'purchase', 'manual', etc. */
  source?: string;
  /**
   * When the grant is scheduled to end (ISO timestamptz); null = never. Recorded
   * for honesty about the plan bought — expiry ENFORCEMENT (lapsing) is Phase 2,
   * so `member_has_designation` still treats the grant as active until it is
   * explicitly ended.
   */
  endsAt?: string | null;
  /** Who granted it, where a person was responsible (self for a self-purchase). */
  grantedBy?: string | null;
}

/**
 * Grant a designation to a member (inserts an active record).
 *
 * Fails if the member already holds an active record for this designation (the
 * store's partial-unique invariant) — callers should not offer the purchase to
 * someone who already holds it.
 *
 * @returns The new member_designations id.
 * @throws If the write fails (including the already-active conflict).
 */
export async function grantDesignation(input: GrantDesignationInput): Promise<string> {
  const { data, error } = await supabase
    .from('member_designations')
    .insert({
      member_id: input.memberId,
      designation: input.designation,
      source: input.source ?? 'manual',
      ends_at: input.endsAt ?? null,
      granted_by: input.grantedBy ?? null,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to grant designation: ${error.message}`);
  }

  return data.id;
}
