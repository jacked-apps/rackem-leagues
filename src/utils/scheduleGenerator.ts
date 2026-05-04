/**
 * @fileoverview Schedule Generation Utility
 *
 * Generates full season schedules by mapping team positions to matchup tables
 * and creating match records for each week of the season.
 *
 * The generation process is broken down into single-responsibility functions:
 * 1. Validate teams have positions assigned
 * 2. Fetch regular season weeks from database
 * 3. Get matchup table for team count
 * 4. Build team position lookup map
 * 5. Generate match records for each week
 * 6. Insert matches in bulk to database
 */

import { supabase } from '@/supabaseClient';
import { getMatchupTable } from './matchupTables';
import { logger } from '@/utils/logger';
import type {
  MatchInsertData,
  TeamWithPosition,
} from '@/types/schedule';

interface GenerateScheduleParams {
  seasonId: string;
  teams: TeamWithPosition[];
  skipExistingCheck?: boolean;
}

interface GenerateScheduleResult {
  success: boolean;
  matchesCreated: number;
  error?: string;
}

interface SeasonWeek {
  id: string;
  scheduled_date: string;
  week_name: string;
  week_type: string;
}

/**
 * Validate that teams array is not empty and has required data
 *
 * @param teams - Array of teams with positions
 * @returns Validation result with error message if invalid
 */
function validateTeams(teams: TeamWithPosition[]): { valid: boolean; error?: string } {
  if (teams.length === 0) {
    return {
      valid: false,
      error: 'No teams provided for schedule generation',
    };
  }

  return { valid: true };
}

/**
 * Fetch regular season weeks from database
 * Note: Only fetches 'regular' type weeks for match generation
 * Blackout, playoff, and break weeks are excluded from match scheduling
 *
 * @param seasonId - Season ID to fetch weeks for
 * @returns Array of regular season weeks or error
 */
async function fetchSeasonWeeks(
  seasonId: string
): Promise<{ weeks: SeasonWeek[] | null; error?: string }> {
  const { data: seasonWeeks, error: weeksError } = await supabase
    .from('season_weeks')
    .select('id, scheduled_date, week_name, week_type')
    .eq('season_id', seasonId)
    .eq('week_type', 'regular')
    .order('scheduled_date', { ascending: true });

  if (weeksError) {
    return { weeks: null, error: weeksError.message };
  }

  if (!seasonWeeks || seasonWeeks.length === 0) {
    return {
      weeks: null,
      error: 'No regular season weeks found. Please create season weeks first.',
    };
  }

  return { weeks: seasonWeeks };
}

/**
 * Fetch playoff weeks from database
 *
 * @param seasonId - Season ID to fetch playoff weeks for
 * @returns Array of playoff weeks or empty array
 */
async function fetchPlayoffWeeks(
  seasonId: string
): Promise<{ weeks: SeasonWeek[]; error?: string }> {
  const { data: playoffWeeks, error: weeksError } = await supabase
    .from('season_weeks')
    .select('id, scheduled_date, week_name, week_type')
    .eq('season_id', seasonId)
    .eq('week_type', 'playoffs')
    .order('scheduled_date', { ascending: true });

  if (weeksError) {
    return { weeks: [], error: weeksError.message };
  }

  return { weeks: playoffWeeks || [] };
}

/**
 * Build a map of schedule positions to teams for quick lookup
 *
 * @param teams - Array of teams with positions
 * @returns Map of position number to team
 */
function buildTeamPositionMap(teams: TeamWithPosition[]): Map<number, TeamWithPosition> {
  const sortedTeams = [...teams].sort(
    (a, b) => a.schedule_position - b.schedule_position
  );

  const teamsByPosition = new Map<number, TeamWithPosition>();
  sortedTeams.forEach((team) => {
    teamsByPosition.set(team.schedule_position, team);
  });

  return teamsByPosition;
}

