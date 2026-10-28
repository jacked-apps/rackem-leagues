/**
 * @fileoverview League Operator Type Definitions (Legacy)
 * TypeScript interfaces for league operator profiles and related data
 *
 * NOTE: The league_operators table has been replaced by:
 * - organizations table (org details)
 * - organization_staff table (multi-staff support)
 *
 * These types are kept for backward compatibility during migration.
 * New code should use Organization type from @/api/queries/organizations
 *
 * Updated: 2025-11-29 - Marked as legacy, use Organization types instead
 */

/**
 * Contact visibility levels for operator contact information
 * Determines who can see email/phone in the application
 */
export type ContactVisibility =
  | 'in_app_only'         // Only visible when logged into app (default)
  | 'my_organization'     // Visible to others in same organization
  | 'my_team_captains'    // Visible to team captains in operator's leagues
  | 'my_teams'            // Visible to all players in operator's leagues
  | 'anyone';             // Publicly visible (league directory, search, etc.)

/**
 * League Operator Profile (Legacy Type)
 *
 * @deprecated Use Organization type from @/api/queries/organizations instead
 * This type is kept for backward compatibility during migration.
 *
 * Maps to organizations table in database (previously league_operators)
 * Stores operator business information and contact details
 */
export interface LeagueOperator {
  // Identity
  id: string;
  member_id: string;  // References members.id

  // Organization Information
  organization_name: string;

  // Address (Administrative Only - Copied from member profile at creation)
  // NOT shown to players - only for admins, BCA, legal/tax
  organization_address: string;
  organization_city: string;
  organization_state: string;
  organization_zip_code: string;

  // Contact Disclaimer
  contact_disclaimer_acknowledged: boolean;

  // Email (League Contact - Separate from member profile)
  // Pre-filled from member profile, but stored independently
  league_email: string;
  email_visibility: ContactVisibility;

  // Phone (League Contact - Separate from member profile)
  // Pre-filled from member profile, but stored independently
  league_phone: string;
  phone_visibility: ContactVisibility;

  // Payment Information (Required for operators)
  stripe_customer_id: string;   // Stripe customer ID
  payment_method_id: string;    // Stripe payment method ID
  card_last4: string;           // Last 4 digits for display
  card_brand: string;           // visa, mastercard, amex, discover, etc.
  expiry_month: number;         // 1-12
  expiry_year: number;          // 2025+
  billing_zip: string;
  payment_verified: boolean;

  // Settings
  profanity_filter_enabled?: boolean;  // Optional: Enable profanity filter for team names/content

  // Timestamps
  created_at: string;  // ISO timestamp
  updated_at: string;  // ISO timestamp
}

/**
 * Operator with Member Data
 * Combined view with member information for display
 */
export interface OperatorWithMember extends LeagueOperator {
  member: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    zip_code: string;
  };
}

/**
 * Operator Contact Info (Resolved for Display)
 * Helper type with formatted contact information
 */
export interface ResolvedOperatorContact {
  // Organization
  organization_name: string;

  // Address (admin only - not shown to players)
  address: string;
  city: string;
  state: string;
  zip_code: string;

  // Contact (with visibility controls)
  email: string;
  email_visibility: ContactVisibility;
  phone: string;
  phone_visibility: ContactVisibility;

  // Display helpers
  formatted_address: string;  // "123 Main St, City, ST 12345"
  formatted_phone: string;    // "(555) 123-4567"
}

/**
 * Database Insert Data for League Operator (Legacy Type)
 *
 * @deprecated Use Organization type from @/api/queries/organizations instead
 * Prepared data ready for INSERT into organizations table (previously league_operators)
 */
export interface LeagueOperatorInsertData {
  member_id: string;
  organization_name: string;

  // Address (copied from member profile)
  organization_address: string;
  organization_city: string;
  organization_state: string;
  organization_zip_code: string;

  // Contact disclaimer
  contact_disclaimer_acknowledged: boolean;

  // Email (pre-filled from profile, stored separately)
  league_email: string;
  email_visibility: ContactVisibility;

  // Phone (pre-filled from profile, stored separately)
  league_phone: string;
  phone_visibility: ContactVisibility;

  // Payment (required)
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
 * Operator Blackout Preference
 * Maps to operator_blackout_preferences table in database
 * Stores operator preferences for automatic blackouts and ignored conflicts
 */
export interface OperatorBlackoutPreference {
  // Identity
  id: string;
  organization_id: string;  // References organizations.id

  // Preference Type
  preference_type: 'holiday' | 'championship' | 'custom';
  preference_action: 'blackout' | 'ignore';

  // For type = 'holiday'
  holiday_name: string | null;

  // For type = 'championship'
  championship_id: string | null;  // References championship_date_options.id

  // For type = 'custom'
  custom_name: string | null;
  custom_start_date: string | null;  // ISO date
  custom_end_date: string | null;    // ISO date

  // Auto-apply flag
  auto_apply: boolean;

  // Timestamps
  created_at: string | null;  // ISO timestamp
  updated_at: string | null;  // ISO timestamp
}

/**
 * Database Insert Data for Operator Blackout Preference
 * Prepared data ready for INSERT into operator_blackout_preferences table
 */
export interface OperatorBlackoutPreferenceInsertData {
  operator_id: string;
  preference_type: 'holiday' | 'championship' | 'custom';
  preference_action: 'blackout' | 'ignore';
  holiday_name?: string;
  championship_id?: string;
  custom_name?: string;
  custom_start_date?: string;
  custom_end_date?: string;
  auto_apply: boolean;
}

/**
 * Mock Payment Data Generator
 * Creates realistic-looking Stripe IDs for testing
 */
export function generateMockPaymentData(): {
  stripe_customer_id: string;
  payment_method_id: string;
  card_last4: string;
  card_brand: string;
  expiry_month: number;
  expiry_year: number;
  billing_zip: string;
  payment_verified: boolean;
} {
  // Generate random 16-character hex string for IDs
  const randomHex = () => Math.random().toString(36).substring(2, 18).padEnd(16, '0');

  return {
    stripe_customer_id: `cus_mock_${randomHex()}`,
    payment_method_id: `pm_mock_${randomHex()}`,
    card_last4: '4242',  // Stripe test card
    card_brand: 'visa',
    expiry_month: 12,
    expiry_year: 2027,
    billing_zip: '12345',
    payment_verified: true
  };
}
