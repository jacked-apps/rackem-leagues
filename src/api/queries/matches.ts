/**
 * @fileoverview Match Query Functions
 *
 * Pure data fetching functions for match-related queries.
 * These functions return plain data and throw errors (no loading states).
 * Used by TanStack Query hooks for caching and state management.
 *
 * @see api/hooks/useMatches.ts - React hook wrapper
 */

import { supabase } from '@/supabaseClient';
import type { MatchWithLeagueSettings, MatchWithDetails } from '@/types';

/**
 * Season week with schedule info
 */
export interface SeasonWeek {
  id: string;
  season_id: string;
  week_number: number;
  scheduled_date: string;
  week_name: string;
  week_type: string;
  week_completed: boolean;
}

/**
 * Week schedule (week + matches)
 */
export interface WeekSchedule {
  week: SeasonWeek;
  matches: MatchWithDetails[];
}

/**
 * Fetch match by ID with all details
 *
 * Gets complete match record with team, venue, and week details.
 *
 * @param matchId - Match's primary key ID
 * @returns Complete match record with nested details
 * @throws Error if match not found or database error
 *
 * @example
 * const match = await getMatchById('match-uuid');
 * console.log(`${match.home_team.team_name} vs ${match.away_team.team_name}`);
 */
export async function getMatchById(matchId: string): Promise<MatchWithDetails> {
  const { data, error } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!matches_home_team_id_fkey(id, team_name, captain_id),
      away_team:teams!matches_away_team_id_fkey(id, team_name, captain_id),
      scheduled_venue:venues!matches_scheduled_venue_id_fkey(id, name, street_address, city, state),
      season_week:season_weeks(id, scheduled_date, week_name, week_type)
    `)
    .eq('id', matchId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch match: ${error.message}`);
  }

  return data as MatchWithDetails;
}

/**
 * Fetch all matches for a season with details
 *
 * Gets all matches for a season ordered by match number.
 * Includes team, venue, and week details.
 *
 * @param seasonId - Season's primary key ID
 * @returns Array of matches with nested details
 * @throws Error if database query fails
 *
 * @example
 * const matches = await getMatchesBySeason('season-uuid');
 * matches.forEach(match => console.log(`Match ${match.match_number}: ${match.home_team.team_name} vs ${match.away_team.team_name}`));
 */
export async function getMatchesBySeason(seasonId: string): Promise<MatchWithDetails[]> {
  const { data, error } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!matches_home_team_id_fkey(id, team_name, captain_id),
      away_team:teams!matches_away_team_id_fkey(id, team_name, captain_id),
      scheduled_venue:venues!matches_scheduled_venue_id_fkey(id, name, street_address, city, state),
      season_week:season_weeks(id, scheduled_date, week_name, week_type)
    `)
    .eq('season_id', seasonId)
    .order('match_number', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch matches: ${error.message}`);
  }

  return (data || []) as MatchWithDetails[];
}

/**
 * Fetch all matches for a team
 *
 * Gets all matches where team is home or away.
 * Ordered by scheduled date.
 *
 * @param teamId - Team's primary key ID
 * @returns Array of matches with nested details
 * @throws Error if database query fails
 *
 * @example
 * const matches = await getMatchesByTeam('team-uuid');
 * const upcomingMatches = matches.filter(m => m.status === 'scheduled');
 */
export async function getMatchesByTeam(teamId: string): Promise<MatchWithDetails[]> {
  const { data, error } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!matches_home_team_id_fkey(id, team_name, captain_id),
      away_team:teams!matches_away_team_id_fkey(id, team_name, captain_id),
      scheduled_venue:venues!matches_scheduled_venue_id_fkey(id, name, city, state),
      season_week:season_weeks(id, week_name, scheduled_date)
    `)
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .order('season_week(scheduled_date)', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch team matches: ${error.message}`);
  }

  // Transform to include scheduled_date at top level
  const matches = (data || []).map((match: any) => ({
    ...match,
    scheduled_date: match.season_week?.scheduled_date || null,
  }));

  return matches as MatchWithDetails[];
}

/**
 * Fetch all currently-live matches for a league.
 *
 * "Live" means both lineups have locked (started_at is set by the
 * lineup-persistence flow when both sides lock) and the match has not yet
 * been marked completed. This codebase doesn't actually transition matches
 * to status='in_progress' — they sit at 'scheduled' until completeMatch()
 * flips them to 'completed', so we key off started_at instead of status.
 *
 * @param leagueId - League's primary key ID
 * @returns Array of live matches with team and week details, sorted by
 *          scheduled date ascending (so the current match night groups together)
 * @throws Error if database query fails
 */
