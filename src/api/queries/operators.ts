/**
 * @fileoverview Operator Query Functions
 *
 * Pure data fetching functions for operator-related queries.
 * These functions return plain data and throw errors (no loading states).
 * Used by TanStack Query hooks for caching and state management.
 *
 * NOTE: These functions now query the organizations and organization_staff tables
 * instead of the deprecated league_operators table.
 */

import { supabase } from '@/supabaseClient';
import type { Organization } from './organizations';

/**
 * Fetch operator profile by member ID
 *
 * Gets the organization record for a given member (via organization_staff).
 * Returns the first organization if member is staff for multiple organizations.
 * Returns null if member is not staff for any organization.
 *
 * @param memberId - Member's primary key ID
 * @returns Organization record or null if not an operator
 * @throws Error if database query fails
 *
 * @example
 * const org = await getOperatorProfileByMemberId('member-uuid');
 * if (org) {
 *   console.log(`Organization: ${org.organization_name}`);
 * }
 */
export async function getOperatorProfileByMemberId(
  memberId: string
): Promise<Organization | null> {
  const { data, error} = await supabase
    .from('organization_staff')
    .select('organizations (*)')
    .eq('member_id', memberId)
    .order('added_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch operator profile: ${error.message}`);
  }

  return data ? (data.organizations as unknown as Organization) : null;
}

/**
 * Fetch all league operators (organizations with owner info)
 *
 * Gets all organization records with their owner member information.
 * Used by developers for impersonation/testing purposes.
 *
 * @returns List of all organizations with owner details
 * @throws Error if database query fails
 *
 * @example
 * const operators = await getAllLeagueOperators();
 * console.log(`Found ${operators.length} organizations`);
 */
export async function getAllLeagueOperators(): Promise<Array<{
  id: string;
  organization_name: string;
  member_id: string;
  first_name: string;
  last_name: string;
}>> {
  // organization_staff links to members twice (member_id = the staff member,
  // added_by = who added them), so the members embed must name its foreign
  // key — without the hint PostgREST refuses the query as ambiguous (PGRST201).
  const { data, error } = await supabase
    .from('organization_staff')
    .select(`
      member_id,
      organizations!inner (
        id,
        organization_name
      ),
      members!organization_staff_member_id_fkey!inner (
        first_name,
        last_name
      )
    `)
    .eq('position', 'owner')
    .order('organizations(organization_name)');

  if (error) {
    throw new Error(`Failed to fetch league operators: ${error.message}`);
  }

  // Flatten the nested data
  return (data || []).map((staff) => ({
    id: staff.organizations.id,
    organization_name: staff.organizations.organization_name,
    member_id: staff.member_id,
    first_name: staff.members.first_name,
    last_name: staff.members.last_name,
  }));
}
