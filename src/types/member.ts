/**
 * @fileoverview Member and User-related type definitions
 * Centralized types for member profiles, user roles, and authentication
 */

/**
 * User roles available in the system
 */
export type UserRole = 'player' | 'league_operator' | 'developer';

/**
 * Member interface representing a user's profile data stored in Supabase
 * This maps to the 'members' table in the database
 *
 * Note: Several fields are nullable to support "placeholder" players -
 * real people who haven't registered yet but can be on teams and have games scored.
 * Placeholder members have user_id = NULL.
 */
export interface Member {
  id: string;
  user_id: string | null; // References Supabase auth.users.id - NULL for placeholder players
  first_name: string;
  last_name: string;
  nickname?: string | null;
  phone: string | null; // NULL for placeholder players
  email: string | null; // NULL for placeholder players
  address: string | null; // NULL for placeholder players
  city: string;
  state: string;
  zip_code: string | null; // NULL for placeholder players
  date_of_birth: string | null; // ISO date string - NULL for placeholder players
  role: UserRole;
  system_player_number: number; // System-generated player ID (always assigned)
  bca_member_number: string | null; // Official BCA member number (null until assigned)
  membership_paid_date: string | null; // ISO date string when membership was last paid
  starting_handicap_3v3: number | null; // Starting handicap for 3v3 format. NULL = not yet authorized.
  starting_handicap_5v5: number | null; // Starting handicap for 5v5 format. NULL = not yet authorized.
  profanity_filter_enabled?: boolean; // User's profanity filter preference
  // NULL until the user explicitly answers the Unit 9 onboarding modal
  // (either Yes or No). NULL value triggers the modal at app first-load.
  // "Decide later" leaves this NULL; only an explicit Yes/No writes a timestamp.
  profanity_onboarding_completed_at?: string | null;
  // Global push-notification switch (message push notifications, Unit 1).
  // NULL = never prompted; true = on; false = globally off.
  push_enabled?: boolean | null;
  fargo_rating: number | null; // FargoRate rating (100-850). NULL = not set.
  organization_id: string | null; // Placeholder-only: org the placeholder belongs to. NULL for registered members (they span orgs).
  archived_at: string | null; // Placeholder-only: when the LO archived this row. NULL means active.
  created_by_member_id: string | null; // Placeholder-only: the member (LO/captain) who created this placeholder.
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

/**
 * Helper function to get display player number
 * Shows BCA number if available, otherwise system player number
 * Works with both full Member and PartialMember types
 */
export function getPlayerDisplayNumber(member: Member | PartialMember): string {
  if (member.bca_member_number) {
    return `#BCA-${member.bca_member_number}`;
  }
  return `#P-${String(member.system_player_number).padStart(5, '0')}`;
}

/**
 * Helper function to get display name with player number
 * Example: "John Smith #BCA-123456" or "John Smith #P-00042"
 * Works with both full Member and PartialMember types
 */
export function getPlayerDisplayName(member: Member | PartialMember): string {
  const fullName = `${member.first_name} ${member.last_name}`;
  const playerNumber = getPlayerDisplayNumber(member);
  return `${fullName} ${playerNumber}`;
}

/**
 * Partial member object from database queries (captain/roster lookups)
 * Only includes fields needed for display purposes
 * Includes user_id to detect placeholder players (user_id = null)
 */
export type PartialMember = Pick<Member, 'id' | 'first_name' | 'last_name' | 'system_player_number' | 'bca_member_number'> & {
  /** Optional user_id - NULL indicates a placeholder player */
  user_id?: string | null;
  /** Placeholder's org attribution (NULL for registered users) */
  organization_id?: string | null;
};

/**
 * Member subset used for messaging features
 * Includes minimal fields needed for member selection and display in messages
 */
export type MemberForMessaging = Pick<Member, 'id' | 'first_name' | 'last_name' | 'system_player_number'>;

/**
 * Format player number for partial member objects from queries
 * Shows BCA number if available, otherwise system player number
 * Example: "#BCA-123456" or "#P-00042"
 */
export function formatPartialMemberNumber(member: PartialMember): string {
  // Reuse the main getPlayerDisplayNumber logic
  return getPlayerDisplayNumber(member as Member);
}

/**
 * Check if a member is a placeholder (not registered)
 * Placeholder members have user_id = null
 *
 * @param member - Member or PartialMember object
 * @returns true if the member is a placeholder (user_id is null)
 */
export function isPlaceholderMember(member: PartialMember | Member | null | undefined): boolean {
  if (!member) return false;
  // Check if user_id exists and is null (placeholder)
  // If user_id is undefined, we can't determine - treat as not placeholder
  return 'user_id' in member && member.user_id === null;
}

/**
 * Minimal player interface for nickname display
 * Only includes fields needed for showing player name (nickname or full name)
 */
export interface PlayerForDisplay {
  first_name: string;
  last_name: string;
  nickname: string | null;
}

/**
 * Get player nickname or full name (no player number)
 *
 * Returns the player's nickname if available, otherwise returns their full name.
 * Used for casual display in game scoring, chat, etc. where player numbers aren't needed.
 *
 * @param player - Player object with first_name, last_name, and optional nickname
 * @returns Nickname or "FirstName LastName"
 *
 * @example
 * getPlayerNickname({ first_name: 'John', last_name: 'Doe', nickname: 'JD' }); // Returns: "JD"
 * getPlayerNickname({ first_name: 'Jane', last_name: 'Smith', nickname: null }); // Returns: "Jane Smith"
 */
export function getPlayerNickname(player: PlayerForDisplay | null | undefined): string {
  if (!player) return 'Unknown';
  return player.nickname || `${player.first_name} ${player.last_name}`;
}

/**
 * Get player nickname by ID from a player Map
 *
 * Helper function for looking up a player by ID and returning their nickname.
 * Commonly used in scoring systems where players are stored in a Map.
 *
 * @param playerId - Player's ID to look up
 * @param playersMap - Map of player IDs to player objects
 * @returns Nickname or "FirstName LastName" or "Unknown" if not found
 *
 * @example
 * const players = new Map([['id1', { first_name: 'John', last_name: 'Doe', nickname: 'JD' }]]);
 * getPlayerNicknameById('id1', players); // Returns: "JD"
 */
export function getPlayerNicknameById(
  playerId: string | null | undefined,
  playersMap: Map<string, PlayerForDisplay>
): string {
  if (!playerId) return 'Unknown';
  const player = playersMap.get(playerId);
  return getPlayerNickname(player);
}

/**
 * Get a player's FULL name (first + last) by ID from a player Map.
 *
 * Unlike getPlayerNicknameById, this ignores the nickname — used where the
 * full roster name matters for identification (e.g. the lineup-swap request /
 * approval modals, so both captains see exactly who is coming and going).
 */
export function getPlayerFullNameById(
  playerId: string | null | undefined,
  playersMap: Map<string, PlayerForDisplay>
): string {
  if (!playerId) return 'Unknown';
  const player = playersMap.get(playerId);
  if (!player) return 'Unknown';
  return `${player.first_name} ${player.last_name}`;
}