export async function getLiveMatchesForLeague(leagueId: string): Promise<MatchWithDetails[]> {
  // matches has no league_id column — it's joined via seasons.league_id.
  // `!inner` turns the join into an INNER JOIN so the league filter works.
  const { data, error } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!matches_home_team_id_fkey(id, team_name, captain_id),
      away_team:teams!matches_away_team_id_fkey(id, team_name, captain_id),
      scheduled_venue:venues!matches_scheduled_venue_id_fkey(id, name, city, state),
      season_week:season_weeks(id, week_name, scheduled_date, week_type),
      season:seasons!inner(id, league_id, league:leagues(id, game_type, day_of_week, division))
    `)
    .eq('season.league_id', leagueId)
    .not('started_at', 'is', null)
    .neq('status', 'completed')
    .order('season_week(scheduled_date)', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch live matches: ${error.message}`);
  }

  const matches = (data || []).map((match: any) => ({
    ...match,
    scheduled_date: match.season_week?.scheduled_date || null,
  }));

  return matches as MatchWithDetails[];
}

/**
 * Fetch all currently-live matches across every league where the given
 * member is on a team's roster.
 *
 * "On a team" = has a row in team_players for a team in that league's season.
 * This scoping enforces the product rule that players can only spectate
 * matches in leagues they participate in — no peeking into other leagues
 * just because they exist.
 *
 * LOs who aren't on any team will see nothing here. That's intentional; an
 * LO-wide cross-league view is a separate feature that hasn't been asked for.
 *
 * @param memberId - The current user's members.id
 * @returns Array of live matches grouped-in-caller-side by league
 */
export async function getLiveMatchesForMember(memberId: string): Promise<MatchWithDetails[]> {
  // Step 1: find the league IDs the member is participating in (via
  // team_players → teams → seasons → leagues). We do this as a separate
  // query because PostgREST doesn't let us filter on a sub-select inside the
  // matches query directly.
  const { data: teamRows, error: teamErr } = await supabase
    .from('team_players')
    .select('team:teams!inner(season:seasons!inner(league_id))')
    .eq('member_id', memberId);

  if (teamErr) {
    throw new Error(`Failed to resolve member's leagues: ${teamErr.message}`);
  }

  const leagueIds = Array.from(
    new Set(
      (teamRows ?? [])
        .map((r: any) => r.team?.season?.league_id)
        .filter(Boolean),
    ),
  );

  if (leagueIds.length === 0) return [];

  // Step 2: fetch live matches in those leagues.
  const { data, error } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!matches_home_team_id_fkey(id, team_name, captain_id),
      away_team:teams!matches_away_team_id_fkey(id, team_name, captain_id),
      scheduled_venue:venues!matches_scheduled_venue_id_fkey(id, name, city, state),
      season_week:season_weeks(id, week_name, scheduled_date, week_type),
      season:seasons!inner(id, league_id, league:leagues(id, game_type, day_of_week, division))
    `)
    .in('season.league_id', leagueIds)
    .not('started_at', 'is', null)
    .neq('status', 'completed')
    .order('season_week(scheduled_date)', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch live matches: ${error.message}`);
  }

  const matches = (data || []).map((match: any) => ({
    ...match,
    scheduled_date: match.season_week?.scheduled_date || null,
  }));

  return matches as MatchWithDetails[];
}

/**
 * Fetch season schedule organized by week
 *
 * Gets all weeks and matches for a season, organized hierarchically.
 * Used for displaying full season schedule with week groupings.
 *
 * @param seasonId - Season's primary key ID
 * @returns Array of weeks with their matches
 * @throws Error if database query fails
 *
 * @example
 * const schedule = await getSeasonSchedule('season-uuid');
 * schedule.forEach(({ week, matches }) => {
 *   console.log(`${week.week_name}: ${matches.length} matches`);
 * });
 */
export async function getSeasonSchedule(seasonId: string): Promise<WeekSchedule[]> {
  // Fetch all season weeks
  const { data: weeksData, error: weeksError } = await supabase
    .from('season_weeks')
    .select('*')
    .eq('season_id', seasonId)
    .order('scheduled_date', { ascending: true });

  if (weeksError) {
    throw new Error(`Failed to fetch season weeks: ${weeksError.message}`);
  }

  // Fetch all matches for season
  const matches = await getMatchesBySeason(seasonId);

  // Organize matches by week
  const schedule: WeekSchedule[] = (weeksData || []).map((week) => ({
    week: week as SeasonWeek,
    matches: matches.filter((match) => match.season_week_id === week.id),
  }));

  return schedule;
}

