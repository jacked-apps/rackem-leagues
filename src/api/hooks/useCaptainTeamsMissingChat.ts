/**
 * @fileoverview useCaptainTeamsMissingChat Hook
 *
 * Returns the list of teams the current user captains in an active season
 * that do NOT yet have an auto-managed team chat. Used by the captain
 * manual-fallback prompt on the Messages page (Unit 3, R11 — graceful
 * degradation when the season-activation trigger fails to create a chat).
 *
 * Most captains will get an empty array most of the time, so this is a
 * cheap query that renders nothing when there's nothing to surface.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { useCurrentMember } from './useCurrentMember';

/** A team the captain owns that's missing its auto-managed chat */
export interface CaptainTeamMissingChat {
  team_id: string;
  team_name: string;
  season_id: string;
}

/**
 * Find captained teams in an active season that lack an auto-managed team chat.
 * Two-step lookup: (1) captained active-season teams, (2) which of those already
 * have a chat. Set-subtract gives the missing ones.
 */
async function fetchCaptainTeamsMissingChat(
  memberId: string
): Promise<CaptainTeamMissingChat[]> {
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, team_name, season_id, seasons!inner(status)')
    .eq('captain_id', memberId)
    .eq('seasons.status', 'active');

  if (teamsError) {
    throw new Error(`Failed to load captained teams: ${teamsError.message}`);
  }
  if (!teams || teams.length === 0) return [];

  const teamIds = teams.map((t) => t.id);
  const { data: existing, error: convError } = await supabase
    .from('conversations')
    .select('scope_id')
    .eq('scope_type', 'team')
    .eq('auto_managed', true)
    .in('scope_id', teamIds);

  if (convError) {
    throw new Error(`Failed to look up existing team chats: ${convError.message}`);
  }

  const haveChat = new Set((existing ?? []).map((c) => c.scope_id));
  return teams
    .filter((t) => !haveChat.has(t.id))
    .map((t) => ({
      team_id: t.id,
      team_name: t.team_name,
      season_id: t.season_id,
    }));
}

/**
 * Hook: teams the current user captains in an active season that are missing
 * their auto-managed team chat. Returns `[]` when nothing's missing.
 *
 * @example
 * const { data: missing = [] } = useCaptainTeamsMissingChat();
 * if (missing.length === 0) return null;
 */
export function useCaptainTeamsMissingChat() {
  const { data: member } = useCurrentMember();
  const memberId = member?.id;

  return useQuery({
    queryKey: ['messages', 'captainTeamsMissingChat', memberId ?? ''],
    queryFn: () => fetchCaptainTeamsMissingChat(memberId!),
    enabled: !!memberId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
