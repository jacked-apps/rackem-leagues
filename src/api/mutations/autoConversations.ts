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


// ============================================================================
// createCaptainChat
// ============================================================================

/**
 * Parameters for createCaptainChat
 */
export interface CreateCaptainChatParams {
  seasonId: string;
  leagueId: string;
}

/**
 * Result of createCaptainChat — same shape as createTeamChat.
 */
export interface CreateCaptainChatResult {
  conversationId: string;
  created: boolean;
}

/**
 * Create the auto-managed captain's chat for a given season, idempotently.
 *
 * One captain's chat per (league, season) pair — since each season belongs
 * to exactly one league, the chat is scoped by `(scope_type='season',
 * scope_id=seasonId)` and `conversation_type='captains_chat'`. Members are
 * the union of:
 *   - All current team captains for that season (one row per UNIQUE
 *     captain — captains running multiple teams in the same season only
 *     appear once). Captains have `cannot_leave = true` (D6).
 *   - All organization staff (owner / admin / league_rep) for the league's
 *     org. Per D6, staff CAN leave the captain chat, so `cannot_leave =
 *     false` for staff-only members.
 *   - A member who is BOTH a captain AND staff is deduplicated to one row
 *     with `cannot_leave = true` (the captain rule wins — D24 captain
 *     lifecycle says captains cannot leave the captain chat).
 *
 * Opens with a system message.
 *
 * @param params - Season and league identifiers
 * @returns The conversation id plus a `created` flag (idempotency signal)
 * @throws Error if the season doesn't exist, doesn't belong to the named
 *   league, or any underlying insert fails
 *
 * @example
 * const { conversationId } = await createCaptainChat({
 *   seasonId: activeSeason.id,
 *   leagueId: activeSeason.league_id,
 * });
 */