/**
 * Fetch season weeks for a season
 *
 * Gets all week records (regular, blackout, playoffs, breaks).
 * Ordered by scheduled date.
 *
 * @param seasonId - Season's primary key ID
 * @returns Array of season weeks
 * @throws Error if database query fails
 *
 * @example
 * const weeks = await getSeasonWeeks('season-uuid');
 * const regularWeeks = weeks.filter(w => w.week_type === 'regular');
 */
export async function getSeasonWeeks(seasonId: string): Promise<SeasonWeek[]> {
  const { data, error } = await supabase
    .from('season_weeks')
    .select('*')
    .eq('season_id', seasonId)
    .order('scheduled_date', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch season weeks: ${error.message}`);
  }

  return (data || []) as SeasonWeek[];
}

/**
 * Fetch next upcoming or in-progress match for a team
 *
 * Returns the first match that is either in_progress or scheduled for today/future.
 * Used for "Quick Score" functionality on My Teams page.
 *
 * @param teamId - Team's primary key ID
 * @returns Next match or null if no upcoming matches
 * @throws Error if database query fails
 *
 * @example
 * const nextMatch = await getNextMatchForTeam('team-uuid');
 * if (nextMatch?.status === 'in_progress') {
 *   navigate(`/match/${nextMatch.id}/score`);
 * }
 */
export async function getNextMatchForTeam(teamId: string): Promise<MatchWithDetails | null> {
  const matches = await getMatchesByTeam(teamId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // First, check for in_progress matches
  const inProgressMatch = matches.find(m => m.status === 'in_progress');
  if (inProgressMatch) return inProgressMatch;

  // Then, find the first scheduled match today or in the future
  const upcomingMatches = matches
    .filter(m => {
      if (m.status !== 'scheduled') return false;
      if (!m.scheduled_date) return false;

      // Parse the date string as local date (YYYY-MM-DD)
      const [year, month, day] = m.scheduled_date.split('-').map(Number);
      const matchDate = new Date(year, month - 1, day);
      matchDate.setHours(0, 0, 0, 0);

      return matchDate >= today;
    })
    .sort((a, b) => {
      const dateA = a.scheduled_date!;
      const dateB = b.scheduled_date!;
      return dateA.localeCompare(dateB);
    });

  return upcomingMatches.length > 0 ? upcomingMatches[0] : null;
}

/**
 * Fetch match details with league settings for scoring
 *
 * Gets match with team names and league scoring configuration.
 * Used by scoring pages to access handicap variants and game rules.
 *
 * @param matchId - Match's primary key ID
 * @returns Match with league settings
 * @throws Error if match not found or database error
 *
 * @example
 * const match = await getMatchWithLeagueSettings('match-uuid');
 * console.log(`Handicap variant: ${match.league.handicap_variant}`);
 */
export async function getMatchWithLeagueSettings(matchId: string): Promise<MatchWithLeagueSettings> {
  const { data, error } = await supabase
    .from('matches')
    .select(`
      id,
      season_id,
      home_team_id,
      away_team_id,
      home_lineup_id,
      away_lineup_id,
      started_at,
      match_result,
      home_team_verified_by,
      away_team_verified_by,
      home_tiebreaker_verified_by,
      away_tiebreaker_verified_by,
      home_to_win,
      home_to_tie,
      home_to_lose,
      away_to_win,
      away_to_tie,
      away_to_lose,
      home_games_won,
      away_games_won,
      home_points_earned,
      away_points_earned,
      system_snapshot,
      assigned_table_number,
      home_team:teams!matches_home_team_id_fkey(id, team_name),
      away_team:teams!matches_away_team_id_fkey(id, team_name),
      scheduled_venue:venues!matches_scheduled_venue_id_fkey(id, name, city, state),
      actual_venue:venues!matches_actual_venue_id_fkey(id, name, city, state),
      season_week:season_weeks(scheduled_date),
      season:seasons!matches_season_id_fkey(
        league:leagues(
          id,
          handicap_variant,
          team_handicap_variant,
          golden_break_counts_as_win,
          game_type
        )
      )
    `)
    .eq('id', matchId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch match with league settings: ${error.message}`);
  }

  // Transform nested season/league structure
  const seasonData = Array.isArray(data.season) ? data.season[0] : data.season;
  const leagueData = seasonData && Array.isArray((seasonData as any).league)
    ? (seasonData as any).league[0]
    : (seasonData as any)?.league;

  const homeTeam = Array.isArray(data.home_team) ? data.home_team[0] : data.home_team;
  const awayTeam = Array.isArray(data.away_team) ? data.away_team[0] : data.away_team;
  const scheduledVenue = Array.isArray(data.scheduled_venue) ? data.scheduled_venue[0] : data.scheduled_venue;
  const actualVenue = Array.isArray(data.actual_venue) ? data.actual_venue[0] : data.actual_venue;
  const seasonWeek = Array.isArray(data.season_week) ? data.season_week[0] : data.season_week;

  return {
    id: data.id,
    season_id: data.season_id,
    home_team_id: data.home_team_id,
    away_team_id: data.away_team_id,
    home_lineup_id: data.home_lineup_id ?? null,
    away_lineup_id: data.away_lineup_id ?? null,
    started_at: data.started_at ?? null,
    match_result: data.match_result ?? null,
    scheduled_date: (seasonWeek as any)?.scheduled_date || '',
    home_team_verified_by: data.home_team_verified_by ?? null,
    away_team_verified_by: data.away_team_verified_by ?? null,
    home_tiebreaker_verified_by: data.home_tiebreaker_verified_by ?? null,
    away_tiebreaker_verified_by: data.away_tiebreaker_verified_by ?? null,
    home_to_win: data.home_to_win ?? null,
    home_to_tie: data.home_to_tie ?? null,
    home_to_lose: data.home_to_lose ?? null,
    away_to_win: data.away_to_win ?? null,
    away_to_tie: data.away_to_tie ?? null,
    away_to_lose: data.away_to_lose ?? null,
    home_games_won: data.home_games_won ?? 0,
    away_games_won: data.away_games_won ?? 0,
    home_points_earned: data.home_points_earned ?? 0,
    away_points_earned: data.away_points_earned ?? 0,
    system_snapshot: data.system_snapshot ?? null,
    assigned_table_number: data.assigned_table_number ?? null,
    home_team: homeTeam as any,
    away_team: awayTeam as any,
    scheduled_venue: scheduledVenue as any || null,
    actual_venue: actualVenue as any || null,
    season_week: seasonWeek as any || null,
    league: {
      id: leagueData?.id || '',
      handicap_variant: (leagueData?.handicap_variant || 'standard') as any,
      team_handicap_variant: (leagueData?.team_handicap_variant || 'standard') as any,
      golden_break_counts_as_win: leagueData?.golden_break_counts_as_win ?? false,
      game_type: leagueData?.game_type || '8-ball',
    },
  };
}

