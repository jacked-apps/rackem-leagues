/**
 * @fileoverview Playoff Generation Utility
 *
 * Generates playoff brackets by seeding teams from regular season standings.
 * The bracket pairs top seeds with bottom seeds (1v8, 2v7, 3v6, 4v5).
 *
 * For odd team counts, the last place team is excluded and the bracket
 * uses the next lower even number of teams.
 *
 * Example with 7 teams:
 * - Team 7 is excluded (last place, no game)
 * - Bracket is 6 teams: 1v6, 2v5, 3v4
 */

import { supabase } from '@/supabaseClient';
import { fetchSeasonStandings, type TeamStanding } from '@/api/queries/standings';
import { sortStandings } from '@/utils/standings/sortStandings';
import { logger } from '@/utils/logger';
import type { MatchupStyle } from '@/hooks/playoff/usePlayoffSettingsReducer';
import type {
  SeededTeam,
  PlayoffMatchup,
  ExcludedTeam,
  PlayoffBracket,
  GeneratePlayoffResult,
  CreatePlayoffMatchesResult,
} from '@/types/playoff';
import type { MatchInsertData } from '@/types/schedule';

/**
 * Sort standings by ranking criteria.
 *
 * Delegates to the shared helper at `src/utils/standings/sortStandings.ts`
 * (Phase 5 Unit 5.3). The default priority is `[match_wins, games_won,
 * points_earned]` — same as before this refactor. A future PR will pass
 * the league's resolved `standings_sort` priority instead of using the
 * default.
 *
 * @param standings - Array of team standings
 * @returns Sorted array (best team first)
 */
function sortStandingsByRank(standings: TeamStanding[]): TeamStanding[] {
  return sortStandings(standings);
}

/**
 * Convert standings to seeded teams
 *
 * @param standings - Sorted standings (best team first)
 * @returns Array of seeded teams with seed numbers
 */
function standingsToSeededTeams(standings: TeamStanding[]): SeededTeam[] {
  return standings.map((standing, index) => ({
    seed: index + 1,
    teamId: standing.teamId,
    teamName: standing.teamName,
    matchWins: standing.matchWins,
    matchLosses: standing.matchLosses,
    points: standing.points,
    gamesWon: standing.gamesWon,
  }));
}

/**
 * Generate the REAL playoff seed-pairing for a given matchup style.
 *
 * Honors the configured place-based pairing rule (set in the season-creation
 * wizard / playoff config) so the actual playoff matches fill in the way the LO
 * set up — instead of always using seeded. Returns `[homeSeed, awaySeed]` pairs
 * over an EVEN bracket size (seeds `1..bracketSize`).
 *
 * Unlike `generateMatchupPairs` (a PREVIEW helper that returns placeholder /
 * encoded pairs for random/bracket), this returns real, usable seed pairs that
 * drive the actual playoff matches.
 *
 * - `'seeded'` → 1 vs last, 2 vs 2nd-last, … (rewards regular-season finish)
 * - `'ranked'` → adjacent: 1v2, 3v4, …
 * - `'random'` → fair shuffle, then pair (resolved ONCE here, at populate time;
 *   a populated bracket never re-shuffles)
 * - `'bracket'` / unknown / undefined → falls back to `'seeded'` (never throws).
 *   (`'bracket'` is a multi-week progression style, out of scope for the initial
 *   single-week fill-in.)
 *
 * @param bracketSize - Even number of teams in the bracket
 * @param style - Configured matchup style (optional; defaults to seeded)
 * @returns Array of `[homeSeed, awaySeed]` pairs (lower seed number = home)
 */
export function realPairsForStyle(
  bracketSize: number,
  style?: MatchupStyle
): [number, number][] {
  if (bracketSize < 2 || bracketSize % 2 !== 0) {
    return [];
  }

  const half = bracketSize / 2;

  switch (style) {
    case 'ranked':
      // Adjacent pairs: 1v2, 3v4, … (lower seed number is home)
      return Array.from({ length: half }, (_, i) => [i * 2 + 1, i * 2 + 2]);

    case 'random': {
      // Fair Fisher-Yates shuffle of seeds 1..bracketSize, then pair
      // consecutively. Resolved once here (at populate time).
      const seeds = Array.from({ length: bracketSize }, (_, i) => i + 1);
      for (let i = seeds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [seeds[i], seeds[j]] = [seeds[j], seeds[i]];
      }
      const pairs: [number, number][] = [];
      for (let i = 0; i < bracketSize; i += 2) {
        const a = seeds[i];
        const b = seeds[i + 1];
        // Lower seed number is home for a stable home/away convention.
        pairs.push(a < b ? [a, b] : [b, a]);
      }
      return pairs;
    }

    case 'seeded':
    case 'bracket':
    default:
      // Seeded (1 vs last, …) is the default and the safe fallback for
      // 'bracket'/unknown/undefined — never throws.
      return Array.from({ length: half }, (_, i) => [i + 1, bracketSize - i]);
  }
}

