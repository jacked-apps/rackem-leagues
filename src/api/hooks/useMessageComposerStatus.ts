/**
 * @fileoverview useMessageComposerStatus Hook
 *
 * Determines whether the current user should see a write-capable composer
 * or a read-only banner when viewing a conversation. Two reasons can
 * surface a banner:
 *
 *   - `past-member`: the user's `conversation_participants.left_at` is
 *     non-NULL. They were on this chat once but have since been removed
 *     (roster change, captain transfer, soft-delete, etc.). They can
 *     still read history, just not post.
 *
 *   - `announcement-non-staff`: the conversation is an announcements
 *     channel (org-wide or season-wide) and the current user is NOT a
 *     member of `organization_staff` for the relevant org. Announcements
 *     are intentionally one-way — staff post via the dedicated
 *     AnnouncementModal, everyone else reads.
 *
 * Both cases unmount the composer entirely (R5 + the
 * announcements-feel-one-way decision from 2026-05-12).
 *
 * Data-layer enforcement (RLS) is intentionally deferred — see
 * `LIST_FOR_ED.md` #29. This hook is the UI gate today; defense-in-depth
 * via RLS lands with the RLS-enablement project.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { useCurrentMember } from './useCurrentMember';

export type ComposerLockReason = 'past-member' | 'announcement-non-staff';

export interface ComposerStatus {
  readOnly: boolean;
  reason: ComposerLockReason | null;
  /** Unit 12: when true, the current user's participant row has
   *  `cannot_leave = TRUE` on this conversation — used by the UI to
   *  hide the Leave option in the conversation header menu. Captains
   *  on their own team chat / captains chat have this set. Past
   *  members (readOnly=true, reason='past-member') always have
   *  cannotLeave=false because they've already left. */
  cannotLeave: boolean;
  /** Unit 18: for announcements channels, the org or league name to
   *  interpolate into the `ReadOnlyBanner` copy ("Only staff from
   *  <name> can post here."). Null for non-announcement chats and
   *  for announcements where the lookup couldn't resolve. */
  contextName: string | null;
}

/**
 * Resolve the org_id AND a human-readable context name for a
 * conversation's scope. The context name is what the `ReadOnlyBanner`
 * interpolates ("Only staff from <name> can post here.") — for
 * organization-scoped chats it's the org name; for season-scoped
 * chats it's the league name (division → day_of_week → "League").
 *
 * - `scope_type='organization'` → org_id is scope_id; name is org name.
 * - `scope_type='season'` → join season → league → organization;
 *   org_id from league.organization_id, name from league.division /
 *   day_of_week.
 * - Anything else (team chats etc.) → both null; this hook isn't
 *   designed to gate non-announcement chats by staff status.
 */
async function resolveOrgAndContextForScope(
  scopeType: string | null,
  scopeId: string | null,
): Promise<{ orgId: string | null; contextName: string | null }> {
  if (!scopeType || !scopeId) return { orgId: null, contextName: null };

  if (scopeType === 'organization') {
    const { data, error } = await supabase
      .from('organizations')
      .select('id, organization_name')
      .eq('id', scopeId)
      .single();
    if (error || !data) return { orgId: scopeId, contextName: null };
    return { orgId: data.id, contextName: data.organization_name ?? null };
  }

  if (scopeType === 'season') {
    const { data, error } = await supabase
      .from('seasons')
      .select('league:leagues!inner(organization_id, division, day_of_week)')
      .eq('id', scopeId)
      .single();

    if (error || !data) return { orgId: null, contextName: null };
    const leagueRaw = data.league as
      | { organization_id: string; division: string | null; day_of_week: string | null }
      | { organization_id: string; division: string | null; day_of_week: string | null }[];
    const league = Array.isArray(leagueRaw) ? leagueRaw[0] : leagueRaw;
    if (!league) return { orgId: null, contextName: null };
    const contextName = league.division ?? league.day_of_week ?? null;
    return { orgId: league.organization_id, contextName };
  }

  return { orgId: null, contextName: null };
}

async function fetchComposerStatus(
  conversationId: string,
  memberId: string
): Promise<ComposerStatus> {
  // Step 1: current user's participant row for this conversation.
  // If the user isn't a participant at all, return read-only past-member
  // — they shouldn't be on this view, but the banner is the safe fallback.
  const { data: participant, error: pErr } = await supabase
    .from('conversation_participants')
    .select('left_at, cannot_leave')
    .eq('conversation_id', conversationId)
    .eq('user_id', memberId)
    .maybeSingle();

  if (pErr) {
    throw new Error(`Failed to load participant: ${pErr.message}`);
  }
  if (!participant) {
    return { readOnly: true, reason: 'past-member', cannotLeave: false, contextName: null };
  }
  if (participant.left_at !== null) {
    return { readOnly: true, reason: 'past-member', cannotLeave: false, contextName: null };
  }

  const cannotLeave = participant.cannot_leave === true;

  // Step 2: conversation shape. Only announcements need the staff gate.
  const { data: conv, error: cErr } = await supabase
    .from('conversations')
    .select('conversation_type, scope_type, scope_id')
    .eq('id', conversationId)
    .single();

  if (cErr || !conv) {
    throw new Error(`Failed to load conversation: ${cErr?.message ?? 'no row'}`);
  }
  if (conv.conversation_type !== 'announcements') {
    return { readOnly: false, reason: null, cannotLeave, contextName: null };
  }

  // Step 3: staff check + context-name resolution for the announcement's org.
  const { orgId, contextName } = await resolveOrgAndContextForScope(
    conv.scope_type,
    conv.scope_id,
  );
  if (!orgId) {
    // Can't resolve an org → fail closed (treat as non-staff).
    return { readOnly: true, reason: 'announcement-non-staff', cannotLeave, contextName };
  }

  const { data: staff, error: sErr } = await supabase
    .from('organization_staff')
    .select('member_id')
    .eq('organization_id', orgId)
    .eq('member_id', memberId)
    .maybeSingle();

  if (sErr) {
    throw new Error(`Failed to check staff status: ${sErr.message}`);
  }

  return staff
    ? { readOnly: false, reason: null, cannotLeave, contextName }
    : { readOnly: true, reason: 'announcement-non-staff', cannotLeave, contextName };
}

/**
 * Hook: should the message composer be shown, or should a read-only
 * banner replace it for the given conversation?
 *
 * @example
 * const { data: status } = useMessageComposerStatus(conversationId);
 * if (status?.readOnly) return <ReadOnlyBanner reason={status.reason!} />;
 * return <MessageInput onSend={handleSend} />;
 */
export function useMessageComposerStatus(conversationId: string | null | undefined) {
  const { data: member } = useCurrentMember();
  const memberId = member?.id;

  return useQuery({
    queryKey: ['messages', 'composerStatus', conversationId ?? '', memberId ?? ''],
    queryFn: () => fetchComposerStatus(conversationId!, memberId!),
    enabled: !!conversationId && !!memberId,
    staleTime: 1000 * 60, // 1 minute — participant/staff status doesn't change often
    refetchOnWindowFocus: false,
  });
}