/**
 * Fetch match lineups for both teams
 *
 * Gets lineup records for home and away teams.
 * Can optionally require both lineups to exist and be locked (for scoring pages).
 * Or allow missing/unlocked lineups (for lineup setup pages).
 *
 * @param matchId - Match's primary key ID
 * @param homeTeamId - Home team's primary key ID
 * @param awayTeamId - Away team's primary key ID
 * @param requireLocked - If true, throws error if lineups don't exist or aren't locked (default: true)
 * @returns Object with homeLineup and awayLineup (may be null if requireLocked is false)
 * @throws Error if lineups not found/locked (when requireLocked=true) or database error
 *
 * @example
 * // For scoring page (requires both locked)
 * const { homeLineup, awayLineup } = await getMatchLineups(matchId, homeTeamId, awayTeamId);
 *
 * @example
 * // For lineup page (allows missing lineups)
 * const { homeLineup, awayLineup } = await getMatchLineups(matchId, homeTeamId, awayTeamId, false);
 * if (!homeLineup) console.log('Home lineup not created yet');
 */
export async function getMatchLineups(
  matchId: string,
  homeTeamId: string,
  awayTeamId: string,
  requireLocked: boolean = true
) {
  const { data: lineupsData, error: lineupsError } = await supabase
    .from('match_lineups')
    .select('*')
    .eq('match_id', matchId)
    .in('team_id', [homeTeamId, awayTeamId]);

  if (lineupsError) {
    throw new Error(`Failed to fetch lineups: ${lineupsError.message}`);
  }

  // Separate home and away lineups
  const homeLineupData = lineupsData?.find(l => l.team_id === homeTeamId);
  const awayLineupData = lineupsData?.find(l => l.team_id === awayTeamId);

  // Only enforce locked requirement if requested (for scoring page)
  if (requireLocked) {
    if (!homeLineupData || !awayLineupData) {
      throw new Error('Both team lineups must be locked before scoring can begin');
    }

    if (!homeLineupData.locked || !awayLineupData.locked) {
      throw new Error('Both team lineups must be locked before scoring can begin');
    }
  }

  return {
    homeLineup: homeLineupData || null,
    awayLineup: awayLineupData || null,
  };
}

/**
 * Fetch match games (scoring results)
 *
 * Gets all game records for a match showing winners, confirmations, etc.
 * Returns empty array if no games exist (should not happen in normal flow).
 * Used by scoring pages to display and update game results.
 *
 * @param matchId - Match's primary key ID
 * @returns Array of match game records
 * @throws Error if database error
 *
 * @example
 * const games = await getMatchGames(matchId);
 * const gamesMap = new Map(games.map(g => [g.game_number, g]));
 */
