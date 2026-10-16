/**
 * @fileoverview Organization Staff Mutation Functions
 *
 * Functions for adding/removing organization staff members.
 */

import { supabase } from '@/supabaseClient';

/**
 * Add a staff member to an organization
 *
 * Operator access is now resolved LIVE from this organization_staff row — adding
 * it is the whole grant. We deliberately no longer touch members.role here: that
 * hand-synced second copy was the motivating bug (a grant written in two places,
 * kept in sync by hand, drifting on removal).
 *
 * @param organizationId - Organization's primary key ID
 * @param memberId - Member to add as staff
 * @param position - Position/role ('admin' or 'league_rep')
 * @param addedBy - Member ID of person adding this staff
 * @returns Newly created staff record
 * @throws Error if database operation fails
 */
export async function addOrganizationStaff(
  organizationId: string,
  memberId: string,
  position: 'admin' | 'league_rep',
  addedBy: string
) {
  const { data, error } = await supabase
    .from('organization_staff')
    .insert({
      organization_id: organizationId,
      member_id: memberId,
      position,
      added_by: addedBy,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add staff member: ${error.message}`);
  }

  return data;
}

/**
 * Remove a staff member from an organization
 *
 * Deleting the organization_staff row IS the removal — operator access is
 * resolved live from remaining grants, so there is no members.role to revert and
 * no "are they staff anywhere else?" scan to run. That scan + revert was the
 * compensating write the old two-copies design forced; removing the copy removes
 * the bug (Success Criteria: "no compensating write anywhere").
 *
 * @param staffId - organization_staff record ID
 * @throws Error if database operation fails
 */
export async function removeOrganizationStaff(staffId: string) {
  const { error: deleteError } = await supabase
    .from('organization_staff')
    .delete()
    .eq('id', staffId);

  if (deleteError) {
    throw new Error(`Failed to remove staff member: ${deleteError.message}`);
  }
}
