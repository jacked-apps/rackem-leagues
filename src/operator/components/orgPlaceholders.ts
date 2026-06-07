/**
 * @fileoverview Shared data shape + fetch for the org-placeholders surface.
 *
 * Extracted from `OrgPlaceholdersCard.tsx` so the card and its row components
 * (`PlaceholderRow`, `ArchivedRow`) all read one canonical row type and one
 * fetch path. Data comes from `get_org_placeholders_for_merge(orgId)`
 * (migration 20260422000016).
 */

import { supabase } from '@/supabaseClient';
import { logger } from '@/utils/logger';

/** One placeholder row as the org-placeholders RPC returns it. */
export interface OrgPlaceholderRow {
  member_id: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  system_player_number: number | null;
  email: string | null;
  has_stats: boolean;
  game_count: number;
  teams: { team_id: string; team_name: string; is_captain: boolean }[];
  creator_name: string | null;
  has_pending_invite: boolean;
  is_archived: boolean;
  archived_at: string | null;
  created_at: string;
}

/**
 * Fetch the organization's placeholder players for the merge/manage surface.
 *
 * @param orgId - Organization scope
 * @param includeArchived - When true, archived placeholders are included in the
 *   result (the caller filters to just archived for the Archived sub-section).
 */
export async function fetchOrgPlaceholders(
  orgId: string,
  includeArchived: boolean,
): Promise<OrgPlaceholderRow[]> {
  const { data, error } = await supabase.rpc('get_org_placeholders_for_merge', {
    p_org_id: orgId,
    p_include_archived: includeArchived,
  });
  if (error) {
    logger.error('Failed to fetch org placeholders', { error: error.message });
    throw error;
  }
  return (data as OrgPlaceholderRow[]) ?? [];
}