export async function getMatchGames(matchId: string) {
  const { data: gamesData, error: gamesError } = await supabase
    .from('match_games')
    .select('*')
    .eq('match_id', matchId);

  if (gamesError) {
    throw new Error(`Failed to fetch match games: ${gamesError.message}`);
  }

  return gamesData || [];
}

/**
 * Complete a match after both teams have verified
 *
 * Updates match status, calculates final scores, points, and determines winner.
 * All calculations are based on confirmed games only.
 *
 * For ties (winnerTeamId = null): saves scores/points but keeps status as 'in_progress'
 * so tiebreaker can determine final winner later.
 *
 * For wins: saves all data and marks match as 'completed'.
 *
 * @param matchId - Match ID to complete
 * @param completionData - Final match data including scores, winner, and points
 * @throws Error if update fails
 *
 * @example
 * // Saving tie scores (match stays in progress)
 * await completeMatch(matchId, {
 *   homeGamesWon: 9,
 *   awayGamesWon: 9,
 *   homePointsEarned: 0,
 *   awayPointsEarned: 0,
 *   winnerTeamId: null,
 *   matchResult: 'tie'
 * });
 *
 * @example
 * // Completing a match with winner
 * await completeMatch(matchId, {
 *   homeGamesWon: 10,
 *   awayGamesWon: 8,
 *   homePointsEarned: 1,
 *   awayPointsEarned: -1,
 *   winnerTeamId: 'home-team-id',
 *   matchResult: 'home_win'
 * });
 */
export async function completeMatch(
  matchId: string,
  completionData: {
    homeTeamScore?: number;
    awayTeamScore?: number;
    homeGamesWon?: number;
    awayGamesWon?: number;
    homePointsEarned?: number;
    awayPointsEarned?: number;
    winnerTeamId: string | null;
    matchResult: 'home_win' | 'away_win' | 'tie';
    homeVerifiedBy: string | null;
    awayVerifiedBy: string | null;
    resultsConfirmedByHome: boolean;
    resultsConfirmedByAway: boolean;
  }
) {
  // Build update object with required match completion fields
  const updateData: Record<string, unknown> = {
    // Result
    winner_team_id: completionData.winnerTeamId,
    match_result: completionData.matchResult,

    // Verification
    home_team_verified_by: completionData.homeVerifiedBy,
    away_team_verified_by: completionData.awayVerifiedBy,
    results_confirmed_by_home: completionData.resultsConfirmedByHome,
    results_confirmed_by_away: completionData.resultsConfirmedByAway,

    // Timestamp
    completed_at: new Date().toISOString(),
  };

  // Only update scores if provided (regular match, not tiebreaker)
  if (completionData.homeTeamScore !== undefined) {
    updateData.home_team_score = completionData.homeTeamScore;
  }
  if (completionData.awayTeamScore !== undefined) {
    updateData.away_team_score = completionData.awayTeamScore;
  }
  if (completionData.homeGamesWon !== undefined) {
    updateData.home_games_won = completionData.homeGamesWon;
  }
  if (completionData.awayGamesWon !== undefined) {
    updateData.away_games_won = completionData.awayGamesWon;
  }
  if (completionData.homePointsEarned !== undefined) {
    updateData.home_points_earned = completionData.homePointsEarned;
  }
  if (completionData.awayPointsEarned !== undefined) {
    updateData.away_points_earned = completionData.awayPointsEarned;
  }

  // Only mark as completed if there's a winner (not a tie)
  if (completionData.winnerTeamId !== null) {
    updateData.status = 'completed';
  }
  // If tie (winnerTeamId = null), status stays 'in_progress' for tiebreaker

  const { error } = await supabase
    .from('matches')
    .update(updateData)
    .eq('id', matchId);

  if (error) {
    throw new Error(`Failed to complete match: ${error.message}`);
  }
}

