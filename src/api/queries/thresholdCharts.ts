/**
 * @fileoverview Threshold Charts Query Functions
 *
 * Query functions for fetching and managing threshold charts from the database.
 * Threshold charts determine games-to-win thresholds based on handicap differentials.
 *
 * Chart Types:
 * - team_points: Team format with point handicaps (exact lookup)
 * - team_percentage: Team format with percentage handicaps (range lookup)
 * - race_points: Individual race with point handicaps
 * - race_percentage: Individual race with percentage handicaps
 *
 * Entity Hierarchy:
 * - global: System templates (nil UUID)
 * - organization: Organization-wide defaults
 * - league: League-specific overrides
 */

import { supabase } from '@/supabaseClient';
import { logger } from '@/utils/logger';

// =============================================================================
// TYPES
// =============================================================================

/** Chart type determines how the chart is used and displayed */
export type ThresholdChartType =
  | 'team_points'
  | 'team_percentage'
  | 'race_points'
  | 'race_percentage';

/** Entity type for chart ownership (matches playoff_configurations pattern) */
export type ThresholdEntityType = 'global' | 'organization' | 'league';

/** Lookup mode determines how to find matching rows */
export type ThresholdLookupMode = 'exact' | 'range';

/** Threshold chart parent record */
export interface ThresholdChart {
  id: string;
  entity_type: ThresholdEntityType;
  entity_id: string;
  chart_type: ThresholdChartType;
  lookup_mode: ThresholdLookupMode;
  name: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

/** Threshold chart row (child record) */
export interface ThresholdChartRow {
  id: string;
  chart_id: string;
  comp_1: number;
  comp_2: number | null;
  result_1: number;
  result_2: number | null;
  result_3: number;
  sort_order: number;
  created_at: string;
}

/** Chart with its rows included */
export interface ThresholdChartWithRows extends ThresholdChart {
  rows: ThresholdChartRow[];
}

/** Lookup result from the lookup_threshold function */
export interface ThresholdLookupResult {
  result_1: number;
  result_2: number | null;
  result_3: number;
  was_swapped: boolean;
}

/** Input for creating a new chart */
export interface CreateThresholdChartInput {
  entity_type: ThresholdEntityType;
  entity_id: string;
  chart_type: ThresholdChartType;
  lookup_mode: ThresholdLookupMode;
  name: string;
  description?: string | null;
  is_default?: boolean;
}

/** Input for creating chart rows */
export interface CreateThresholdChartRowInput {
  chart_id: string;
  comp_1: number;
  comp_2?: number | null;
  result_1: number;
  result_2?: number | null;
  result_3: number;
  sort_order: number;
}

// =============================================================================
// QUERY FUNCTIONS
// =============================================================================

/** Nil UUID used for global entity records */
const GLOBAL_ENTITY_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Fetch all global threshold charts (system templates)
 *
 * These are read-only templates that operators can use as starting points.
 *
 * @param chartType - Optional filter by chart type
 * @returns Array of global threshold charts
 */
export async function getGlobalThresholdCharts(
  chartType?: ThresholdChartType
): Promise<ThresholdChart[]> {
  let query = supabase
    .from('threshold_charts')
    .select('*')
    .eq('entity_type', 'global')
    .eq('entity_id', GLOBAL_ENTITY_ID)
    .order('name');

  if (chartType) {
    query = query.eq('chart_type', chartType);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('Error fetching global threshold charts', { error: error.message });
    throw new Error(`Failed to fetch global threshold charts: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Fetch threshold charts for a league
 *
 * Returns charts that belong directly to the league.
 *
 * @param leagueId - League ID
 * @param chartType - Optional filter by chart type
 * @returns Array of league threshold charts
 */
export async function getLeagueThresholdCharts(
  leagueId: string,
  chartType?: ThresholdChartType
): Promise<ThresholdChart[]> {
  let query = supabase
    .from('threshold_charts')
    .select('*')
    .eq('entity_type', 'league')
    .eq('entity_id', leagueId)
    .order('name');

  if (chartType) {
    query = query.eq('chart_type', chartType);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('Error fetching league threshold charts', {
      leagueId,
      error: error.message,
    });
    throw new Error(`Failed to fetch league threshold charts: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Fetch a single threshold chart by ID with its rows
 *
 * @param chartId - Chart ID
 * @returns Chart with rows, or null if not found
 */
export async function getThresholdChartWithRows(
  chartId: string
): Promise<ThresholdChartWithRows | null> {
  // Fetch the chart
  const { data: chart, error: chartError } = await supabase
    .from('threshold_charts')
    .select('*')
    .eq('id', chartId)
    .single();

  if (chartError) {
    if (chartError.code === 'PGRST116') {
      return null; // Not found
    }
    logger.error('Error fetching threshold chart', { chartId, error: chartError.message });
    throw new Error(`Failed to fetch threshold chart: ${chartError.message}`);
  }

  // Fetch the rows
  const { data: rows, error: rowsError } = await supabase
    .from('threshold_chart_rows')
    .select('*')
    .eq('chart_id', chartId)
    .order('sort_order');

  if (rowsError) {
    logger.error('Error fetching threshold chart rows', {
      chartId,
      error: rowsError.message,
    });
    throw new Error(`Failed to fetch threshold chart rows: ${rowsError.message}`);
  }

  return {
    ...chart,
    rows: rows ?? [],
  };
}

/**
 * Fetch the default threshold chart for an entity and chart type
 *
 * Follows the hierarchy: league → organization → global
 *
 * @param entityType - 'league' or 'organization'
 * @param entityId - League or organization ID
 * @param chartType - Chart type to find
 * @param organizationId - Organization ID (for league fallback)
 * @returns Default chart with rows, or null if none found
 */
export async function getDefaultThresholdChart(
  entityType: 'league' | 'organization',
  entityId: string,
  chartType: ThresholdChartType,
  organizationId?: string
): Promise<ThresholdChartWithRows | null> {
  // Try entity-specific default first
  const { data: entityChart } = await supabase
    .from('threshold_charts')
    .select('id')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('chart_type', chartType)
    .eq('is_default', true)
    .single();

  if (entityChart) {
    return getThresholdChartWithRows(entityChart.id);
  }

  // For leagues, try organization default
  if (entityType === 'league' && organizationId) {
    const { data: orgChart } = await supabase
      .from('threshold_charts')
      .select('id')
      .eq('entity_type', 'organization')
      .eq('entity_id', organizationId)
      .eq('chart_type', chartType)
      .eq('is_default', true)
      .single();

    if (orgChart) {
      return getThresholdChartWithRows(orgChart.id);
    }
  }

  // Fall back to global default
  const { data: globalChart } = await supabase
    .from('threshold_charts')
    .select('id')
    .eq('entity_type', 'global')
    .eq('entity_id', GLOBAL_ENTITY_ID)
    .eq('chart_type', chartType)
    .eq('is_default', true)
    .single();

  if (globalChart) {
    return getThresholdChartWithRows(globalChart.id);
  }

  return null;
}

/**
 * Look up threshold values using the database function
 *
 * This handles exact/range matching and race chart normalization.
 *
 * @param chartId - Chart ID to look up in
 * @param comp1 - Primary comparison value
 * @param comp2 - Secondary comparison value (for race charts)
 * @returns Lookup result with threshold values
 */
export async function lookupThreshold(
  chartId: string,
  comp1: number,
  comp2?: number | null
): Promise<ThresholdLookupResult | null> {
  const { data, error } = await supabase.rpc('lookup_threshold', {
    p_chart_id: chartId,
    p_comp_1: comp1,
    p_comp_2: comp2 ?? null,
  });

  if (error) {
    logger.error('Error looking up threshold', {
      chartId,
      comp1,
      comp2,
      error: error.message,
    });
    throw new Error(`Failed to look up threshold: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return null;
  }

  // RPC returns an array, get the first result
  const result = data[0];
  return {
    result_1: result.result_1,
    result_2: result.result_2,
    result_3: result.result_3,
    was_swapped: result.was_swapped,
  };
}

// =============================================================================
// MUTATION FUNCTIONS
// =============================================================================

/**
 * Create a new threshold chart
 *
 * @param input - Chart creation input
 * @returns Created chart
 */
export async function createThresholdChart(
  input: CreateThresholdChartInput
): Promise<ThresholdChart> {
  const { data, error } = await supabase
    .from('threshold_charts')
    .insert({
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      chart_type: input.chart_type,
      lookup_mode: input.lookup_mode,
      name: input.name,
      description: input.description ?? null,
      is_default: input.is_default ?? false,
    })
    .select()
    .single();

  if (error) {
    logger.error('Error creating threshold chart', { input, error: error.message });
    throw new Error(`Failed to create threshold chart: ${error.message}`);
  }

  return data;
}

/**
 * Create multiple threshold chart rows
 *
 * @param rows - Array of row inputs
 * @returns Created rows
 */
export async function createThresholdChartRows(
  rows: CreateThresholdChartRowInput[]
): Promise<ThresholdChartRow[]> {
  const { data, error } = await supabase
    .from('threshold_chart_rows')
    .insert(
      rows.map((row) => ({
        chart_id: row.chart_id,
        comp_1: row.comp_1,
        comp_2: row.comp_2 ?? null,
        result_1: row.result_1,
        result_2: row.result_2 ?? null,
        result_3: row.result_3,
        sort_order: row.sort_order,
      }))
    )
    .select();

  if (error) {
    logger.error('Error creating threshold chart rows', { error: error.message });
    throw new Error(`Failed to create threshold chart rows: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Update a threshold chart
 *
 * @param chartId - Chart ID
 * @param updates - Fields to update
 * @returns Updated chart
 */
export async function updateThresholdChart(
  chartId: string,
  updates: Partial<Pick<ThresholdChart, 'name' | 'description' | 'is_default'>>
): Promise<ThresholdChart> {
  const { data, error } = await supabase
    .from('threshold_charts')
    .update(updates)
    .eq('id', chartId)
    .select()
    .single();

  if (error) {
    logger.error('Error updating threshold chart', { chartId, updates, error: error.message });
    throw new Error(`Failed to update threshold chart: ${error.message}`);
  }

  return data;
}

/**
 * Delete all rows from a chart and replace with new ones
 *
 * Used when saving chart edits - easier than tracking individual changes.
 *
 * @param chartId - Chart ID
 * @param rows - New rows to insert
 * @returns Created rows
 */
export async function replaceThresholdChartRows(
  chartId: string,
  rows: Omit<CreateThresholdChartRowInput, 'chart_id'>[]
): Promise<ThresholdChartRow[]> {
  // Delete existing rows
  const { error: deleteError } = await supabase
    .from('threshold_chart_rows')
    .delete()
    .eq('chart_id', chartId);

  if (deleteError) {
    logger.error('Error deleting threshold chart rows', {
      chartId,
      error: deleteError.message,
    });
    throw new Error(`Failed to delete threshold chart rows: ${deleteError.message}`);
  }

  // Insert new rows
  return createThresholdChartRows(rows.map((row) => ({ ...row, chart_id: chartId })));
}

/**
 * Delete a threshold chart (rows are cascade deleted)
 *
 * @param chartId - Chart ID
 */
export async function deleteThresholdChart(chartId: string): Promise<void> {
  const { error } = await supabase
    .from('threshold_charts')
    .delete()
    .eq('id', chartId);

  if (error) {
    logger.error('Error deleting threshold chart', { chartId, error: error.message });
    throw new Error(`Failed to delete threshold chart: ${error.message}`);
  }
}

/**
 * Copy a global template chart to a league
 *
 * Creates a league-specific copy of a global chart that can be customized.
 *
 * @param globalChartId - Global chart ID to copy
 * @param leagueId - Target league ID
 * @param name - Optional new name (defaults to original + " (Copy)")
 * @returns Created chart with rows
 */
export async function copyGlobalChartToLeague(
  globalChartId: string,
  leagueId: string,
  name?: string
): Promise<ThresholdChartWithRows> {
  // Fetch the source chart with rows
  const sourceChart = await getThresholdChartWithRows(globalChartId);
  if (!sourceChart) {
    throw new Error('Source chart not found');
  }

  if (sourceChart.entity_type !== 'global') {
    throw new Error('Can only copy global charts');
  }

  // Create the new chart
  const newChart = await createThresholdChart({
    entity_type: 'league',
    entity_id: leagueId,
    chart_type: sourceChart.chart_type,
    lookup_mode: sourceChart.lookup_mode,
    name: name ?? `${sourceChart.name} (Copy)`,
    description: sourceChart.description,
    is_default: false, // Don't set as default automatically
  });

  // Copy the rows
  const newRows = await createThresholdChartRows(
    sourceChart.rows.map((row) => ({
      chart_id: newChart.id,
      comp_1: row.comp_1,
      comp_2: row.comp_2,
      result_1: row.result_1,
      result_2: row.result_2,
      result_3: row.result_3,
      sort_order: row.sort_order,
    }))
  );

  return {
    ...newChart,
    rows: newRows,
  };
}