/**
 * Generate match records for a single week
 *
 * @param seasonWeekId - ID of the season week
 * @param weeklyMatchups - Array of matchup pairs for this week
 * @param teamsByPosition - Map of position to team
 * @param seasonId - Season ID
 * @returns Array of match insert data
 */
function generateWeekMatches(
  seasonWeekId: string,
  weeklyMatchups: [number, number][],
  teamsByPosition: Map<number, TeamWithPosition>,
  seasonId: string
): MatchInsertData[] {
  const matches: MatchInsertData[] = [];

  for (let matchIndex = 0; matchIndex < weeklyMatchups.length; matchIndex++) {
    const [homePos, awayPos] = weeklyMatchups[matchIndex];

    const homeTeam = teamsByPosition.get(homePos);
    const awayTeam = teamsByPosition.get(awayPos);

    // Skip if either position doesn't have a team (shouldn't happen with proper validation)
    if (!homeTeam || !awayTeam) {
      logger.warn('Missing team for positions in week', {
        homePosition: homePos,
        awayPosition: awayPos,
        seasonWeekId
      });
      continue;
    }

    // Bye teams are now real `teams` rows (status='bye') created upstream
    // by ScheduleSetup.tsx via createByeTeam(). Both home_team_id and
    // away_team_id are always real UUIDs — no NULLs in the matches table.
    matches.push({
      season_id: seasonId,
      season_week_id: seasonWeekId,
      home_team_id: homeTeam.id,
      away_team_id: awayTeam.id,
      scheduled_venue_id: homeTeam.home_venue_id,
      match_number: matchIndex + 1,
      status: 'scheduled',
    });
  }

  return matches;
}

/**
 * Generate all match records for the entire season
 *
 * @param seasonWeeks - Array of regular season weeks only
 * @param matchupTable - Matchup table for team count
 * @param teamsByPosition - Map of position to team
 * @param seasonId - Season ID
 * @returns Array of all match insert data
 */
function generateAllMatches(
  seasonWeeks: SeasonWeek[],
  matchupTable: [number, number][][],
  teamsByPosition: Map<number, TeamWithPosition>,
  seasonId: string
): MatchInsertData[] {
  const allMatches: MatchInsertData[] = [];
  const cycleLength = matchupTable.length;

  // Each regular week gets matches from the matchup table
  for (let weekIndex = 0; weekIndex < seasonWeeks.length; weekIndex++) {
    const seasonWeek = seasonWeeks[weekIndex];

    // Use modulo to cycle through matchup table if season is longer than one cycle
    const matchupWeekIndex = weekIndex % cycleLength;
    const weekMatchups = matchupTable[matchupWeekIndex];

    const weekMatches = generateWeekMatches(
      seasonWeek.id,
      weekMatchups,
      teamsByPosition,
      seasonId
    );

    allMatches.push(...weekMatches);
  }

  return allMatches;
}

/**
 * Insert match records into database
 *
 * @param matches - Array of match insert data
 * @returns Error message if insert fails, undefined otherwise
 */
async function insertMatches(matches: MatchInsertData[]): Promise<string | undefined> {
  const { error: insertError } = await supabase
    .from('matches')
    .insert(matches);

  if (insertError) {
    return insertError.message;
  }

  return undefined;
}

/**
 * Generate playoff placeholder matches for all playoff weeks
 *
 * These are TBD matches - home_team_id and away_team_id are null.
 * They will be populated when playoffs start based on regular season standings.
 *
 * For each playoff week, we calculate how many matches are needed:
 * - Week 1: bracketSize / 2 matches (e.g., 8 teams = 4 matches)
 * - Week 2: bracketSize / 4 matches (e.g., 8 teams = 2 matches)
 * - Week 3: bracketSize / 8 matches (e.g., 8 teams = 1 match)
 *
 * @param playoffWeeks - Array of playoff week records
 * @param seasonId - Season ID
 * @param teamCount - Total number of teams (used to calculate bracket size)
 * @returns Array of playoff match insert data (with null team IDs)
 */