/**
 * Populate `matches.system_snapshot` if it's currently null — tier 3 mutability.
 *
 * Called at the first scoring event for a match. Reads the league's current
 * resolved preferences (full 13-axis modular cascade) plus
 * `leagues.system_overrides`, then writes them to the match as a frozen
 * snapshot. Subsequent calls are no-ops because the update is guarded by
 * `WHERE system_snapshot IS NULL`.
 *
 * Snapshot shape: `ResolvedSystemConfig` (see `src/types/resolvedSystemConfig.ts`).
 * Captures all modular axes plus per-league override dials so the scoring
 * runtime can reconstruct a SystemModule via `buildSystemFromPreferences`
 * (Phase 5 Unit 5.1) without re-querying possibly-edited live preferences.
 *
 * This is intentionally a best-effort operation: if it fails for any reason,
 * scoring continues. The snapshot is defense-in-depth against mid-season
 * dial edits; absence of a snapshot falls back to reading live league data
 * (Unit 5.2b will tighten this to a refuse-to-finalize policy once backfill
 * for legacy in-flight matches lands).
 *
 * Safe under concurrent writes: if two players confirm the first game in
 * parallel, both reads see null, both try to update, but both produce the
 * same snapshot content (same league state at the same moment), so
 * last-writer-wins is harmless.
 *
 * @param matchId - Match whose snapshot should be populated
 * @param leagueId - League the match belongs to (for prefs + overrides lookup)
 */
export async function populateMatchSnapshotIfNeeded(
  matchId: string,
  leagueId: string,
): Promise<void> {
  // Check if snapshot already exists to avoid unnecessary writes
  const { data: existing, error: readErr } = await supabase
    .from('matches')
    .select('system_snapshot')
    .eq('id', matchId)
    .single();

  if (readErr) {
    console.warn('[matches.populateMatchSnapshotIfNeeded] read error', readErr.message);
    return;
  }
  if (existing?.system_snapshot != null) {
    return; // Already populated — never overwrite
  }

  // Read full resolved preferences (all 13 modular axes) + per-league
  // override dials in parallel. The resolved view applies the league →
  // org → system-default cascade so we capture exactly what the league
  // looks like to the scoring runtime at this moment.
  const [resolvedRes, leagueRes] = await Promise.all([
    supabase
      .from('resolved_league_preferences')
      .select(
        'lineup_size, max_roster_size, game_generation, pairing_format, race_length, points_calculator, points_calculator_params, win_condition, handicap_type, mechanism, threshold_chart_id, standings_sort, tiebreaker_trigger, tiebreaker_format',
      )
      .eq('league_id', leagueId)
      .single(),
    supabase.from('leagues').select('system_overrides').eq('id', leagueId).single(),
  ]);

  if (resolvedRes.error) {
    console.warn(
      '[matches.populateMatchSnapshotIfNeeded] resolved-prefs read error',
      resolvedRes.error.message,
    );
    return;
  }

  const resolved = resolvedRes.data;
  const overrides = leagueRes.data?.system_overrides ?? {};

  // Build full ResolvedSystemConfig shape. Field order matches the type
  // definition in src/types/resolvedSystemConfig.ts for easy comparison.
  const snapshot = {
    lineup_size: resolved.lineup_size,
    max_roster_size: resolved.max_roster_size,
    game_generation: resolved.game_generation,
    pairing_format: resolved.pairing_format,
    race_length: resolved.race_length,
    points_calculator: resolved.points_calculator,
    points_calculator_params: resolved.points_calculator_params,
    win_condition: resolved.win_condition,
    handicap_type: resolved.handicap_type,
    mechanism: resolved.mechanism,
    threshold_chart_id: resolved.threshold_chart_id,
    standings_sort: resolved.standings_sort,
    tiebreaker_trigger: resolved.tiebreaker_trigger,
    tiebreaker_format: resolved.tiebreaker_format,
    overrides,
    snapshot_at: new Date().toISOString(),
  };

  // Conditional write — only set if still null (guards against simultaneous first-score races)
  const { error: writeErr } = await supabase
    .from('matches')
    .update({ system_snapshot: snapshot })
    .eq('id', matchId)
    .is('system_snapshot', null);

  if (writeErr) {
    console.warn('[matches.populateMatchSnapshotIfNeeded] write error', writeErr.message);
  }
}

/**
 * Recompute the four running totals for a match (`home_games_won`,
 * `away_games_won`, `home_points_earned`, `away_points_earned`) from the
 * current set of `match_games` rows and write them back to the match row.
 *
 * Phase 5 Unit 5.5 of the modular-league-system v2 plan: callers are the
 * per-game scoring mutations (insert / update / confirm / deny / vacate).
 * Eager recomputation on every mutation keeps the match row consistent
 * with the live scoreboard at all times — there is no match-end recompute
 * layer that could drift from what players witnessed during play.
 *
 * Behavior:
 *  - Reads the snapshot's `points_calculator` + `points_calculator_params`.
 *    Falls back to live `resolved_league_preferences` if the match has no
 *    snapshot yet (legacy match or scheduled-status edge case).
 *  - Reads the per-side thresholds from the match row itself (`home_to_win`
 *    / `home_to_tie` / etc., snapshotted at match preparation).
 *  - Reads all `match_games` rows for this match.
 *  - Filters to fully-confirmed regular (non-tiebreaker) games and runs the
 *    calculator over the result.
 *  - Writes the four running-total columns back to the match row.
 *  - Non-blocking: any error is logged and swallowed so a calculator hiccup
 *    or transient DB error doesn't fail the underlying scoring write.
 *
 * Race-safety: not strictly atomic with the per-game write — Supabase does
 * not give us a per-row transactional update from the client. Concurrent
 * scoring writes between two devices could produce a brief stale-totals
 * window. Real-time subscriptions trigger another mutation cycle and the
 * totals re-converge within a tick. The Unit 5.6 audit catches any
 * permanent divergence post-completion.
 *
 * @param matchId - The match to recompute totals for.
 */
