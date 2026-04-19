/**
 * @fileoverview Organization Mutation Functions
 *
 * Functions for creating and updating organization settings and preferences.
 */

import { supabase } from '@/supabaseClient';
import type { Database } from '@/types/database.types';

type OrganizationInsert = Database['public']['Tables']['organizations']['Insert'];

/**
 * Update organization's profanity filter setting
 *
 * Toggles profanity filtering for team names and content within the organization.
 *
 * @param organizationId - Organization's primary key ID
 * @param enabled - Whether profanity filter should be enabled
 * @returns Updated organization record
 * @throws Error if database operation fails
 *
 * @example
 * const org = await updateOrganizationProfanityFilter('org-id', true);
 */
export async function updateOrganizationProfanityFilter(
  organizationId: string,
  enabled: boolean
) {
  const { data, error } = await supabase
    .from('organizations')
    .update({ profanity_filter_enabled: enabled })
    .eq('id', organizationId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update profanity filter: ${error.message}`);
  }

  return data;
}

/**
 * Parameters for creating an organization
 *
 * All payment fields are required by the database schema.
 * Use generateMockPaymentData() for testing/development.
 */
export interface CreateOrganizationParams {
  organization_name: string;
  created_by: string;
  organization_address: string;
  organization_city: string;
  organization_state: string;
  organization_zip_code: string;
  organization_email: string;
  organization_phone: string;
  stripe_customer_id: string;
  payment_method_id: string;
  card_last4: string;
  card_brand: string;
  expiry_month: number;
  expiry_year: number;
  billing_zip: string;
  payment_verified: boolean;
}

/**
 * Create a new organization
 *
 * Creates an organization record. A database trigger automatically creates
 * the organization_staff record for the creator as owner.
 *
 * @param params - Organization creation parameters
 * @returns Created organization record
 * @throws Error if database operation fails
 *
 * @example
 * const org = await createOrganization({
 *   organization_name: 'My Pool League',
 *   created_by: 'member-id',
 *   organization_address: '123 Main St',
 *   organization_city: 'Austin',
 *   organization_state: 'TX',
 *   organization_zip_code: '78701',
 *   organization_email: 'contact@league.com',
 *   organization_phone: '555-0100'
 * });
 */
export async function createOrganization(params: CreateOrganizationParams) {
  const insertData: OrganizationInsert = {
    organization_name: params.organization_name,
    created_by: params.created_by,
    organization_address: params.organization_address,
    organization_city: params.organization_city,
    organization_state: params.organization_state,
    organization_zip_code: params.organization_zip_code,
    organization_email: params.organization_email,
    organization_phone: params.organization_phone,
    stripe_customer_id: params.stripe_customer_id,
    payment_method_id: params.payment_method_id,
    card_last4: params.card_last4,
    card_brand: params.card_brand,
    expiry_month: params.expiry_month,
    expiry_year: params.expiry_year,
    billing_zip: params.billing_zip,
    payment_verified: params.payment_verified,
  };

  const { data, error } = await supabase
    .from('organizations')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create organization: ${error.message}`);
  }

  return data;
}
