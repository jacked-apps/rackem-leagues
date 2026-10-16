/**
 * @fileoverview The roster behind a team name.
 *
 * Powers `TeamNameLink`'s popover — tap a team name anywhere in the app and see
 * who is on it. That is the whole reason this is a cached query rather than the
 * fetch-on-open it started as: the popover now appears on pages that list many
 * teams at once (standings, a season's schedule), where the same roster gets
 * opened, closed and opened again while someone scans a table.
 *
 * Fetched lazily — `enabled` is the popover's open state, so a standings page
 * with a dozen teams issues no roster queries at all until someone asks.
 *
 * Distinct from `useTeamRoster` in `useTeams.ts`, which answers a different
 * question: that one returns membership ids and the captain flag for the roster
 * editor, this one carries the member rows needed to show names. They keep
 * separate cache keys — sharing one would let whichever query ran first decide
 * what the other consumer got back.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { queryKeys } from '@/api/queryKeys';

/** One roster row: the membership, plus the member it points at. */
export interface TeamRosterMember {
  member_id: string;
  is_captain: boolean;
  members: {
    id: string;
    first_name: string;
    last_name: string;
    system_player_number: number;
    bca_member_number: string | null;
  };
}

async function getTeamRosterWithMembers(teamId: string): Promise<TeamRosterMember[]> {
  const { data, error } = await supabase
    .from('team_players')
    .select(
      `
      member_id,
      is_captain,
      members:members!team_players_member_id_fkey(
        id,
        first_name,
        last_name,
        system_player_number,
        bca_member_number
      )
    `
    )
    .eq('team_id', teamId)
    // Captain first. They are the one person on the roster with powers the
    // others lack (renaming the team, adding and removing players), so they
    // are the useful name to surface — not because they run the match night.
    .order('is_captain', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as TeamRosterMember[];
}

/**
 * Fetch a team's roster for display.
 *
 * @param teamId - The team whose roster to load
 * @param enabled - Usually the popover's open state; false means no request
 */
export function useTeamRosterWithMembers(teamId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.teams.rosterWithMembers(teamId),
    queryFn: () => getTeamRosterWithMembers(teamId),
    enabled: enabled && !!teamId,
    // A roster does not change while someone reads a standings table.
    staleTime: 5 * 60 * 1000,
  });
}