function generatePlayoffPlaceholderMatches(
  playoffWeeks: SeasonWeek[],
  seasonId: string,
  teamCount: number
): MatchInsertData[] {
  const playoffMatches: MatchInsertData[] = [];

  // Calculate bracket size (must be power of 2, use largest power of 2 <= teamCount)
  // Common sizes: 4, 8, 16, etc.
  let bracketSize = 1;
  while (bracketSize * 2 <= teamCount) {
    bracketSize *= 2;
  }

  // Minimum bracket size is 4 teams (2 matches in round 1)
  bracketSize = Math.max(4, bracketSize);

  logger.info('Generating playoff placeholder matches', {
    teamCount,
    bracketSize,
    playoffWeeks: playoffWeeks.length,
  });

  // Generate matches for each playoff week
  let remainingTeams = bracketSize;

  for (let weekIndex = 0; weekIndex < playoffWeeks.length; weekIndex++) {
    const playoffWeek = playoffWeeks[weekIndex];

    // Number of matches for this round = remaining teams / 2
    const matchesThisWeek = Math.floor(remainingTeams / 2);

    if (matchesThisWeek < 1) {
      // No more matches to create (finals already done)
      break;
    }

    for (let matchNum = 0; matchNum < matchesThisWeek; matchNum++) {
      playoffMatches.push({
        season_id: seasonId,
        season_week_id: playoffWeek.id,
        home_team_id: null, // TBD - determined by standings
        away_team_id: null, // TBD - determined by standings
        scheduled_venue_id: null, // TBD - home team's venue after seeding
        match_number: matchNum + 1,
        status: 'scheduled',
      });
    }

    // Winners advance, so half the teams remain for next round
    remainingTeams = matchesThisWeek;
  }

  logger.info('Generated playoff placeholder matches', {
    totalPlayoffMatches: playoffMatches.length,
  });

  return playoffMatches;
}

/**
 * Generate full season schedule based on team positions
 *
 * This is the main orchestration function that coordinates the schedule generation process.
 * It delegates to smaller single-responsibility functions for each step:
 *
 * 1. Validate teams have positions assigned (validateTeams)
 * 2. Fetch all regular season weeks from database (fetchSeasonWeeks)
 * 3. Get matchup table for team count (getMatchupTable)
 * 4. Build team position lookup map (buildTeamPositionMap)
 * 5. Generate regular season match records (generateAllMatches)
 * 6. Fetch playoff weeks and generate placeholder matches (fetchPlayoffWeeks, generatePlayoffPlaceholderMatches)
 * 7. Insert all matches in bulk to database (insertMatches)
 *
 * Playoff matches are created as TBD placeholders with null team IDs.
 * They will be populated when playoffs start based on regular season standings.
 *
 * @param params - Season ID and teams with assigned positions
 * @returns Result indicating success and number of matches created
 *
 * @example
 * const result = await generateSchedule({
 *   seasonId: 'season-123',
 *   teams: [
 *     { id: 'team-1', schedule_position: 1, home_venue_id: 'venue-1' },
 *     { id: 'team-2', schedule_position: 2, home_venue_id: 'venue-2' },
 *     // ...
 *   ]
 * });
 */
