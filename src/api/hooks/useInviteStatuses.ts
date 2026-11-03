/**
 * @fileoverview useInviteStatuses Hook
 *
 * Fetches invite token statuses for placeholder players.
 * Used by TeamEditorModal to show "Invite Sent" or "Invite Expired" badges
 * on placeholder player cards.
 *
 * Queries the invite_tokens table directly for the most recent invite
 * for each member_id. Returns status and expiration info.
 *
 * @example
 * const ppMemberIds = ['uuid-1', 'uuid-2'];
 * const { getInviteStatus, loading } = useInviteStatuses(ppMemberIds);
 * const status = getInviteStatus('uuid-1'); // { status: 'pending', isExpired: false }
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { queryKeys } from '../queryKeys';

/**
 * Invite status for a single member
 */
export interface InviteStatus {
  /** Member ID this status belongs to */
  memberId: string;
  /** Current invite status from database */
  status: 'pending' | 'claimed' | 'expired' | 'cancelled';
  /** True if the invite has expired (based on expires_at) */
  isExpired: boolean;
  /** When the invite expires */
  expiresAt: string | null;
  /** When the invite was sent */
  createdAt: string;
  /** Email the invite was sent to */
  email: string;
}

/**
 * Fetch invite statuses for multiple members
 * Gets the most recent invite for each member_id
 */
async function fetchInviteStatuses(memberIds: string[]): Promise<Map<string, InviteStatus>> {
  if (memberIds.length === 0) {
    return new Map();
  }

  // Fetch all invites for these members, ordered by created_at desc
  // We'll pick the most recent one per member
  const { data, error } = await supabase
    .from('invite_tokens')
    .select('member_id, status, expires_at, created_at, email')
    .in('member_id', memberIds)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching invite statuses:', error);
    throw error;
  }

  // Build a map with most recent invite per member
  const statusMap = new Map<string, InviteStatus>();
  const now = new Date();

  for (const invite of data || []) {
    // Never null here (the query filters on member_id), but the column is
    // nullable in the generated type.
    if (!invite.member_id) continue;
    // Skip if we already have an entry for this member (we want the most recent)
    if (statusMap.has(invite.member_id)) {
      continue;
    }

    const expiresAt = invite.expires_at ? new Date(invite.expires_at) : null;
    const isExpired = invite.status === 'expired' || (expiresAt !== null && expiresAt < now);

    statusMap.set(invite.member_id, {
      memberId: invite.member_id,
      status: invite.status as InviteStatus['status'],
      isExpired,
      expiresAt: invite.expires_at,
      createdAt: invite.created_at,
      email: invite.email,
    });
  }

  return statusMap;
}

/**
 * Hook to get invite statuses for placeholder players
 *
 * Pass an array of PP member IDs to fetch their invite statuses.
 * Returns a helper function to look up status by member ID.
 *
 * @param memberIds - Array of placeholder player member IDs
 * @returns Object with status lookup function and loading state
 */
export function useInviteStatuses(memberIds: string[]) {
  // Filter to only valid UUIDs and dedupe
  const validIds = [...new Set(memberIds.filter(id => id && id.length > 0))];

  const query = useQuery({
    queryKey: queryKeys.invites.byMembers(validIds),
    queryFn: () => fetchInviteStatuses(validIds),
    enabled: validIds.length > 0,
    staleTime: 1000 * 60 * 2, // 2 minutes - refresh reasonably often
    refetchOnWindowFocus: false,
  });

  const statusMap = query.data || new Map<string, InviteStatus>();

  /**
   * Get invite status for a specific member
   * @param memberId - The member ID to look up
   * @returns InviteStatus object or null if no invite exists
   */
  const getInviteStatus = (memberId: string): InviteStatus | null => {
    return statusMap.get(memberId) || null;
  };

  /**
   * Check if a member has a pending (non-expired) invite
   */
  const hasPendingInvite = (memberId: string): boolean => {
    const status = statusMap.get(memberId);
    return status !== undefined && status.status === 'pending' && !status.isExpired;
  };

  /**
   * Check if a member has an expired invite
   */
  const hasExpiredInvite = (memberId: string): boolean => {
    const status = statusMap.get(memberId);
    return status !== undefined && (status.status === 'expired' || status.isExpired);
  };

  return {
    /** Get invite status for a member */
    getInviteStatus,
    /** Check if member has pending invite */
    hasPendingInvite,
    /** Check if member has expired invite */
    hasExpiredInvite,
    /** Raw status map */
    statusMap,
    /** Loading state */
    loading: query.isLoading,
    /** Error state */
    error: query.error,
    /** Refetch statuses */
    refetch: query.refetch,
  };
}