export async function updateMatchRunningTotals(matchId: string): Promise<void> {
  const { computeMatchRunningTotals } = await import(
    '@/utils/match/computeMatchRunningTotals'
  );

  // matches has no `league_id` column — league_id lives on seasons,
  // joined via match.season_id. Pull season_id here and resolve
  // league_id only when the snapshot fallback path needs it.
  const { data: matchRow, error: matchErr } = await supabase
    .from('matches')
    .select(
      'home_team_id, away_team_id, home_to_win, home_to_tie, home_to_lose, away_to_win, away_to_tie, away_to_lose, system_snapshot, season_id',
    )
    .eq('id', matchId)
    .single();

  if (matchErr || !matchRow) {
    console.warn(
      '[matches.updateMatchRunningTotals] match read error',
      matchErr?.message ?? 'no match row',
    );
    return;
  }

  if (matchRow.home_to_win == null || matchRow.away_to_win == null) {
    return;
  }

  const snapshot = (matchRow.system_snapshot ?? null) as
    | { points_calculator: string | null; points_calculator_params: Record<string, unknown> }
    | null;

  let pointsCalculator: string | null;
  let pointsCalculatorParams: Record<string, unknown>;

  if (snapshot && 'points_calculator' in snapshot) {
    pointsCalculator = snapshot.points_calculator ?? null;
    pointsCalculatorParams =
      (snapshot.points_calculator_params as Record<string, unknown>) ?? {};
  } else {
    // Fallback path: resolve league_id via season, then read live prefs.
    // Only fires when system_snapshot wasn't populated (legacy / pre-
    // first-scoring-event matches).
    const { data: seasonRow } = await supabase
      .from('seasons')
      .select('league_id')
      .eq('id', matchRow.season_id)
      .single();
    if (seasonRow?.league_id) {
      const { data: resolved } = await supabase
        .from('resolved_league_preferences')
        .select('points_calculator, points_calculator_params')
        .eq('league_id', seasonRow.league_id)
        .single();
      pointsCalculator = resolved?.points_calculator ?? null;
      pointsCalculatorParams =
        (resolved?.points_calculator_params as Record<string, unknown>) ?? {};
    } else {
      pointsCalculator = null;
      pointsCalculatorParams = {};
    }
  }

  const { data: games, error: gamesErr } = await supabase
    .from('match_games')
    .select(
      'winner_team_id, loser_balls_pocketed, is_tiebreaker, confirmed_by_home, confirmed_by_away',
    )
    .eq('match_id', matchId);

  if (gamesErr || !games) {
    console.warn(
      '[matches.updateMatchRunningTotals] games read error',
      gamesErr?.message ?? 'no rows',
    );
    return;
  }

  const totals = computeMatchRunningTotals({
    homeTeamId: matchRow.home_team_id,
    awayTeamId: matchRow.away_team_id,
    homeThresholds: {
      games_to_win: matchRow.home_to_win,
      games_to_tie: matchRow.home_to_tie,
      games_to_lose: matchRow.home_to_lose,
    },
    awayThresholds: {
      games_to_win: matchRow.away_to_win,
      games_to_tie: matchRow.away_to_tie,
      games_to_lose: matchRow.away_to_lose,
    },
    games: games as Parameters<typeof computeMatchRunningTotals>[0]['games'],
    pointsCalculator,
    pointsCalculatorParams,
  });

  const { error: writeErr } = await supabase
    .from('matches')
    .update(totals)
    .eq('id', matchId);

  if (writeErr) {
    console.warn(
      '[matches.updateMatchRunningTotals] write error',
      writeErr.message,
    );
  }
}

