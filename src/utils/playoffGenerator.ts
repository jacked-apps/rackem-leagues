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
 * Generate playoff matchup pairs based on team count
 *
 * Pairs top seeds with bottom seeds:
 * - 4 teams: [[1,4], [2,3]]
 * - 6 teams: [[1,6], [2,5], [3,4]]
 * - 8 teams: [[1,8], [2,7], [3,6], [4,5]]
 *
 * For odd team counts, uses next lower even number.
 *
 * @param teamCount - Total number of teams
 * @returns Array of [homeSeed, awaySeed] pairs
 */
export function generatePlayoffPairs(teamCount: number): [number, number][] {
  // For odd teams, use one less (last place sits out)
  const bracketSize = teamCount % 2 === 0 ? teamCount : teamCount - 1;
  const pairs: [number, number][] = [];

  // Pair 1 with last, 2 with second-to-last, etc.
  for (let i = 1; i <= bracketSize / 2; i++) {
    pairs.push([i, bracketSize - i + 1]);
  }

  return pairs;
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
  playoffWeekId: string
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

    // Generate matchup pairs
    const pairs = generatePlayoffPairs(teamCount);

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
