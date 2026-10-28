/**
 * @fileoverview Organization Query Functions
 *
 * Pure data fetching functions for organization-related queries.
 * Organizations support multi-staff management via organization_staff table.
 *
 * Key Concepts:
 * - One member can be staff for multiple organizations
 * - One organization can have multiple staff members
 * - Positions: owner (full control), admin (operations), league_rep (future)
 *
 * These functions are used by TanStack Query hooks - NO inline queries in components!
 */

import { supabase } from '@/supabaseClient';

/**
 * Organization data structure
 */
export interface Organization {
  id: string;
  organization_name: string;
  organization_address: string;
  organization_city: string;
  organization_state: string;
  organization_zip_code: string;
  organization_email: string;
  organization_email_visibility: 'public' | 'my_organization' | 'my_teams';
  organization_phone: string;
  organization_phone_visibility: 'public' | 'my_organization' | 'my_teams';
  stripe_customer_id: string;
  payment_method_id: string;
  card_last4: string;
  card_brand: string;
  expiry_month: number;
  expiry_year: number;
  billing_zip: string;
  payment_verified: boolean;
  profanity_filter_enabled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Organization with staff position (for member's org list)
 */
export interface OrganizationWithPosition extends Organization {
  position: 'owner' | 'admin' | 'league_rep';
  staff_id: string;
  added_at: string;
}

/**
 * Fetch all organizations a member is staff for
 *
 * Returns organizations with the member's position in each.
 * Used for dashboard organization selector.
 *
 * @param memberId - Member's primary key ID
 * @returns Array of organizations with position info
 * @throws Error if database query fails
 *
 * @example
 * const orgs = await getOrganizationsByMember(memberId);
 * orgs.forEach(org => {
 *   console.log(`${org.organization_name} - ${org.position}`);
 * });
 */
export async function getOrganizationsByMember(
  memberId: string
): Promise<OrganizationWithPosition[]> {
  const { data, error } = await supabase
    .from('organization_staff')
    .select(`
      id,
      position,
      added_at,
      organizations (*)
    `)
    .eq('member_id', memberId)
    .order('added_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch organizations: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Flatten the nested structure. Cast: `position` is a text column narrowed
  // to OrganizationWithPosition's union, and added_at is always filled by its now() default.
  return data.map((staff) => ({
    ...staff.organizations,
    position: staff.position,
    staff_id: staff.id,
    added_at: staff.added_at,
  })) as OrganizationWithPosition[];
}

/**
 * Fetch organization by ID
 *
 * Gets complete organization details.
 *
 * @param organizationId - Organization's primary key ID
 * @returns Organization record
 * @throws Error if organization not found or database error
 *
 * @example
 * const org = await getOrganizationById('org-uuid');
 * console.log(org.organization_name);
 */
export async function getOrganizationById(
  organizationId: string
): Promise<Organization> {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', organizationId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch organization: ${error.message}`);
  }

  // Visibility columns are plain text in the DB; CHECK constraints keep them
  // to the union the app type declares.
  return data as Organization;
}

/**
 * Get member's position in an organization
 *
 * Returns the member's position (owner/admin/league_rep) for a specific organization.
 * Returns null if member is not staff for this organization.
 *
 * @param organizationId - Organization's primary key ID
 * @param memberId - Member's primary key ID
 * @returns Position string or null
 * @throws Error if database query fails
 *
 * @example
 * const position = await getMemberPosition(orgId, memberId);
 * if (position === 'owner') {
 *   // Show payment settings
 * }
 */
export async function getMemberPosition(
  organizationId: string,
  memberId: string
): Promise<'owner' | 'admin' | 'league_rep' | null> {
  const { data, error } = await supabase
    .from('organization_staff')
    .select('position')
    .eq('organization_id', organizationId)
    .eq('member_id', memberId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch member position: ${error.message}`);
  }

  // Plain text in the DB; a CHECK constraint keeps it to these three values.
  return (data?.position || null) as 'owner' | 'admin' | 'league_rep' | null;
}
