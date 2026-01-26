/**
 * @fileoverview League Format Settings Query Functions
 *
 * Query functions for fetching and managing per-league format configuration.
 * This includes lineup size, handicap type, threshold chart references, and game settings.
 *
 * The league_format_settings table acts as the central place for all league-specific
 * format configuration, linking leagues to shared threshold charts.
 *
 * Key Relationships:
 * - One league_format_settings per league (one-to-one)
 * - Multiple leagues can reference the same threshold_chart (many-to-one)
 *
 * @example
 * // Fetch settings for a league
 * const settings = await getLeagueFormatSettings(leagueId);
 *
 * // Create settings with default charts
 * const newSettings = await createLeagueFormatSettings({
 *   league_id: leagueId,
 *   lineup_size: 3,
 *   handicap_type: 'points',
 * });
 */

import { supabase } from '@/supabaseClient';
import { logger } from '@/utils/logger';

// =============================================================================
// TYPES
// =============================================================================

/** Handicap type determines the handicap calculation system */
export type HandicapType = 'points' | 'percentage' | 'skill_level' | 'none';

/** Game generation method determines how match games are created */
export type GameGeneration = 'double_round_robin' | 'single_round_robin' | 'sets' | 'manual';

/** Points system determines how team points are calculated */
export type PointsSystem = 'differential' | 'bca_tiered' | 'per_game' | 'manual';

/**
 * League format settings record from the database
 */
export interface LeagueFormatSettings {
  id: string;
  league_id: string;

  // Team/Lineup Structure
  lineup_size: number;
  max_roster_size: number;

  // Handicap Configuration
  handicap_type: HandicapType;

  // Threshold Chart Reference (nullable FK)
  // NULL means use the global default for the handicap_type
  threshold_chart_id: string | null;

  // Game Generation
  game_generation: GameGeneration;
  estimated_games: number;
  games_per_set: number | null;

  // Points System
  points_system: PointsSystem;

  // Game Rules
  golden_break_enabled: boolean;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Settings with related chart name (for display purposes)
 */
export interface LeagueFormatSettingsWithChart extends LeagueFormatSettings {
  threshold_chart_name: string | null;
}

/**
 * Input for creating league format settings
 */
export interface CreateLeagueFormatSettingsInput {
  league_id: string;
  lineup_size?: number;
  max_roster_size?: number;
  handicap_type?: HandicapType;
  threshold_chart_id?: string | null;
  game_generation?: GameGeneration;
  estimated_games?: number;
  games_per_set?: number | null;
  points_system?: PointsSystem;
  golden_break_enabled?: boolean;
}

/**
 * Input for updating league format settings
 */
export interface UpdateLeagueFormatSettingsInput {
  lineup_size?: number;
  max_roster_size?: number;
  handicap_type?: HandicapType;
  threshold_chart_id?: string | null;
  game_generation?: GameGeneration;
  estimated_games?: number;
  games_per_set?: number | null;
  points_system?: PointsSystem;
  golden_break_enabled?: boolean;
}

// =============================================================================
// QUERY FUNCTIONS
// =============================================================================

/**
 * Fetch league format settings by league ID
 *
 * @param leagueId - League ID
 * @returns Settings record or null if not found
 *
 * @example
 * const settings = await getLeagueFormatSettings(leagueId);
 * if (settings) {
 *   console.log(`League uses ${settings.handicap_type} handicaps`);
 * }
 */
export async function getLeagueFormatSettings(
  leagueId: string
): Promise<LeagueFormatSettings | null> {
  const { data, error } = await supabase
    .from('league_format_settings')
    .select('*')
    .eq('league_id', leagueId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned - settings don't exist yet
      return null;
    }
    logger.error('Error fetching league format settings', { leagueId, error: error.message });
    throw new Error(`Failed to fetch league format settings: ${error.message}`);
  }

  return data;
}

/**
 * Fetch league format settings with chart name for display
 *
 * @param leagueId - League ID
 * @returns Settings with chart name or null
 */
export async function getLeagueFormatSettingsWithChart(
  leagueId: string
): Promise<LeagueFormatSettingsWithChart | null> {
  const { data, error } = await supabase
    .from('league_format_settings')
    .select(
      `
      *,
      chart:threshold_charts!threshold_chart_id(name)
    `
    )
    .eq('league_id', leagueId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    logger.error('Error fetching league format settings with chart', {
      leagueId,
      error: error.message,
    });
    throw new Error(`Failed to fetch league format settings: ${error.message}`);
  }

  // Transform the response to flatten chart name
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawData = data as any;
  return {
    ...rawData,
    threshold_chart_name: rawData.chart?.name ?? null,
    chart: undefined,
  };
}

/**
 * Get or create league format settings using the database function
 *
 * This function returns existing settings or creates default settings based on
 * the league's team_format column.
 *
 * @param leagueId - League ID
 * @returns Settings record (never null - creates if needed)
 *
 * @example
 * // Always returns settings, creating defaults if needed
 * const settings = await getOrCreateLeagueFormatSettings(leagueId);
 */
export async function getOrCreateLeagueFormatSettings(
  leagueId: string
): Promise<LeagueFormatSettings> {
  const { data, error } = await supabase.rpc('get_or_create_league_format_settings', {
    p_league_id: leagueId,
  });

  if (error) {
    logger.error('Error getting/creating league format settings', {
      leagueId,
      error: error.message,
    });
    throw new Error(`Failed to get/create league format settings: ${error.message}`);
  }

  // RPC returns a single record (not an array)
  return data as LeagueFormatSettings;
}