export async function createCaptainChat(
  params: CreateCaptainChatParams
): Promise<CreateCaptainChatResult> {
  const { seasonId, leagueId } = params;

  // 1. Idempotency check
  const { data: existing, error: lookupError } = await supabase
    .from('conversations')
    .select('id')
    .eq('scope_type', 'season')
    .eq('scope_id', seasonId)
    .eq('conversation_type', 'captains_chat')
    .eq('auto_managed', true)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Failed to look up existing captain chat: ${lookupError.message}`);
  }
  if (existing) {
    return { conversationId: existing.id, created: false };
  }

  // 2. Load season → verify league membership + get league_id
  const { data: season, error: seasonError } = await supabase
    .from('seasons')
    .select('id, league_id')
    .eq('id', seasonId)
    .single();

  if (seasonError || !season) {
    throw new Error(
      `Season not found for createCaptainChat (seasonId=${seasonId}): ${seasonError?.message ?? 'no row'}`
    );
  }
  if (season.league_id !== leagueId) {
    throw new Error(
      `Season ${seasonId} belongs to league ${season.league_id}, not ${leagueId}`
    );
  }

  // 3. Load league → get organization_id + a label for the title
  const { data: league, error: leagueError } = await supabase
    .from('leagues')
    .select('id, organization_id, division, day_of_week')
    .eq('id', leagueId)
    .single();

  if (leagueError || !league) {
    throw new Error(
      `League not found for createCaptainChat (leagueId=${leagueId}): ${leagueError?.message ?? 'no row'}`
    );
  }

  // 4. Captains for this season — DISTINCT to dedupe a captain running
  //    multiple teams (rare but possible).
  const { data: captainRows, error: captainsError } = await supabase
    .from('teams')
    .select('captain_id')
    .eq('season_id', seasonId)
    .not('captain_id', 'is', null);

  if (captainsError) {
    throw new Error(`Failed to load captains: ${captainsError.message}`);
  }
  const captainIds = new Set<string>(
    (captainRows ?? []).map((r) => r.captain_id as string).filter(Boolean)
  );

  // 5. Org staff for this league's organization
  const { data: staffRows, error: staffError } = await supabase
    .from('organization_staff')
    .select('member_id')
    .eq('organization_id', league.organization_id);

  if (staffError) {
    throw new Error(`Failed to load org staff: ${staffError.message}`);
  }
  const staffIds = new Set<string>((staffRows ?? []).map((r) => r.member_id as string));

  // 6. Insert the conversation
  const titleLabel = league.division
    ? `${league.division} Captains Chat`
    : `${league.day_of_week} Captains Chat`;

  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .insert({
      title: titleLabel,
      auto_managed: true,
      conversation_type: 'captains_chat',
      scope_type: 'season',
      scope_id: seasonId,
    })
    .select('id')
    .single();

  if (convError || !conversation) {
    throw new Error(
      `Failed to insert captain chat conversation: ${convError?.message ?? 'no row returned'}`
    );
  }

  // 7. Build participant rows — captain rule wins on the cannot_leave flag
  //    for dual members (captain + staff). Use a Map keyed by member_id so
  //    duplicates dedup automatically.
  const participantsByMember = new Map<string, { conversation_id: string; user_id: string; cannot_leave: boolean }>();
  for (const cap of captainIds) {
    participantsByMember.set(cap, {
      conversation_id: conversation.id,
      user_id: cap,
      cannot_leave: true,
    });
  }
  for (const staff of staffIds) {
    if (!participantsByMember.has(staff)) {
      // Staff-only: can leave
      participantsByMember.set(staff, {
        conversation_id: conversation.id,
        user_id: staff,
        cannot_leave: false,
      });
    }
    // else: already in the map as a captain; captain rule wins (cannot_leave=true)
  }

  if (participantsByMember.size > 0) {
    const { error: partError } = await supabase
      .from('conversation_participants')
      .insert(Array.from(participantsByMember.values()));

    if (partError) {
      throw new Error(`Failed to add participants to captain chat: ${partError.message}`);
    }
  }

  // 8. Opening system message
  await postSystemMessage({
    conversationId: conversation.id,
    content: 'Captains chat created.',
  });

  return { conversationId: conversation.id, created: true };
}


// ============================================================================
// createSeasonAnnouncementsChat
// ============================================================================

/**
 * Parameters for createSeasonAnnouncementsChat
 */
export interface CreateSeasonAnnouncementsChatParams {
  seasonId: string;
}

/**
 * Result of createSeasonAnnouncementsChat.
 */
export interface CreateSeasonAnnouncementsChatResult {
  conversationId: string;
  created: boolean;
}

/**
 * Create the auto-managed season-announcements chat for a given season.
 *
 * One announcements channel per season. Members are every distinct player
 * rostered on any team in the season. Per the brainstorm §5.1:
 *   - Players cannot LEAVE (cannot_leave = true) — they can only mute
 *     (notification_mode change, handled in Phase 2 UI)
 *   - Only LO / staff can POST. Phase 1 stores this as a convention; the
 *     RLS gate that enforces post-permission comes with the RLS-enablement
 *     project. AnnouncementModal (existing) already restricts posting at
 *     the UI layer.
 *
 * @param params - Season identifier
 * @returns Conversation id + created flag
 * @throws Error if season missing or inserts fail
 *
 * @example
 * await createSeasonAnnouncementsChat({ seasonId: activeSeason.id });
 */
export async function createSeasonAnnouncementsChat(
  params: CreateSeasonAnnouncementsChatParams
): Promise<CreateSeasonAnnouncementsChatResult> {
  const { seasonId } = params;

  // 1. Idempotency
  const { data: existing, error: lookupError } = await supabase
    .from('conversations')
    .select('id')
    .eq('scope_type', 'season')
    .eq('scope_id', seasonId)
    .eq('conversation_type', 'announcements')
    .eq('auto_managed', true)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Failed to look up existing season announcements chat: ${lookupError.message}`);
  }
  if (existing) {
    return { conversationId: existing.id, created: false };
  }

  // 2. Verify the season exists, pull division for the chat title
  const { data: season, error: seasonError } = await supabase
    .from('seasons')
    .select('id, season_name, league_id')
    .eq('id', seasonId)
    .single();

  if (seasonError || !season) {
    throw new Error(
      `Season not found for createSeasonAnnouncementsChat (seasonId=${seasonId}): ${seasonError?.message ?? 'no row'}`
    );
  }

  // 3. DISTINCT players in this season (joins team_players → teams to filter
  //    by season — team_players has its own season_id but the join is the
  //    canonical "who plays this season" query).
  const playerRows = await executeRosterQuery(seasonId);

  // 4. Insert the conversation
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .insert({
      title: season.season_name
        ? `${season.season_name} — Announcements`
        : 'Season Announcements',
      auto_managed: true,
      conversation_type: 'announcements',
      scope_type: 'season',
      scope_id: seasonId,
    })
    .select('id')
    .single();

  if (convError || !conversation) {
    throw new Error(
      `Failed to insert season announcements conversation: ${convError?.message ?? 'no row returned'}`
    );
  }

  // 5. Insert participants — every distinct player gets cannot_leave=true
  //    (D14 opt-out is for match chats, NOT announcements).
  const participantRows = playerRows.map((p) => ({
    conversation_id: conversation.id,
    user_id: p,
    cannot_leave: true,
  }));

  if (participantRows.length > 0) {
    const { error: partError } = await supabase
      .from('conversation_participants')
      .insert(participantRows);

    if (partError) {
      throw new Error(`Failed to add participants to season announcements: ${partError.message}`);
    }
  }

  // 6. Opening system message
  await postSystemMessage({
    conversationId: conversation.id,
    content: 'Season announcements channel created. Only league staff can post here.',
  });

  return { conversationId: conversation.id, created: true };
}


/**
 * Internal: return distinct member_ids who play any team in a season.
 *
 * Uses the supabase client (not raw SQL) so the function is portable across
 * environments and exercises the same client path the rest of the helpers
 * use. The teams join is the canonical "players in this season" query.
 */
async function executeRosterQuery(seasonId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('team_players')
    .select('member_id, teams!inner(season_id)')
    .eq('teams.season_id', seasonId);

  if (error) {
    throw new Error(`Failed to load season roster: ${error.message}`);
  }

  // Dedup at the JS layer — DISTINCT in PostgREST is awkward
  const uniqueMembers = new Set<string>((data ?? []).map((r) => r.member_id as string));
  return Array.from(uniqueMembers);
}