/**
 * Match-completion scoring-consistency audit (Phase 5 Unit 5.6).
 *
 * After a match is marked complete, recompute the running totals from
 * `match_games` rows and compare against the stored totals on the match
 * row. If they diverge, log a structured warning to `app_logs` for the
 * dev to investigate. **The match record is NEVER modified** — players'
 * witnessed scoreboard is the source of truth.
 *
 * Non-blocking: any read error short-circuits with a debug log; the
 * caller's match-completion flow is never affected. Designed to be
 * fire-and-forget at the end of the completion transaction.
 *
 * Reusable: callers can also invoke this from a future "audit this
 * match" tool (out of scope for v1).
 *
 * @param matchId The completed match's ID.
 * @returns The audit result, primarily for tests + on-demand callers.
 *          Production fire-and-forget callers can ignore the return.
 */
export async function auditMatchScoringConsistency(
  matchId: string,
): Promise<{
  ok: boolean;
  reason?: 'audit_disabled_no_snapshot' | 'audit_read_error' | 'audit_threw';
  discrepancies?: ReadonlyArray<unknown>;
}> {
  const { compareRunningTotals } = await import('./../../utils/match/auditScoringConsistency');
  const { computeMatchRunningTotals } = await import(
    './../../utils/match/computeMatchRunningTotals'
  );
  const { logger } = await import('./../../utils/logger');

  try {
    const { data: matchRow, error: matchErr } = await supabase
      .from('matches')
      .select(
        'home_team_id, away_team_id, home_to_win, home_to_tie, home_to_lose, away_to_win, away_to_tie, away_to_lose, home_games_won, away_games_won, home_points_earned, away_points_earned, system_snapshot',
      )
      .eq('id', matchId)
      .single();

    if (matchErr || !matchRow) {
      logger.warn('[match-audit] match read error — audit skipped', {
        matchId,
        tag: 'match_scoring_audit_skipped',
        reason: 'audit_read_error',
        error: matchErr?.message ?? null,
      });
      return { ok: false, reason: 'audit_read_error' };
    }

    const snapshot = (matchRow.system_snapshot ?? null) as
      | { points_calculator: string | null; points_calculator_params: Record<string, unknown> }
      | null;

    if (!snapshot || !('points_calculator' in snapshot)) {
      logger.warn('[match-audit] no snapshot — audit skipped (legacy match)', {
        matchId,
        tag: 'match_scoring_audit_skipped',
        reason: 'audit_disabled_no_snapshot',
      });
      return { ok: false, reason: 'audit_disabled_no_snapshot' };
    }

    if (matchRow.home_to_win == null || matchRow.away_to_win == null) {
      return { ok: false, reason: 'audit_read_error' };
    }

    const { data: games, error: gamesErr } = await supabase
      .from('match_games')
      .select(
        'winner_team_id, loser_balls_pocketed, is_tiebreaker, confirmed_by_home, confirmed_by_away',
      )
      .eq('match_id', matchId);

    if (gamesErr || !games) {
      logger.warn('[match-audit] games read error — audit skipped', {
        matchId,
        tag: 'match_scoring_audit_skipped',
        reason: 'audit_read_error',
        error: gamesErr?.message ?? null,
      });
      return { ok: false, reason: 'audit_read_error' };
    }

    const expected = computeMatchRunningTotals({
      homeTeamId: matchRow.home_team_id,
      awayTeamId: matchRow.away_team_id,
      homeThresholds: {
        games_to_win: matchRow.home_to_win,
        games_to_tie: matchRow.home_to_tie,
        games_to_lose: matchRow.home_to_lose,
      },
      awayThresholds: {
        games_to_win: matchRow.away_to_win,
        games_to_tie: matchRow.away_to_tie,
        games_to_lose: matchRow.away_to_lose,
      },
      games: games as Parameters<typeof computeMatchRunningTotals>[0]['games'],
      pointsCalculator: snapshot.points_calculator ?? null,
      pointsCalculatorParams:
        (snapshot.points_calculator_params as Record<string, unknown>) ?? {},
    });

    const actual = {
      home_games_won: matchRow.home_games_won ?? 0,
      away_games_won: matchRow.away_games_won ?? 0,
      home_points_earned: matchRow.home_points_earned ?? 0,
      away_points_earned: matchRow.away_points_earned ?? 0,
    };

    const result = compareRunningTotals(actual, expected);

    if (!result.ok) {
      logger.warn(
        '[match-audit] running totals diverged from match_games recompute',
        {
          matchId,
          tag: 'match_scoring_divergence',
          calculator: snapshot.points_calculator,
          discrepancies: result.discrepancies,
          stored: actual,
          expected,
        },
      );
    }

    return result;
  } catch (err) {
    logger.warn('[match-audit] audit threw — match completion unaffected', {
      matchId,
      tag: 'match_scoring_audit_threw',
      reason: 'audit_threw',
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, reason: 'audit_threw' };
  }
}
