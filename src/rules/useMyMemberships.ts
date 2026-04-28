/**
 * @fileoverview Derive the current user's org + league memberships for the
 * House-rules filter defaulting (R10) and scope picker.
 *
 * Membership comes from two sources, merged and deduped:
 *   1. **Player** — team_players rows for the user's member_id → their teams
 *      → those teams' leagues → those leagues' owning organizations.
 *   2. **Staff** — organization_staff rows for the user's member_id → those
 *      organizations (plus every league under each of those orgs).
 *
 * Logged-out users and members-of-nothing get back `{ organizations: [],
 * leagues: [] }` — the scope picker renders the "pick a league" empty state.
 */

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/supabaseClient';
import type { MyMemberships } from './house-rules.types';

/** Build a display label for a league row (no dedicated `name` column). */
function leagueDisplayName(row: { game_type: string; day_of_week: string; division: string | null }): string {
  const base = `${titleCase(row.game_type)} ${titleCase(row.day_of_week)}s`;
  return row.division ? `${base} (${row.division})` : base;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function fetchMyMemberships(): Promise<MyMemberships> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { organizations: [], leagues: [] };

  // Resolve the user's member_id.
  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  const memberId = (member as { id: string } | null)?.id;
  if (!memberId) return { organizations: [], leagues: [] };

  // Player leagues: team_players → teams → leagues → organizations.
  const { data: playerLeagues } = await supabase
    .from('team_players')
    .select(
      'teams:team_id(league:league_id(id, game_type, day_of_week, division, organization:organization_id(id, organization_name)))',
    )
    .eq('member_id', memberId);

  // Staff orgs.
  const { data: staffOrgs } = await supabase
    .from('organization_staff')
    .select('organization:organization_id(id, organization_name)')
    .eq('member_id', memberId);

  const orgMap = new Map<string, { id: string; name: string }>();
  const leagueMap = new Map<
    string,
    { id: string; displayName: string; organizationId: string; organizationName: string }
  >();

  for (const row of (playerLeagues ?? []) as unknown as Array<{
    teams: {
      league: {
        id: string;
        game_type: string;
        day_of_week: string;
        division: string | null;
        organization: { id: string; organization_name: string } | null;
      } | null;
    } | null;
  }>) {
    const league = row.teams?.league;
    if (!league || !league.organization) continue;
    orgMap.set(league.organization.id, {
      id: league.organization.id,
      name: league.organization.organization_name,
    });
    leagueMap.set(league.id, {
      id: league.id,
      displayName: leagueDisplayName(league),
      organizationId: league.organization.id,
      organizationName: league.organization.organization_name,
    });
  }

  for (const row of (staffOrgs ?? []) as unknown as Array<{
    organization: { id: string; organization_name: string } | null;
  }>) {
    if (!row.organization) continue;
    orgMap.set(row.organization.id, {
      id: row.organization.id,
      name: row.organization.organization_name,
    });
  }

  return {
    organizations: [...orgMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    leagues: [...leagueMap.values()].sort((a, b) => a.displayName.localeCompare(b.displayName)),
  };
}

/** React hook — cached per user session. */
export function useMyMemberships() {
  return useQuery({
    queryKey: ['rules', 'my-memberships'],
    queryFn: fetchMyMemberships,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
