/**
 * @fileoverview Member Mutation Functions
 *
 * Write operations for member records (create, update, delete).
 * These functions are used by TanStack Query useMutation hooks.
 *
 * @see api/hooks/useMemberMutations.ts - React hooks wrapper
 */

import { supabase } from '@/supabaseClient';
import { isEighteenOrOlder } from '@/utils/formatters';

/**
 * Parameters for creating a member
 */
export interface CreateMemberParams {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  date_of_birth: string;
  system_player_number: number;
  nickname?: string | null;
  bca_member_number?: string | null;
  membership_paid_date?: string | null;
}

/**
 * Parameters for creating a placeholder member
 * Placeholder members are real people who haven't registered yet.
 * They can be on teams and have games scored, then later connect
 * when they register.
 */
export interface CreatePlaceholderMemberParams {
  first_name: string;
  last_name: string;
  nickname: string;
  /** Optional — defaults to '' if not supplied. LO can edit later. */
  city?: string;
  /** Optional — defaults to '' if not supplied. LO can edit later. */
  state?: string;
  /** Starting handicap for 8-ball/3v3 formats (0-100). Default: 0 */
  starting_handicap_3v3?: number;
  /** Starting handicap for 5v5 formats (0-100). Default: 40 */
  starting_handicap_5v5?: number;
  /**
   * Optional email for the placeholder player.
   * If provided, the trigger auto-creates an invite_token. Callers who
   * have team context (captain/LO inviting to a specific team) should
   * also fire send-invite for email delivery; flows without team context
   * (wizard captain pick) leave delivery to a later explicit action.
   */
  email?: string;
}

/**
 * Parameters for deleting a member
 */
export interface DeleteMemberParams {
  memberId: string;
}

/**
 * Parameters for updating member role
 */
export interface UpdateMemberRoleParams {
  memberId: string;
  role: 'player' | 'league_operator' | 'admin';
}

/**
 * Parameters for updating member profile
 */
export interface UpdateMemberProfileParams {
  memberId: string;
  updates: Partial<{
    first_name: string;
    last_name: string;
    nickname: string | null;
    date_of_birth: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    zip_code: string;
  }>;
}

/**
 * Parameters for updating member nickname
 */
export interface UpdateMemberNicknameParams {
  memberId: string;
  nickname: string;
}

/**
 * Update member's profile information
 *
 * General-purpose function for updating any member profile fields.
 * Used by the profile page for editing personal info, contact info, and address.
 *
 * @param params - Update parameters (memberId, updates object)
 * @throws Error if database update fails
 *
 * @example
 * await updateMemberProfile({
 *   memberId: 'member-123',
 *   updates: {
 *     first_name: 'John',
 *     last_name: 'Doe',
 *     nickname: 'JD'
 *   }
 * });
 */
export async function updateMemberProfile(
  params: UpdateMemberProfileParams
): Promise<void> {
  const { memberId, updates } = params;

  const { error } = await supabase
    .from('members')
    .update(updates)
    .eq('id', memberId);

  if (error) {
    throw new Error(`Failed to update member profile: ${error.message}`);
  }
}

/**
 * Update member's nickname
 *
 * Used when auto-generating nicknames for players who don't have one.
 * Updates the members table with the new nickname.
 *
 * @param params - Update parameters (memberId, nickname)
 * @throws Error if database update fails
 *
 * @example
 * await updateMemberNickname({
 *   memberId: 'member-123',
 *   nickname: 'John D'
 * });
 */
export async function updateMemberNickname(
  params: UpdateMemberNicknameParams
): Promise<void> {
  const { memberId, nickname } = params;

  const { error } = await supabase
    .from('members')
    .update({ nickname })
    .eq('id', memberId);

  if (error) {
    throw new Error(`Failed to update nickname: ${error.message}`);
  }
}

/**
 * Parameters for updating profanity filter
 */
export interface UpdateProfanityFilterParams {
  userId: string;
  enabled: boolean;
}

/**
 * Update member's profanity filter preference
 *
 * Only allows updates for users 18+. Users under 18 have filter forced ON.
 * Validates age before allowing the update.
 *
 * @param params - Update parameters (userId, enabled)
 * @throws Error if user is under 18 or database update fails
 *
 * @example
 * await updateProfanityFilter({
 *   userId: 'user-123',
 *   enabled: false
 * });
 */
