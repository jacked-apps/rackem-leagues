/**
 * @fileoverview Auto-creation mutations for league-managed conversations.
 *
 * These helpers create conversations that the messaging overhaul (Phase 1)
 * spawns on season activation and lifecycle events: team chats, captain
 * chats, and announcement channels. All set `auto_managed = true` and use
 * a `(scope_type, scope_id)` shape that supports idempotent re-creation.
 *
 * The matching SECURITY DEFINER SQL helper (`auto_create_season_conversations`)
 * lives in Unit 4's migration and does the same work for the DB-trigger path.
 * These TS helpers are the JS-side entry point — used by the captain
 * "Create team chat" manual-fallback button (R11) and any future operator
 * admin tool that needs to regenerate chats.
 *
 * @see api/mutations/messages.ts - postSystemMessage helper used by these
 * @see docs/plans/2026-05-09-001-feat-messaging-overhaul-phase-1-plan.md (Unit 3)
 */

import { supabase } from '@/supabaseClient';
import { postSystemMessage } from './messages';

/**
 * Parameters for createTeamChat
 */
export interface CreateTeamChatParams {
  seasonId: string;
  teamId: string;
}

/**
 * Result of createTeamChat — `created` lets callers distinguish "newly made"
 * from "already existed" (idempotent re-call).
 */
export interface CreateTeamChatResult {
  conversationId: string;
  created: boolean;
}

/**
 * Create the auto-managed team chat for a given team, idempotently.
 *
 * If a `(scope_type='team', scope_id=teamId, auto_managed=true)` conversation
 * already exists, returns it without creating a duplicate. Otherwise creates
 * the conversation, populates participants from the team's roster (captain
 * gets `cannot_leave = true`), and posts an opening system message.
 *
 * @param params - Season and team identifiers
 * @returns The conversation id plus a `created` flag indicating if this call
 *   actually created the chat (true) or returned an existing one (false)
 * @throws Error if the team doesn't exist, doesn't belong to the named season,
 *   or any of the underlying inserts fail
 *
 * @example
 * // From the captain "Create team chat" button:
 * const { conversationId, created } = await createTeamChat({
 *   seasonId: activeSeason.id,
 *   teamId: myTeam.id,
 * });
 */
export async function createTeamChat(
  params: CreateTeamChatParams
): Promise<CreateTeamChatResult> {
  const { seasonId, teamId } = params;

  // 1. Idempotency check — return existing chat without re-creating
  const { data: existing, error: lookupError } = await supabase
    .from('conversations')
    .select('id')
    .eq('scope_type', 'team')
    .eq('scope_id', teamId)
    .eq('auto_managed', true)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Failed to look up existing team chat: ${lookupError.message}`);
  }
  if (existing) {
    return { conversationId: existing.id, created: false };
  }

  // 2. Load the team — we need team_name (for the chat title) and captain_id
  //    (for the cannot_leave flag). Also defensively verify season membership.
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('id, team_name, captain_id, season_id')
    .eq('id', teamId)
    .single();

  if (teamError || !team) {
    throw new Error(
      `Team not found for createTeamChat (teamId=${teamId}): ${teamError?.message ?? 'no row'}`
    );
  }
  if (team.season_id !== seasonId) {
    throw new Error(
      `Team ${teamId} belongs to season ${team.season_id}, not ${seasonId} — refusing to create chat under wrong season`
    );
  }

  // 3. Load the roster
  const { data: roster, error: rosterError } = await supabase
    .from('team_players')
    .select('member_id')
    .eq('team_id', teamId);

  if (rosterError) {
    throw new Error(`Failed to load team roster: ${rosterError.message}`);
  }

  // 4. Insert the conversation row
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .insert({
      title: `${team.team_name} — Team Chat`,
      auto_managed: true,
      conversation_type: 'team_chat',
      scope_type: 'team',
      scope_id: teamId,
    })
    .select('id')
    .single();

  if (convError || !conversation) {
    throw new Error(
      `Failed to insert team chat conversation: ${convError?.message ?? 'no row returned'}`
    );
  }

  // 5. Insert participants — captain gets cannot_leave = true (D6)
  const participantRows = (roster ?? []).map((p) => ({
    conversation_id: conversation.id,
    user_id: p.member_id,
    cannot_leave: p.member_id === team.captain_id,
  }));

  if (participantRows.length > 0) {
    const { error: partError } = await supabase
      .from('conversation_participants')
      .insert(participantRows);

    if (partError) {
      throw new Error(`Failed to add participants to team chat: ${partError.message}`);
    }
  }

  // 6. Opening system message — narrates the chat into existence
  await postSystemMessage({
    conversationId: conversation.id,
    content: 'Team chat created.',
  });

  return { conversationId: conversation.id, created: true };
}