export async function generateSchedule({
  seasonId,
  teams,
  skipExistingCheck = false,
}: GenerateScheduleParams): Promise<GenerateScheduleResult> {
  try {
    // Step 0: Check if schedule already exists (unless skip flag is set)
    if (!skipExistingCheck) {
      const { count: existingMatches, error: countError } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('season_id', seasonId);

      if (countError) {
        return {
          success: false,
          matchesCreated: 0,
          error: `Error checking for existing schedule: ${countError.message}`,
        };
      }

      if (existingMatches && existingMatches > 0) {
        return {
          success: false,
          matchesCreated: 0,
          error: `Schedule already exists with ${existingMatches} matches. Delete the existing schedule before regenerating.`,
        };
      }
    }

    // Step 1: Validate teams
    const validation = validateTeams(teams);
    if (!validation.valid) {
      return {
        success: false,
        matchesCreated: 0,
        error: validation.error,
      };
    }

    // Step 2: Fetch regular season weeks
    const { weeks: seasonWeeks, error: weeksError } = await fetchSeasonWeeks(seasonId);
    if (weeksError || !seasonWeeks) {
      return {
        success: false,
        matchesCreated: 0,
        error: weeksError,
      };
    }

    // Step 3: Get matchup table for team count
    const matchupTable = getMatchupTable(teams.length);
    if (!matchupTable) {
      return {
        success: false,
        matchesCreated: 0,
        error: `No matchup table available for ${teams.length} teams`,
      };
    }

    // Step 4: Build team position lookup map
    const teamsByPosition = buildTeamPositionMap(teams);

    // Step 5: Generate all regular season match records
    const regularMatches = generateAllMatches(
      seasonWeeks,
      matchupTable,
      teamsByPosition,
      seasonId
    );

    // Step 6: Fetch playoff weeks and generate placeholder matches
    const { weeks: playoffWeeks } = await fetchPlayoffWeeks(seasonId);
    let playoffMatches: MatchInsertData[] = [];

    if (playoffWeeks.length > 0) {
      playoffMatches = generatePlayoffPlaceholderMatches(
        playoffWeeks,
        seasonId,
        teams.length
      );
    }

    // Step 7: Combine regular and playoff matches
    const allMatches = [...regularMatches, ...playoffMatches];

    // Step 8: Insert all matches in bulk
    const insertError = await insertMatches(allMatches);
    if (insertError) {
      return {
        success: false,
        matchesCreated: 0,
        error: insertError,
      };
    }

    // Step 9: Assign table numbers for all weeks
    // This assigns tables based on venue availability and fill order
    const { error: tableAssignError } = await supabase.rpc('assign_tables_for_season', {
      p_season_id: seasonId,
    });

    if (tableAssignError) {
      // Log but don't fail - table assignment can be retried later
      logger.warn('Table assignment failed (non-critical)', {
        error: tableAssignError.message,
        seasonId,
      });
    } else {
      logger.info('Table assignment completed for season', { seasonId });
    }

    logger.info('Schedule generated successfully', {
      regularMatches: regularMatches.length,
      playoffMatches: playoffMatches.length,
      totalMatches: allMatches.length,
    });

    return {
      success: true,
      matchesCreated: allMatches.length,
    };
  } catch (error) {
    logger.error('Error generating schedule', { error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      matchesCreated: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete all matches for a season
 * Use this to clear a schedule before regenerating
 *
 * @param seasonId - Season ID to clear matches for
 * @returns Result indicating success and number of matches deleted
 */
export async function clearSchedule(seasonId: string): Promise<{
  success: boolean;
  matchesDeleted: number;
  error?: string;
}> {
  try {
    // Count matches before deleting
    const { count, error: countError } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('season_id', seasonId);

    if (countError) throw countError;

    const matchCount = count || 0;

    // Delete all matches for this season
    const { error: deleteError } = await supabase
      .from('matches')
      .delete()
      .eq('season_id', seasonId);

    if (deleteError) throw deleteError;

    return {
      success: true,
      matchesDeleted: matchCount,
    };
  } catch (error) {
    logger.error('Error clearing schedule', { error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      matchesDeleted: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Shuffle array using Fisher-Yates algorithm
 * Used for random team position assignment
 *
 * @param array - Array to shuffle
 * @returns New shuffled array
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Assign random schedule positions to teams
 *
 * @param teams - Array of teams
 * @returns Teams with randomly assigned positions
 */
export function assignRandomPositions<T extends { id: string }>(
  teams: T[]
): (T & { schedule_position: number })[] {
  const shuffled = shuffleArray(teams);
  return shuffled.map((team, index) => ({
    ...team,
    schedule_position: index + 1,
  }));
}
