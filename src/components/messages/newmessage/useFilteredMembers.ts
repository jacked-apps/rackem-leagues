/**
 * @fileoverview useFilteredMembers Hook
 *
 * Custom hook for fetching and filtering members for messaging.
 * Handles:
 * - Fetching all members (excluding current user)
 * - Filtering out blocked users
 * - Search filtering by name or player number
 */

import { useMemo } from 'react';
import { useAllMembers, useBlockedUsers } from '@/api/hooks';
import type { MemberForMessaging } from '@/types';

export function useFilteredMembers(currentUserId: string, searchQuery: string) {
  // Fetch all members (excluding current user) with TanStack Query
  const { data: allMembers = [], isLoading: membersLoading } = useAllMembers(currentUserId);

  // Fetch blocked users with TanStack Query
  const { data: blockedUsersData = [] } = useBlockedUsers(currentUserId);
  // getBlockedUsers already returns the blocked member IDs as plain strings.
  const blockedUserIds = blockedUsersData;

  // Filter out blocked users
  const members = useMemo(() => {
    return allMembers.filter((member: MemberForMessaging) => !blockedUserIds.includes(member.id));
  }, [allMembers, blockedUserIds]);

  // Filter by search query
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;

    const query = searchQuery.toLowerCase();
    const cleanQuery = query.replace(/^p-?/, ''); // Remove 'p' or 'p-' prefix

    return members.filter((member: MemberForMessaging) => {
      const fullName = `${member.first_name} ${member.last_name}`.toLowerCase();
      const playerNumber = member.system_player_number.toString().padStart(5, '0');

      return fullName.includes(query) || playerNumber.includes(cleanQuery);
    });
  }, [members, searchQuery]);

  return {
    members: filteredMembers,
    loading: membersLoading,
  };
}
