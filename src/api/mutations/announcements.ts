/**
 * @fileoverview Announcement Mutation Functions
 *
 * Write operations for announcements (league, organization).
 * These functions are used by TanStack Query useMutation hooks.
 *
 * @see api/hooks/useAnnouncementMutations.ts - React hooks wrapper
 */

import { supabase } from '@/supabaseClient';
import { logger } from '@/utils/logger';

/**
 * Parameters for creating a league announcement
 */
export interface CreateLeagueAnnouncementParams {
  leagueId: string;
  senderId: string;
  message: string;
}

/**
 * Parameters for creating an organization announcement
 */
export interface CreateOrganizationAnnouncementParams {
  operatorId: string;
  senderId: string;
  message: string;
}

/**
 * Result returned from announcement creation
 */
export interface AnnouncementResult {
  conversationId: string;
}

/**
 * Create an announcement for a league
 *
 * Creates a league-scoped conversation if it doesn't exist and sends an announcement message.
 * All players in the league's active season will be added as participants.
 *
 * @param params - League ID, sender ID, and message text
 * @returns Promise resolving to conversation ID
 * @throws Error if no active season, no players, or database operation fails
 *
 * @example
 * const result = await createLeagueAnnouncement({
 *   leagueId: 'league-123',
 *   senderId: 'member-456',
 *   message: 'Next week is playoffs!',
 * });
 */
export async function createLeagueAnnouncement(
  params: CreateLeagueAnnouncementParams
): Promise<AnnouncementResult> {
  const { leagueId, senderId, message } = params;

  // Validate message
  if (!message || message.trim().length === 0) {
    throw new Error('Announcement message cannot be empty');
  }

  if (message.length > 2000) {
    throw new Error('Announcement message cannot exceed 2000 characters');
  }

  // Get the league's active season
  const { data: activeSeason, error: seasonError } = await supabase
    .from('seasons')
    .select('id, season_name')
    .eq('league_id', leagueId)
    .eq('status', 'active')
    .maybeSingle();

  if (seasonError) {
    logger.error('Error fetching active season', { error: seasonError.message });
    throw new Error(`Failed to fetch active season: ${seasonError.message}`);
  }

  if (!activeSeason) {
    throw new Error('League has no active season');
  }

  const seasonId = activeSeason.id;

  // Get all players in the league's active season (via teams)
  const { data: teamPlayers, error: playersError } = await supabase
    .from('team_players')
    .select('member_id, teams!inner(league_id, season_id)')
    .eq('teams.league_id', leagueId)
    .eq('teams.season_id', seasonId);

  if (playersError) {
    logger.error('Error fetching team players', { error: playersError.message });
    throw new Error(`Failed to fetch team players: ${playersError.message}`);
  }

  // Get unique member IDs
  const memberIds = [...new Set((teamPlayers || []).map((tp) => tp.member_id))];

  if (memberIds.length === 0) {
    throw new Error('No players found in league');
  }

  // Use database function to create/get announcement conversation with SECURITY DEFINER
  const { data: conversationId, error: convError } = await supabase.rpc(
    'create_announcement_conversation',
    {
      p_season_id: seasonId,
      p_title: `${activeSeason.season_name} Announcements`,
      p_member_ids: memberIds,
    }
  );

  if (convError || !conversationId) {
    logger.error('Error creating announcement conversation', { error: convError?.message || 'Unknown error' });
    throw new Error(`Failed to create announcement conversation: ${convError?.message || 'Unknown error'}`);
  }

  // Send the announcement message
  const { error: messageError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: message.trim(),
    });

  if (messageError) {
    logger.error('Error sending announcement message', { error: messageError.message });
    throw new Error(`Failed to send announcement message: ${messageError.message}`);
  }

  return { conversationId };
}

/**
 * Create an announcement for an organization
 *
 * Creates an organization-scoped conversation if it doesn't exist and sends an announcement message.
 * All members with active teams in any league operated by this league_operator will be added as participants.
 *
 * @param params - Operator ID, sender ID, and message text
 * @returns Promise resolving to conversation ID
 * @throws Error if operator not found, no players, or database operation fails
 *
 * @example
 * const result = await createOrganizationAnnouncement({
 *   operatorId: 'operator-123',
 *   senderId: 'member-456',
 *   message: 'All leagues: Registration opens next Monday!',
 * });
 */
export async function createOrganizationAnnouncement(
  params: CreateOrganizationAnnouncementParams
): Promise<AnnouncementResult> {
  const { operatorId, senderId, message } = params;

  // Validate message
  if (!message || message.trim().length === 0) {
    throw new Error('Announcement message cannot be empty');
  }

  if (message.length > 2000) {
    throw new Error('Announcement message cannot exceed 2000 characters');
  }

  // Get organization name
  const { data: organization, error: orgError } = await supabase
    .from('organizations')
    .select('id, organization_name')
    .eq('id', operatorId)
    .single();

  if (orgError || !organization) {
    logger.error('Error fetching organization', { error: orgError.message });
    throw new Error(`Organization not found: ${orgError?.message || 'Unknown error'}`);
  }

  // Get all members in any active season operated by this organization
  const { data: teamPlayers, error: playersError } = await supabase
    .from('team_players')
    .select('member_id, teams!inner(id, season_id, seasons!inner(id, status, league_id, leagues!inner(id, organization_id)))')
    .eq('teams.seasons.status', 'active')
    .eq('teams.seasons.leagues.organization_id', operatorId);

  if (playersError) {
    logger.error('Error fetching team players', { error: playersError.message });
    throw new Error(`Failed to fetch team players: ${playersError.message}`);
  }

  // Get unique member IDs
  const memberIds = [...new Set((teamPlayers || []).map((tp) => tp.member_id))];

  if (memberIds.length === 0) {
    throw new Error('No active players found in organization');
  }

  // Use database function to create/get announcement conversation with SECURITY DEFINER
  const { data: conversationId, error: convError } = await supabase.rpc(
    'create_organization_announcement_conversation',
    {
      p_organization_id: operatorId,
      p_title: `${organization.organization_name} Announcements`,
      p_member_ids: memberIds,
    }
  );

  if (convError || !conversationId) {
    logger.error('Error creating organization announcement conversation', { error: convError?.message || 'Unknown error' });
    throw new Error(`Failed to create announcement conversation: ${convError?.message || 'Unknown error'}`);
  }

  // Send the announcement message
  const { error: messageError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: message.trim(),
    });

  if (messageError) {
    logger.error('Error sending announcement message', { error: messageError.message });
    throw new Error(`Failed to send announcement message: ${messageError.message}`);
  }

  return { conversationId };
}
