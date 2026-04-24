/**
 * @fileoverview Member Query Functions
 *
 * Pure data fetching functions for member-related queries.
 * These functions return plain data and throw errors (no loading states).
 * Used by TanStack Query hooks for caching and state management.
 *
 * @see api/hooks/useCurrentMember.ts - React hook wrapper
 * @see api/hooks/useUserProfile.ts - React hook wrapper
 * @see api/hooks/useOperatorId.ts - React hook wrapper
 */

import { supabase } from '@/supabaseClient';
import type { Member, PartialMember } from '@/types/member';

/**
 * Fetch current member by auth user ID
 *
 * Connects authenticated user to their member record.
 * Used across the app to get member ID and complete profile info.
 *
 * @param userId - Supabase auth user ID
 * @returns Complete member record with all fields including role
 * @throws Error if member not found or database error
 *
 * @example
 * const member = await getCurrentMember(user.id);
 * console.log(member.id, member.first_name, member.role);
 */
export async function getCurrentMember(userId: string): Promise<Member> {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetch complete member profile by auth user ID
 *
 * Gets full member record including all profile fields, role, and metadata.
 * Used for profile pages and role-based access control.
 *
 * @param userId - Supabase auth user ID
 * @returns Complete member record
 * @throws Error with code 'PGRST116' if member not found (user hasn't completed application)
 * @throws Error for other database errors
 *
 * @example
 * const profile = await getMemberProfile(user.id);
 * if (profile.role === 'league_operator') { ... }
 */
export async function getMemberProfile(userId: string): Promise<Member> {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetch member by member ID
 *
 * Gets full member record by the member's primary key ID.
 * Used when you already have a member ID (e.g., from a team roster).
 *
 * @param memberId - Member's primary key ID
 * @returns Complete member record
 * @throws Error if member not found or database error
 *
 * @example
 * const member = await getMemberById('member-uuid');
 */
export async function getMemberById(memberId: string): Promise<Member> {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('id', memberId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetch organization ID for a member
 *
 * Looks up the organization via organization_staff table for a member.
 * Returns the first organization if member is staff for multiple.
 * Used across operator dashboard features.
 *
 * @param memberId - Member's primary key ID
 * @returns Object with organization ID
 * @throws Error if member is not staff for any organization or database error
 *
 * @example
 * const { id } = await getOperatorId(memberId);
 * // Use organization ID for operator-specific queries
 */
export async function getOperatorId(memberId: string): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('organization_staff')
    .select('organization_id')
    .eq('member_id', memberId)
    .order('added_at', { ascending: true })
    .limit(1)
    .single();

  if (error) throw error;
  return { id: data.organization_id };
}

/**
 * Fetch organization ID by auth user ID (convenience function)
 *
 * Combines member lookup + organization lookup in one function.
 * Useful when you only have the auth user ID.
 *
 * @param userId - Supabase auth user ID
 * @returns Object with organization ID
 * @throws Error if user is not a member, not staff for any organization, or database error
 *
 * @example
 * const { id } = await getOperatorIdByUserId(user.id);
 */
export async function getOperatorIdByUserId(userId: string): Promise<{ id: string }> {
  // First get member ID
  const member = await getCurrentMember(userId);

  // Then get organization ID
  return getOperatorId(member.id);
}

/**
 * Check if member is a league operator
 *
 * Quick check to see if a member has an organization staff record.
 *
 * @param memberId - Member's primary key ID
 * @returns True if member is an operator (org staff), false otherwise
 *
 * @example
 * if (await isOperator(memberId)) {
 *   // Show operator features
 * }
 */
export async function isOperator(memberId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('organization_staff')
    .select('id')
    .eq('member_id', memberId)
    .limit(1)
    .maybeSingle();

  // If error code is PGRST116 (no rows), member is not an operator
  if (error?.code === 'PGRST116') return false;

  // Other errors should be thrown
  if (error) throw error;

  // Has organization staff record
  return !!data;
}

/**
 * Checks if a member is a captain of any team
 *
 * Used to determine if user should see captain-specific features like team announcements.
 *
 * @param memberId - Member's primary key ID
 * @returns True if member is captain of at least one team, false otherwise
 *
 * @example
 * const isCaptain = await getIsCaptain(memberId);
 * if (isCaptain) {
 *   // Show announcement creation button
 * }
 */
export async function getIsCaptain(memberId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('team_players')
    .select('is_captain')
    .eq('member_id', memberId)
    .eq('is_captain', true)
    .limit(1);

  if (error) throw error;

  return !!data && data.length > 0;
}

/**
 * Fetch all members with user accounts
 *
 * Returns all members who have linked user accounts (can log in).
 * Used for messaging - showing list of people user can message.
 *
 * @param excludeMemberId - Optional member ID to exclude from results (e.g., current user)
 * @returns Array of member objects with basic info
 * @throws Error for database errors
 *
 * @example
 * const members = await getAllMembers(currentUserId);
 * // Returns all members except current user
 */
export async function getAllMembers(excludeMemberId?: string): Promise<PartialMember[]> {
  let query = supabase
    .from('members')
    .select('id, first_name, last_name, system_player_number, bca_member_number, user_id')
    // user_id included to detect placeholder players (user_id = null).
    // Archived placeholders (archived_at NOT NULL) are excluded — they
    // shouldn't clutter active player pickers. The LO's dedicated archived
    // view queries them separately.
    .is('archived_at', null)
    .order('last_name', { ascending: true });

  if (excludeMemberId) {
    query = query.neq('id', excludeMemberId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return data as PartialMember[] || [];
}

/**
 * Fetch multiple members by IDs
 *
 * Gets member records for a list of member IDs.
 * Returns basic info needed for display (name, nickname).
 * Used by scoring pages to get player names for lineup.
 *
 * @param memberIds - Array of member primary key IDs
 * @returns Array of member objects with id, first_name, last_name, nickname
 * @throws Error for database errors
 *
 * @example
 * const players = await getMembersByIds(['id1', 'id2', 'id3']);
 * const playerMap = new Map(players.map(p => [p.id, p]));
 */
export async function getMembersByIds(memberIds: string[]) {
  if (memberIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('members')
    .select('*')
    .in('id', memberIds);

  if (error) throw error;

  return data || [];
}

/**
 * Profanity filter settings for a member
 */
export interface MemberProfanitySettings {
  profanity_filter_enabled: boolean;
}

/**
 * Fetch member's profanity filter settings
 *
 * Gets filter preference for the user.
 * All users can control their own filter preference.
 *
 * @param userId - Supabase auth user ID
 * @returns Object with profanity_filter_enabled
 * @throws Error if member not found or database error
 *
 * @example
 * const settings = await getMemberProfanitySettings(user.id);
 * const shouldFilter = settings.profanity_filter_enabled;
 */
export async function getMemberProfanitySettings(
  userId: string
): Promise<MemberProfanitySettings> {
  const { data, error } = await supabase
    .from('members')
    .select('profanity_filter_enabled')
    .eq('user_id', userId)
    .single();

  if (error) throw error;

  return data;
}