export async function updateProfanityFilter(
  params: UpdateProfanityFilterParams
): Promise<void> {
  const { userId, enabled } = params;

  // First check if user is 18+
  const { data: member, error: fetchError } = await supabase
    .from('members')
    .select('date_of_birth')
    .eq('user_id', userId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch member data: ${fetchError.message}`);
  }

  if (!member) {
    throw new Error('Member not found');
  }

  // Check age using helper function
  if (!isEighteenOrOlder(member.date_of_birth)) {
    throw new Error('Users under 18 cannot modify profanity filter settings');
  }

  // Update filter preference
  const { error: updateError } = await supabase
    .from('members')
    .update({ profanity_filter_enabled: enabled })
    .eq('user_id', userId);

  if (updateError) {
    throw new Error(`Failed to update profanity filter: ${updateError.message}`);
  }
}

/**
 * Parameters for marking the profanity-filter onboarding modal as completed.
 */
export interface MarkProfanityOnboardingCompleteParams {
  /** Supabase auth user id of the member completing the prompt. */
  userId: string;
  /** What the member chose: true = filter ON, false = show everything. */
  filterEnabled: boolean;
}

/**
 * Persist the member's answer to the Unit 9 profanity onboarding modal.
 *
 * Writes both columns in a single UPDATE:
 *   - profanity_filter_enabled  ← user's choice
 *   - profanity_onboarding_completed_at ← now() (so the modal never
 *     reappears for them on subsequent app loads)
 *
 * Skipped vs. "decide later": this mutation is only called when the
 * user makes an explicit choice (Yes or No). "Decide later" (Escape /
 * backdrop / X / tertiary button) does NOT call this mutation, which
 * keeps the column NULL and lets the modal reappear on next load.
 *
 * No age check: minor enforcement is a display-time concern handled by
 * `useProfanityFilter` via `isMinor(dob)`. Saving the member's stored
 * preference here is harmless for minors — the hook still forces the
 * filter ON for them at render time.
 *
 * @param params - Onboarding parameters (userId, filterEnabled).
 * @throws Error if the database update fails.
 */
export async function markProfanityOnboardingComplete(
  params: MarkProfanityOnboardingCompleteParams,
): Promise<void> {
  const { userId, filterEnabled } = params;

  const { error } = await supabase
    .from('members')
    .update({
      profanity_filter_enabled: filterEnabled,
      profanity_onboarding_completed_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to record profanity onboarding choice: ${error.message}`);
  }
}

/**
 * Create a new member
 *
 * Inserts a new member record.
 * Used for testing RLS INSERT policies.
 *
 * @param params - Member creation parameters
 * @returns Created member record
 * @throws Error if validation fails or database error occurs
 *
 * @example
 * const member = await createMember({
 *   first_name: 'John',
 *   last_name: 'Doe',
 *   phone: '555-0100',
 *   email: 'john@example.com',
 *   address: '123 Main St',
 *   city: 'Austin',
 *   state: 'TX',
 *   zip_code: '78701',
 *   date_of_birth: '1990-01-01',
 *   system_player_number: 12345
 * });
 */