/**
 * Generate full playoff bracket from standings
 *
 * @param seasonId - Season ID to generate playoffs for
 * @param playoffWeekId - Season week ID for playoff week
 * @returns Playoff bracket with matchups and seeding
 */
export async function generatePlayoffBracket(
  seasonId: string,
  playoffWeekId: string,
  style?: MatchupStyle
): Promise<GeneratePlayoffResult> {
  try {
    // Fetch standings for the season
    const standings = await fetchSeasonStandings(seasonId);

    if (standings.length < 2) {
      return {
        success: false,
        error: 'Not enough teams with completed matches for playoffs (minimum 2 required)',
      };
    }

    // Sort by ranking criteria
    const sortedStandings = sortStandingsByRank(standings);

    // Convert to seeded teams
    const seededTeams = standingsToSeededTeams(sortedStandings);

    const teamCount = seededTeams.length;
    const bracketSize = teamCount % 2 === 0 ? teamCount : teamCount - 1;

    // Determine excluded teams (for odd counts)
    const excludedTeams: ExcludedTeam[] = [];
    if (teamCount !== bracketSize) {
      const lastTeam = seededTeams[seededTeams.length - 1];
      excludedTeams.push({
        seed: lastTeam.seed,
        teamId: lastTeam.teamId,
        teamName: lastTeam.teamName,
        reason: 'last_place',
      });
    }

    // Generate matchup pairs honoring the configured place-based style
    // (defaults to seeded; 'bracket'/unknown fall back to seeded).
    const pairs = realPairsForStyle(bracketSize, style);

    // Create matchup objects with full team data
    const matchups: PlayoffMatchup[] = pairs.map((pair, index) => {
      const [homeSeed, awaySeed] = pair;
      const homeTeam = seededTeams.find(t => t.seed === homeSeed)!;
      const awayTeam = seededTeams.find(t => t.seed === awaySeed)!;

      return {
        matchNumber: index + 1,
        homeSeed,
        awaySeed,
        homeTeam,
        awayTeam,
      };
    });

    const bracket: PlayoffBracket = {
      seasonId,
      playoffWeekId,
      teamCount,
      bracketSize,
      matchups,
      excludedTeams,
      seededTeams,
    };

    return {
      success: true,
      bracket,
    };
  } catch (error) {
    logger.error('Error generating playoff bracket', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error generating bracket',
    };
  }
}

/**
 * Get the playoff week for a season
 *
 * @param seasonId - Season ID
 * @returns Playoff week data or null if not found
 */
export async function getPlayoffWeek(
  seasonId: string
): Promise<{ id: string; scheduled_date: string; week_name: string } | null> {
  // .maybeSingle() returns null instead of throwing PostgREST 406 when
  // no row matches. Used to be .single() which logged a warn-level
  // "No playoff week found" on every league-detail load for any
  // season that doesn't have its playoff week scheduled yet — which
  // is the COMMON case (new leagues haven't generated playoffs).
  const { data, error } = await supabase
    .from('season_weeks')
    .select('id, scheduled_date, week_name')
    .eq('season_id', seasonId)
    .eq('week_type', 'playoffs')
    .maybeSingle();

  if (error) {
    // Real DB error (auth, network) — keep the warn so it's visible.
    logger.warn('Playoff week lookup error', { seasonId, error: error.message });
    return null;
  }

  // No playoff week scheduled yet is the common case for new leagues —
  // return null silently instead of warning.
  return data;
}

/**
 * Check if all regular season matches are completed
 *
 * @param seasonId - Season ID to check
 * @returns Object with completion status and counts
 */
export async function checkRegularSeasonComplete(seasonId: string): Promise<{
  isComplete: boolean;
  totalMatches: number;
  completedMatches: number;
  remainingMatches: number;
}> {
  // Get all regular season matches (exclude playoff matches)
  const { data: seasonWeeks } = await supabase
    .from('season_weeks')
    .select('id')
    .eq('season_id', seasonId)
    .eq('week_type', 'regular');

  if (!seasonWeeks || seasonWeeks.length === 0) {
    return {
      isComplete: false,
      totalMatches: 0,
      completedMatches: 0,
      remainingMatches: 0,
    };
  }

  const weekIds = seasonWeeks.map(w => w.id);

  // Count total and completed matches
  const { count: totalCount } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .eq('season_id', seasonId)
    .in('season_week_id', weekIds);

  const { count: completedCount } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .eq('season_id', seasonId)
    .eq('status', 'completed')
    .in('season_week_id', weekIds);

  const total = totalCount || 0;
  const completed = completedCount || 0;

  return {
    isComplete: total > 0 && completed === total,
    totalMatches: total,
    completedMatches: completed,
    remainingMatches: total - completed,
  };
}

