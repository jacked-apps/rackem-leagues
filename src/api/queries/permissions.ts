/**
 * @fileoverview Live resolution of a member's authority from organization_staff.
 *
 * Phase 1, requirement A3: whether someone has operator access is COMPUTED at
 * ask time from their `organization_staff` rows — nothing is mirrored into a
 * separate record when staffing changes. Writing a derived record would just
 * relocate the old `members.role` sync bug into a new table.
 *
 * This is the single fetch that feeds the pure check layer in
 * `../permissions/permissions.ts`.
 */

import { supabase } from '@/supabaseClient';
import {
  POSITION_PERMISSIONS,
  type StaffGrant,
  type StaffPosition,
} from '../permissions/permissions';

/** The named levels the check layer understands, for defensive filtering below. */
const KNOWN_POSITIONS = new Set<string>(Object.keys(POSITION_PERMISSIONS));

/**
 * Fetch every staff grant a member holds, across all organizations.
 *
 * Returns one {@link StaffGrant} per `organization_staff` row: which org, which
 * named level, and the optional league scope (null = org-wide).
 *
 * An unrecognized `position` string is skipped rather than trusted — a stray
 * value must fail closed (no access), never crash the bundle lookup.
 *
 * @param memberId - The member's primary-key id.
 * @returns The member's grants (empty array if they hold none).
 * @throws If the database read itself fails.
 */
export async function getMemberStaffGrants(memberId: string): Promise<StaffGrant[]> {
  const { data, error } = await supabase
    .from('organization_staff')
    .select('organization_id, position, league_id')
    .eq('member_id', memberId);

  if (error) {
    throw new Error(`Failed to fetch staff grants: ${error.message}`);
  }

  return (data ?? [])
    .filter((row) => KNOWN_POSITIONS.has(row.position))
    .map((row) => ({
      organizationId: row.organization_id,
      position: row.position as StaffPosition,
      leagueId: row.league_id ?? null,
    }));
}