export async function createMember(params: CreateMemberParams) {
  // Validation
  if (!params.first_name.trim()) {
    throw new Error('First name is required');
  }
  if (!params.last_name.trim()) {
    throw new Error('Last name is required');
  }
  if (!params.email.trim()) {
    throw new Error('Email is required');
  }
  if (!params.phone.trim()) {
    throw new Error('Phone is required');
  }

  const { data, error } = await supabase
    .from('members')
    .insert([{
      first_name: params.first_name.trim(),
      last_name: params.last_name.trim(),
      phone: params.phone.trim(),
      email: params.email.trim(),
      address: params.address.trim(),
      city: params.city.trim(),
      state: params.state.trim().toUpperCase(),
      zip_code: params.zip_code.trim(),
      date_of_birth: params.date_of_birth,
      system_player_number: params.system_player_number,
      nickname: params.nickname?.trim() || null,
      bca_member_number: params.bca_member_number?.trim() || null,
      membership_paid_date: params.membership_paid_date || null,
    }])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create member: ${error.message} (${error.code})`);
  }

  return data;
}

/**
 * Delete a member
 *
 * Deletes a member record by ID.
 * Used for cleaning up test data.
 *
 * @param params - Member deletion parameters
 * @throws Error if database error occurs
 *
 * @example
 * await deleteMember({ memberId: 'member-123' });
 */
export async function deleteMember(params: DeleteMemberParams): Promise<void> {
  const { error } = await supabase
    .from('members')
    .delete()
    .eq('id', params.memberId);

  if (error) {
    throw new Error(`Failed to delete member: ${error.message} (${error.code})`);
  }
}

/**
 * Update member's role
 *
 * Changes a member's role (e.g., from 'player' to 'league_operator').
 * Used during league operator application approval.
 *
 * @param params - Update parameters (memberId, role)
 * @throws Error if database update fails
 *
 * @example
 * await updateMemberRole({
 *   memberId: 'member-123',
 *   role: 'league_operator'
 * });
 */
export async function updateMemberRole(
  params: UpdateMemberRoleParams
): Promise<void> {
  const { memberId, role } = params;

  const { error } = await supabase
    .from('members')
    .update({ role })
    .eq('id', memberId);

  if (error) {
    throw new Error(`Failed to update member role: ${error.message}`);
  }
}

/**
 * Create a placeholder member
 *
 * Creates a member record for someone who hasn't registered yet.
 * Placeholder members have user_id = NULL and minimal info (name, city, state).
 * They can be added to teams and have games scored. When the real person
 * registers, they can be connected via invite link or operator merge.
 *
 * @param params - Placeholder member creation parameters
 * @returns Created member record with id and system_player_number
 * @throws Error if validation fails or database error occurs
 *
 * @example
 * const member = await createPlaceholderMember({
 *   first_name: 'John',
 *   last_name: 'Doe',
 *   nickname: 'John D',
 *   city: 'Austin',
 *   state: 'TX'
 * });
 */
export async function createPlaceholderMember(
  params: CreatePlaceholderMemberParams
): Promise<{ id: string; first_name: string; last_name: string; system_player_number: number }> {
  // Validation
  if (!params.first_name.trim()) {
    throw new Error('First name is required');
  }
  if (!params.last_name.trim()) {
    throw new Error('Last name is required');
  }
  if (!params.nickname.trim()) {
    throw new Error('Nickname is required');
  }
  // City + state are no longer required at creation — captains rarely know
  // them and the data isn't load-bearing for placeholder identity. LO can
  // edit later if the player carries a BCA# that needs them populated.

  // Identify the caller so we can attribute creation. Used by the
  // dashboard pending-invites modal to show "Created by X in Y
  // Organization" on floating placeholders that have no team context yet.
  const { data: { user } } = await supabase.auth.getUser();
  let createdByMemberId: string | null = null;
  if (user) {
    const { data: callerMember } = await supabase
      .from('members')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    createdByMemberId = callerMember?.id ?? null;
  }

  const { data, error } = await supabase
    .from('members')
    .insert([{
      first_name: params.first_name.trim(),
      last_name: params.last_name.trim(),
      nickname: params.nickname.trim(),
      city: params.city?.trim() || '',
      state: params.state?.trim().toUpperCase() || '',
      // Starting handicaps (defaults: 0 for 3v3, 40 for 5v5)
      starting_handicap_3v3: params.starting_handicap_3v3 ?? 0,
      starting_handicap_5v5: params.starting_handicap_5v5 ?? 40,
      // These fields are now nullable - set to null for placeholders (except email if provided)
      user_id: null,
      phone: null,
      // Email is optional - if provided, allows PP to be on multiple teams (verified identity)
      email: params.email?.trim() || null,
      address: null,
      zip_code: null,
      date_of_birth: null,
      created_by_member_id: createdByMemberId,
    }])
    .select('id, first_name, last_name, system_player_number')
    .single();

  if (error) {
    throw new Error(`Failed to create placeholder member: ${error.message} (${error.code})`);
  }

  return data;
}
