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
}

/**
 * Resolve the org_id for a conversation, regardless of scope shape.
 *
 * - `scope_type='organization'` → scope_id IS the org_id.
 * - `scope_type='season'` → join season → league → organization.
 * - Anything else (team chats etc.) → null; this hook isn't designed
 *   to gate non-announcement chats by staff status.
 */
async function resolveOrgIdForScope(
  scopeType: string | null,
  scopeId: string | null
): Promise<string | null> {
  if (!scopeType || !scopeId) return null;

  if (scopeType === 'organization') return scopeId;

  if (scopeType === 'season') {
    const { data, error } = await supabase
      .from('seasons')
      .select('league:leagues!inner(organization_id)')
      .eq('id', scopeId)
      .single();

    if (error || !data) return null;
    const league = data.league as { organization_id: string } | { organization_id: string }[];
    if (Array.isArray(league)) return league[0]?.organization_id ?? null;
    return league?.organization_id ?? null;
  }

  return null;
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
    return { readOnly: true, reason: 'past-member', cannotLeave: false };
  }
  if (participant.left_at !== null) {
    return { readOnly: true, reason: 'past-member', cannotLeave: false };
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
    return { readOnly: false, reason: null, cannotLeave };
  }

  // Step 3: staff check for the announcement's org.
  const orgId = await resolveOrgIdForScope(conv.scope_type, conv.scope_id);
  if (!orgId) {
    // Can't resolve an org → fail closed (treat as non-staff).
    return { readOnly: true, reason: 'announcement-non-staff', cannotLeave };
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
    ? { readOnly: false, reason: null, cannotLeave }
    : { readOnly: true, reason: 'announcement-non-staff', cannotLeave };
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
