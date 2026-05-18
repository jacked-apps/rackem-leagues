/**
 * @fileoverview Pre-fill query for the "Start Next Season" wizard.
 *
 * Bundles every piece of data the wizard needs to pre-populate its
 * stages from the league's most recent season:
 *   - previousSeason (dates, length, season_name)
 *   - returningTeams (with their captain + roster + home_venue)
 *   - leagueVenues (currently-assigned venues, available to carry over)
 *   - schedulePattern (day_of_week, start_time — derived from the
 *     league row)
 *   - leaguePrefs (resolved preferences for read-only display)
 *
 * Single function so the page can hit it in one round-trip and feed
 * each stage's initial values from the same atomic snapshot.
 *
 * Returns NULL when the league has no completed/active season to
 * copy from — the page should show a friendly error in that case
 * pointing operators to the first-time setup flow.
 */

import { supabase } from '@/supabaseClient';

export interface NewSeasonPrefillTeam {
  id: string;
  team_name: string;
  captain_id: string | null;
  captain: { id: string; first_name: string; last_name: string } | null;
  home_venue_id: string | null;
  roster: { member_id: string; is_captain: boolean }[];
  vacancyCount: number;
}

export interface NewSeasonPrefillVenue {
  venue_id: string;
  venue_name: string;
  available_table_numbers: number[] | null;
  capacity: number | null;
}

export interface NewSeasonPrefill {
  league: {
    id: string;
    organization_id: string;
    game_type: string;
    day_of_week: string;
    division: string | null;
    league_start_date: string;
  };
  previousSeason: {
    id: string;
    season_name: string;
    start_date: string;
    end_date: string;
    season_length: number;
    status: string;
  };
  returningTeams: NewSeasonPrefillTeam[];
  leagueVenues: NewSeasonPrefillVenue[];
  leaguePrefs: {
    handicap_type?: string;
    lineup_size?: number;
    max_roster_size?: number;
  };
}

/**
 * Fetch everything the new-season wizard needs to pre-populate its
 * stages. Returns null when the league has no season to copy from.
 *
 * Note: "previous" here means "most recent season regardless of
 * status" — could be still-active (operator starting next-season
 * planning early), or completed (operator wrapping up). The page
 * uses isNextSeasonRipe() separately to gate access; this query
 * just returns whatever's available.
 */
export async function getNewSeasonPrefill(
  leagueId: string,
): Promise<NewSeasonPrefill | null> {
  // 1. League row + resolved preferences
  const [leagueResult, prefsResult] = await Promise.all([
    supabase
      .from('leagues')
      .select('id, organization_id, game_type, day_of_week, division, league_start_date')
      .eq('id', leagueId)
      .single(),
    supabase
      .from('resolved_league_preferences')
      .select('handicap_type, lineup_size, max_roster_size')
      .eq('league_id', leagueId)
      .single(),
  ]);

  if (leagueResult.error || !leagueResult.data) {
    throw new Error(`League not found: ${leagueResult.error?.message ?? 'unknown'}`);
  }

  // 2. Most recent season for this league (any status)
  const { data: previousSeason, error: seasonErr } = await supabase
    .from('seasons')
    .select('id, season_name, start_date, end_date, season_length, status')
    .eq('league_id', leagueId)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (seasonErr) {
    throw new Error(`Failed to load previous season: ${seasonErr.message}`);
  }
  if (!previousSeason) {
    return null; // No history — page handles this
  }

  // 3. Teams in that season with captain + roster
  const { data: teamsRaw, error: teamsErr } = await supabase
    .from('teams')
    .select(
      `id, team_name, captain_id, home_venue_id,
       captain:members!captain_id(id, first_name, last_name),
       team_players(member_id, is_captain, members(id, first_name, last_name))`,
    )
    .eq('season_id', previousSeason.id)
    .eq('status', 'active')
    .order('team_name', { ascending: true });

  if (teamsErr) {
    throw new Error(`Failed to load teams: ${teamsErr.message}`);
  }

  const returningTeams: NewSeasonPrefillTeam[] = (teamsRaw ?? []).map((t: any) => {
    const rosterRaw = (t.team_players ?? []) as { member_id: string; is_captain: boolean; members: any }[];
    // Vacancies = roster rows where the joined member came back null
    // (archived / deleted). The new-season RPC will skip these.
    const vacancyCount = rosterRaw.filter((p) => !p.members).length;
    const roster = rosterRaw
      .filter((p) => !!p.members)
      .map((p) => ({ member_id: p.member_id, is_captain: p.is_captain }));
    const captainRaw = Array.isArray(t.captain) ? t.captain[0] : t.captain;
    return {
      id: t.id,
      team_name: t.team_name,
      captain_id: t.captain_id,
      captain: captainRaw
        ? {
            id: captainRaw.id,
            first_name: captainRaw.first_name,
            last_name: captainRaw.last_name,
          }
        : null,
      home_venue_id: t.home_venue_id,
      roster,
      vacancyCount,
    };
  });

  // 4. Currently-assigned league venues
  const { data: venuesRaw, error: venuesErr } = await supabase
    .from('league_venues')
    .select(
      `venue_id, available_table_numbers, capacity,
       venue:venues!venue_id(name)`,
    )
    .eq('league_id', leagueId);

  if (venuesErr) {
    throw new Error(`Failed to load venues: ${venuesErr.message}`);
  }

  const leagueVenues: NewSeasonPrefillVenue[] = (venuesRaw ?? []).map((v: any) => {
    const venueRaw = Array.isArray(v.venue) ? v.venue[0] : v.venue;
    return {
      venue_id: v.venue_id,
      venue_name: venueRaw?.name ?? 'Unnamed venue',
      available_table_numbers: v.available_table_numbers,
      capacity: v.capacity,
    };
  });

  return {
    league: leagueResult.data,
    previousSeason,
    returningTeams,
    leagueVenues,
    leaguePrefs: prefsResult.data ?? {},
  };
}