// =============================================================================
// MUTATION FUNCTIONS
// =============================================================================

/**
 * Create league format settings
 *
 * @param input - Settings to create
 * @returns Created settings
 *
 * @example
 * const settings = await createLeagueFormatSettings({
 *   league_id: leagueId,
 *   lineup_size: 5,
 *   handicap_type: 'percentage',
 *   game_generation: 'single_round_robin',
 *   total_games: 25,
 * });
 */
export async function createLeagueFormatSettings(
  input: CreateLeagueFormatSettingsInput
): Promise<LeagueFormatSettings> {
  const { data, error } = await supabase
    .from('league_format_settings')
    .insert({
      league_id: input.league_id,
      lineup_size: input.lineup_size ?? 3,
      max_roster_size: input.max_roster_size ?? 8,
      handicap_type: input.handicap_type ?? 'points',
      threshold_chart_id: input.threshold_chart_id ?? null,
      game_generation: input.game_generation ?? 'double_round_robin',
      estimated_games: input.estimated_games ?? 18,
      games_per_set: input.games_per_set ?? null,
      points_system: input.points_system ?? 'differential',
      golden_break_enabled: input.golden_break_enabled ?? true,
    })
    .select()
    .single();

  if (error) {
    logger.error('Error creating league format settings', { input, error: error.message });
    throw new Error(`Failed to create league format settings: ${error.message}`);
  }

  return data;
}

/**
 * Update league format settings
 *
 * @param leagueId - League ID (settings are unique per league)
 * @param updates - Fields to update
 * @returns Updated settings
 *
 * @example
 * const updated = await updateLeagueFormatSettings(leagueId, {
 *   team_threshold_chart_id: newChartId,
 *   total_games: 20,
 * });
 */
export async function updateLeagueFormatSettings(
  leagueId: string,
  updates: UpdateLeagueFormatSettingsInput
): Promise<LeagueFormatSettings> {
  const { data, error } = await supabase
    .from('league_format_settings')
    .update(updates)
    .eq('league_id', leagueId)
    .select()
    .single();

  if (error) {
    logger.error('Error updating league format settings', { leagueId, updates, error: error.message });
    throw new Error(`Failed to update league format settings: ${error.message}`);
  }

  return data;
}

/**
 * Upsert league format settings
 *
 * Creates settings if they don't exist, or updates if they do.
 *
 * @param input - Full settings input (must include league_id)
 * @returns Upserted settings
 */
export async function upsertLeagueFormatSettings(
  input: CreateLeagueFormatSettingsInput
): Promise<LeagueFormatSettings> {
  const { data, error } = await supabase
    .from('league_format_settings')
    .upsert(
      {
        league_id: input.league_id,
        lineup_size: input.lineup_size ?? 3,
        max_roster_size: input.max_roster_size ?? 8,
        handicap_type: input.handicap_type ?? 'points',
        threshold_chart_id: input.threshold_chart_id ?? null,
        game_generation: input.game_generation ?? 'double_round_robin',
        estimated_games: input.estimated_games ?? 18,
        games_per_set: input.games_per_set ?? null,
        points_system: input.points_system ?? 'differential',
        golden_break_enabled: input.golden_break_enabled ?? true,
      },
      { onConflict: 'league_id' }
    )
    .select()
    .single();

  if (error) {
    logger.error('Error upserting league format settings', { input, error: error.message });
    throw new Error(`Failed to upsert league format settings: ${error.message}`);
  }

  return data;
}

/**
 * Delete league format settings
 *
 * Note: Settings are typically cascade deleted when a league is deleted.
 * This function is provided for manual cleanup if needed.
 *
 * @param leagueId - League ID
 */
export async function deleteLeagueFormatSettings(leagueId: string): Promise<void> {
  const { error } = await supabase
    .from('league_format_settings')
    .delete()
    .eq('league_id', leagueId);

  if (error) {
    logger.error('Error deleting league format settings', { leagueId, error: error.message });
    throw new Error(`Failed to delete league format settings: ${error.message}`);
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Calculate estimated games for a given lineup size and game generation method
 *
 * Note: This is an estimate. Actual games may vary:
 * - Team matches with ties may add tiebreaker games
 * - Race formats vary based on how quickly players reach their win threshold
 *
 * @param lineupSize - Number of players per team
 * @param gameGeneration - How games are generated
 * @returns Estimated number of games
 *
 * @example
 * calculateEstimatedGames(3, 'double_round_robin'); // 18 (3×3×2)
 * calculateEstimatedGames(5, 'single_round_robin'); // 25 (5×5)
 */
export function calculateEstimatedGames(
  lineupSize: number,
  gameGeneration: GameGeneration
): number {
  switch (gameGeneration) {
    case 'double_round_robin':
      return lineupSize * lineupSize * 2;
    case 'single_round_robin':
      return lineupSize * lineupSize;
    case 'sets':
      // For sets, estimate depends on games_per_set (not calculable here)
      return lineupSize;
    case 'manual':
      // No auto-calculation for manual
      return lineupSize;
    default:
      return lineupSize * lineupSize;
  }
}

/**
 * Get the default chart type for a handicap type
 *
 * @param handicapType - Handicap type
 * @returns Corresponding threshold chart type
 */
export function getChartTypeForHandicapType(
  handicapType: HandicapType
): 'team_points' | 'team_percentage' | null {
  switch (handicapType) {
    case 'points':
      return 'team_points';
    case 'percentage':
      return 'team_percentage';
    case 'skill_level':
      // Skill level typically uses points-style charts
      return 'team_points';
    case 'none':
      return null;
    default:
      return 'team_points';
  }
}