/**
 * Create playoff matches in the database
 *
 * Takes a playoff bracket and creates actual match records
 * for the playoff week.
 *
 * @param bracket - Generated playoff bracket
 * @returns Result with count of matches created
 */
export async function createPlayoffMatches(
  bracket: PlayoffBracket
): Promise<CreatePlayoffMatchesResult> {
  try {
    // First, check if playoff matches already exist for this week
    const { count: existingCount } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('season_week_id', bracket.playoffWeekId);

    if (existingCount && existingCount > 0) {
      return {
        success: false,
        matchesCreated: 0,
        error: `Playoff matches already exist for this week (${existingCount} matches). Clear them first if you want to regenerate.`,
      };
    }

    // Get home venue for each team (higher seed is home team)
    const teamIds = bracket.matchups.flatMap(m => [m.homeTeam.teamId, m.awayTeam.teamId]);
    const { data: teams } = await supabase
      .from('teams')
      .select('id, home_venue_id')
      .in('id', teamIds);

    const teamVenues = new Map<string, string | null>();
    teams?.forEach(t => teamVenues.set(t.id, t.home_venue_id));

    // Create match records
    const matches: MatchInsertData[] = bracket.matchups.map(matchup => ({
      season_id: bracket.seasonId,
      season_week_id: bracket.playoffWeekId,
      home_team_id: matchup.homeTeam.teamId,
      away_team_id: matchup.awayTeam.teamId,
      scheduled_venue_id: teamVenues.get(matchup.homeTeam.teamId) || null,
      match_number: matchup.matchNumber,
      status: 'scheduled' as const,
    }));

    const { error: insertError } = await supabase
      .from('matches')
      .insert(matches);

    if (insertError) {
      return {
        success: false,
        matchesCreated: 0,
        error: insertError.message,
      };
    }

    return {
      success: true,
      matchesCreated: matches.length,
    };
  } catch (error) {
    logger.error('Error creating playoff matches', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      matchesCreated: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Populate existing placeholder playoff matches with team data
 *
 * Instead of inserting new matches, this function UPDATES the existing
 * placeholder matches that were created during schedule generation.
 * Placeholder matches have null home_team_id and away_team_id.
 *
 * The function:
 * 1. Fetches existing placeholder matches for the playoff week (ordered by match_number)
 * 2. Uses the bracket's matchups (with seeding order) to assign teams
 * 3. Updates each placeholder with the correct team IDs and venue
 *
 * @param bracket - Generated playoff bracket with matchups
 * @returns Result with count of matches populated
 *
 * @example
 * ```typescript
 * const result = await populatePlayoffMatches(bracket);
 * if (result.success) {
 *   console.log(`Populated ${result.matchesPopulated} playoff matches`);
 * }
 * ```
 */
export async function populatePlayoffMatches(
  bracket: PlayoffBracket
): Promise<{ success: boolean; matchesPopulated: number; error?: string }> {
  try {
    // Fetch existing placeholder matches for this playoff week
    // These are matches with null team IDs, ordered by match_number
    const { data: placeholderMatches, error: fetchError } = await supabase
      .from('matches')
      .select('id, match_number')
      .eq('season_week_id', bracket.playoffWeekId)
      .is('home_team_id', null)
      .is('away_team_id', null)
      .order('match_number', { ascending: true });

    if (fetchError) {
      return {
        success: false,
        matchesPopulated: 0,
        error: `Failed to fetch placeholder matches: ${fetchError.message}`,
      };
    }

    if (!placeholderMatches || placeholderMatches.length === 0) {
      return {
        success: false,
        matchesPopulated: 0,
        error: 'No placeholder matches found for this playoff week. The schedule may not have been generated correctly.',
      };
    }

    // Verify we have enough placeholders for the bracket
    if (placeholderMatches.length < bracket.matchups.length) {
      return {
        success: false,
        matchesPopulated: 0,
        error: `Not enough placeholder matches (${placeholderMatches.length}) for bracket size (${bracket.matchups.length} matchups).`,
      };
    }

    // Get home venue for each team (higher seed is home team)
    const teamIds = bracket.matchups.flatMap(m => [m.homeTeam.teamId, m.awayTeam.teamId]);
    const { data: teams } = await supabase
      .from('teams')
      .select('id, home_venue_id')
      .in('id', teamIds);

    const teamVenues = new Map<string, string | null>();
    teams?.forEach(t => teamVenues.set(t.id, t.home_venue_id));

    // Update each placeholder match with the bracket matchup data
    // Match placeholders by index (both are ordered by match_number)
    let updatedCount = 0;

    for (let i = 0; i < bracket.matchups.length; i++) {
      const matchup = bracket.matchups[i];
      const placeholder = placeholderMatches[i];

      const { error: updateError } = await supabase
        .from('matches')
        .update({
          home_team_id: matchup.homeTeam.teamId,
          away_team_id: matchup.awayTeam.teamId,
          scheduled_venue_id: teamVenues.get(matchup.homeTeam.teamId) || null,
        })
        .eq('id', placeholder.id);

      if (updateError) {
        logger.error('Failed to update playoff match', {
          matchId: placeholder.id,
          error: updateError.message,
        });
        // Continue with other matches even if one fails
      } else {
        updatedCount++;
      }
    }

    if (updatedCount === 0) {
      return {
        success: false,
        matchesPopulated: 0,
        error: 'Failed to update any playoff matches.',
      };
    }

    return {
      success: true,
      matchesPopulated: updatedCount,
    };
  } catch (error) {
    logger.error('Error populating playoff matches', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      matchesPopulated: 0,
      error: error instanceof Error ? error.message : 'Unknown error populating playoff matches',
    };
  }
}

/**
 * Clear existing playoff matches for a season
 *
 * @param seasonId - Season ID
 * @param playoffWeekId - Playoff week ID
 * @returns Result with count of matches deleted
 */
export async function clearPlayoffMatches(
  seasonId: string,
  playoffWeekId: string
): Promise<{ success: boolean; matchesDeleted: number; error?: string }> {
  try {
    const { count } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('season_id', seasonId)
      .eq('season_week_id', playoffWeekId);

    const { error: deleteError } = await supabase
      .from('matches')
      .delete()
      .eq('season_id', seasonId)
      .eq('season_week_id', playoffWeekId);

    if (deleteError) {
      return {
        success: false,
        matchesDeleted: 0,
        error: deleteError.message,
      };
    }

    return {
      success: true,
      matchesDeleted: count || 0,
    };
  } catch (error) {
    return {
      success: false,
      matchesDeleted: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Whether the playoff week's matchups have actually been populated with teams.
 *
 * The trustworthy "matchups set" signal. Playoff matches are created as empty
 * placeholder rows (null team IDs) at schedule-generation time, so a raw row
 * count is `> 0` for the entire season and is NOT a reliable signal (this is the
 * bug that made the dashboard card say "Bracket created" all season). This checks
 * the real condition: at least one match on the playoff week has a non-null
 * `home_team_id` — i.e. teams have been filled in.
 *
 * Mirrors the inverse of `populatePlayoffMatches`'s placeholder filter
 * (`.is('home_team_id', null)`).
 *
 * @param playoffWeekId - The `season_week` id of the playoffs week
 * @returns true if matchups are populated; false (never throws) on error/empty
 */
export async function arePlayoffMatchupsPopulated(
  playoffWeekId: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .eq('season_week_id', playoffWeekId)
    .not('home_team_id', 'is', null);

  if (error) {
    logger.warn('arePlayoffMatchupsPopulated lookup error', {
      playoffWeekId,
      error: error.message,
    });
    return false;
  }

  return (count || 0) > 0;
}

/**
 * Reset (un-populate) the playoff week's matchups WITHOUT deleting the rows.
 *
 * Nulls the team IDs (and venue) on the playoff-week matches so the placeholder
 * rows survive and `populatePlayoffMatches` can re-fill them. This is the safe
 * "reset matchups" unlock path.
 *
 * Do NOT use `clearPlayoffMatches` to unlock — it DELETEs the rows, and then
 * `populatePlayoffMatches` (which UPDATEs existing placeholders) fails with
 * "No placeholder matches found", breaking the reset → re-populate loop.
 *
 * @param seasonId - Season ID
 * @param playoffWeekId - Playoff week ID
 * @returns Result with count of matches reset
 */
export async function resetPlayoffMatchups(
  seasonId: string,
  playoffWeekId: string
): Promise<{ success: boolean; matchesReset: number; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('matches')
      .update({
        home_team_id: null,
        away_team_id: null,
        scheduled_venue_id: null,
      })
      .eq('season_id', seasonId)
      .eq('season_week_id', playoffWeekId)
      .select('id');

    if (error) {
      return { success: false, matchesReset: 0, error: error.message };
    }

    return { success: true, matchesReset: data?.length ?? 0 };
  } catch (error) {
    return {
      success: false,
      matchesReset: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
