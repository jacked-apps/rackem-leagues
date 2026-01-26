/**
 * @fileoverview Threshold Charts Hooks (TanStack Query)
 *
 * React hooks for fetching and managing threshold charts with automatic caching.
 * Uses TanStack Query for state management and caching.
 *
 * Threshold charts determine games-to-win thresholds based on handicap differentials.
 * Charts can be global templates, organization defaults, or league-specific.
 *
 * @example
 * // Fetch global templates for Points chart type
 * const { data: templates } = useGlobalThresholdCharts('team_points');
 *
 * // Fetch league's charts
 * const { data: leagueCharts } = useLeagueThresholdCharts(leagueId, 'team_points');
 *
 * // Get the default chart for a league (with fallback to org/global)
 * const { data: defaultChart } = useDefaultThresholdChart('league', leagueId, 'team_points', orgId);
 *
 * // Look up threshold values
 * const { data: result } = useThresholdLookup(chartId, handicapDiff);
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getGlobalThresholdCharts,
  getLeagueThresholdCharts,
  getThresholdChartWithRows,
  getDefaultThresholdChart,
  lookupThreshold,
  createThresholdChart,
  createThresholdChartRows,
  updateThresholdChart,
  replaceThresholdChartRows,
  deleteThresholdChart,
  copyGlobalChartToLeague,
  type ThresholdChartType,
  type ThresholdEntityType,
  type ThresholdLookupMode,
  type ThresholdChart,
  type ThresholdChartWithRows,
  type ThresholdChartRow,
  type ThresholdLookupResult,
  type CreateThresholdChartInput,
  type CreateThresholdChartRowInput,
} from '../queries/thresholdCharts';
import { STALE_TIME } from '../client';

// =============================================================================
// QUERY KEYS
// =============================================================================

/** Query key factory for threshold charts */
export const thresholdChartKeys = {
  all: ['thresholdCharts'] as const,
  global: (chartType?: ThresholdChartType) =>
    [...thresholdChartKeys.all, 'global', chartType] as const,
  league: (leagueId: string, chartType?: ThresholdChartType) =>
    [...thresholdChartKeys.all, 'league', leagueId, chartType] as const,
  detail: (chartId: string) => [...thresholdChartKeys.all, 'detail', chartId] as const,
  default: (
    entityType: 'league' | 'organization',
    entityId: string,
    chartType: ThresholdChartType
  ) => [...thresholdChartKeys.all, 'default', entityType, entityId, chartType] as const,
  lookup: (chartId: string, comp1: number, comp2?: number | null) =>
    [...thresholdChartKeys.all, 'lookup', chartId, comp1, comp2] as const,
};

// =============================================================================
// QUERY HOOKS
// =============================================================================

/**
 * Fetch all global threshold charts (system templates)
 *
 * Global charts are read-only templates that operators can copy to create
 * their own customized charts.
 *
 * @param chartType - Optional filter by chart type
 * @returns TanStack Query result with global charts
 *
 * @example
 * const { data: templates } = useGlobalThresholdCharts('team_points');
 * // Shows list of global points chart templates
 */
export function useGlobalThresholdCharts(chartType?: ThresholdChartType) {
  return useQuery({
    queryKey: thresholdChartKeys.global(chartType),
    queryFn: () => getGlobalThresholdCharts(chartType),
    staleTime: STALE_TIME.LEAGUES, // 15 minutes - global charts rarely change
  });
}

/**
 * Fetch threshold charts for a specific league
 *
 * Returns charts that belong directly to the league (not global templates).
 *
 * @param leagueId - League ID
 * @param chartType - Optional filter by chart type
 * @returns TanStack Query result with league charts
 *
 * @example
 * const { data: leagueCharts } = useLeagueThresholdCharts(leagueId, 'team_points');
 */
export function useLeagueThresholdCharts(
  leagueId: string | null | undefined,
  chartType?: ThresholdChartType
) {
  return useQuery({
    queryKey: thresholdChartKeys.league(leagueId!, chartType),
    queryFn: () => getLeagueThresholdCharts(leagueId!, chartType),
    enabled: !!leagueId,
    staleTime: STALE_TIME.MEMBER, // 15 minutes
  });
}

/**
 * Fetch a single threshold chart with its rows
 *
 * @param chartId - Chart ID
 * @returns TanStack Query result with chart and rows
 *
 * @example
 * const { data: chart } = useThresholdChart(chartId);
 * if (chart) {
 *   console.log(`Chart has ${chart.rows.length} rows`);
 * }
 */
export function useThresholdChart(chartId: string | null | undefined) {
  return useQuery({
    queryKey: thresholdChartKeys.detail(chartId!),
    queryFn: () => getThresholdChartWithRows(chartId!),
    enabled: !!chartId,
    staleTime: STALE_TIME.MEMBER, // 15 minutes
  });
}

/**
 * Fetch the default threshold chart for an entity
 *
 * Follows the hierarchy: entity → organization → global
 * - For leagues: tries league default → org default → global default
 * - For organizations: tries org default → global default
 *
 * @param entityType - 'league' or 'organization'
 * @param entityId - League or organization ID
 * @param chartType - Chart type to find
 * @param organizationId - Organization ID (required for league fallback)
 * @returns TanStack Query result with default chart and rows
 *
 * @example
 * const { data: defaultChart } = useDefaultThresholdChart(
 *   'league',
 *   leagueId,
 *   'team_points',
 *   organizationId
 * );
 */
export function useDefaultThresholdChart(
  entityType: 'league' | 'organization',
  entityId: string | null | undefined,
  chartType: ThresholdChartType,
  organizationId?: string
) {
  return useQuery({
    queryKey: thresholdChartKeys.default(entityType, entityId!, chartType),
    queryFn: () => getDefaultThresholdChart(entityType, entityId!, chartType, organizationId),
    enabled: !!entityId,
    staleTime: STALE_TIME.MEMBER, // 15 minutes
  });
}

/**
 * Look up threshold values from a chart
 *
 * Uses the database's lookup_threshold function which handles:
 * - Exact vs range matching based on chart's lookup_mode
 * - Race chart normalization (swaps results when comp1 < comp2)
 *
 * @param chartId - Chart ID to look up in
 * @param comp1 - Primary comparison value (handicap diff or player 1 handicap)
 * @param comp2 - Secondary comparison (for race charts: player 2 handicap)
 * @returns TanStack Query result with lookup result
 *
 * @example
 * // Team chart lookup (single comparison value)
 * const { data: result } = useThresholdLookup(chartId, handicapDiff);
 * if (result) {
 *   console.log(`Home needs ${result.result_1} to win, ${result.result_2} to tie`);
 * }
 *
 * // Race chart lookup (two comparison values)
 * const { data: result } = useThresholdLookup(chartId, player1Handicap, player2Handicap);
 * if (result) {
 *   const p1Wins = result.was_swapped ? result.result_3 : result.result_1;
 *   const p2Wins = result.was_swapped ? result.result_1 : result.result_3;
 * }
 */
export function useThresholdLookup(
  chartId: string | null | undefined,
  comp1: number | null | undefined,
  comp2?: number | null
) {
  return useQuery({
    queryKey: thresholdChartKeys.lookup(chartId!, comp1!, comp2),
    queryFn: () => lookupThreshold(chartId!, comp1!, comp2),
    enabled: !!chartId && comp1 !== null && comp1 !== undefined,
    staleTime: STALE_TIME.LEAGUES, // 15 minutes - lookups are deterministic
  });
}

// =============================================================================
// MUTATION HOOKS
// =============================================================================

/**
 * Create a new threshold chart
 *
 * @returns Mutation function and state
 *
 * @example
 * const { mutate: createChart, isPending } = useCreateThresholdChart();
 * createChart({
 *   entity_type: 'league',
 *   entity_id: leagueId,
 *   chart_type: 'team_points',
 *   lookup_mode: 'exact',
 *   name: 'My Custom Chart',
 * });
 */
export function useCreateThresholdChart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateThresholdChartInput) => createThresholdChart(input),
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: thresholdChartKeys.all,
      });
    },
  });
}

/**
 * Create rows for a threshold chart
 *
 * @returns Mutation function and state
 */
export function useCreateThresholdChartRows() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rows: CreateThresholdChartRowInput[]) => createThresholdChartRows(rows),
    onSuccess: (_data, variables) => {
      if (variables.length > 0) {
        queryClient.invalidateQueries({
          queryKey: thresholdChartKeys.detail(variables[0].chart_id),
        });
      }
    },
  });
}

/**
 * Update a threshold chart's metadata
 *
 * @returns Mutation function and state
 */
export function useUpdateThresholdChart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      chartId,
      updates,
    }: {
      chartId: string;
      updates: Partial<Pick<ThresholdChart, 'name' | 'description' | 'is_default'>>;
    }) => updateThresholdChart(chartId, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: thresholdChartKeys.detail(data.id),
      });
      queryClient.invalidateQueries({
        queryKey: thresholdChartKeys.all,
      });
    },
  });
}

/**
 * Replace all rows in a threshold chart
 *
 * Used when saving chart edits - deletes existing rows and inserts new ones.
 *
 * @returns Mutation function and state
 *
 * @example
 * const { mutate: saveRows, isPending } = useReplaceThresholdChartRows();
 * saveRows({
 *   chartId,
 *   rows: editedRows.map((row, idx) => ({
 *     comp_1: row.diff,
 *     result_1: row.win,
 *     result_2: row.tie,
 *     result_3: row.lose,
 *     sort_order: idx,
 *   })),
 * });
 */
export function useReplaceThresholdChartRows() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      chartId,
      rows,
    }: {
      chartId: string;
      rows: Omit<CreateThresholdChartRowInput, 'chart_id'>[];
    }) => replaceThresholdChartRows(chartId, rows),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: thresholdChartKeys.detail(variables.chartId),
      });
      // Also invalidate lookups for this chart
      queryClient.invalidateQueries({
        queryKey: [...thresholdChartKeys.all, 'lookup', variables.chartId],
      });
    },
  });
}

/**
 * Delete a threshold chart
 *
 * @returns Mutation function and state
 */
export function useDeleteThresholdChart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (chartId: string) => deleteThresholdChart(chartId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: thresholdChartKeys.all,
      });
    },
  });
}

/**
 * Copy a global template chart to a league
 *
 * Creates a league-specific copy that can be customized.
 *
 * @returns Mutation function and state
 *
 * @example
 * const { mutate: copyChart, isPending } = useCopyGlobalChartToLeague();
 * copyChart({
 *   globalChartId: templateId,
 *   leagueId,
 *   name: 'Our Custom Points Chart',
 * });
 */
export function useCopyGlobalChartToLeague() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      globalChartId,
      leagueId,
      name,
    }: {
      globalChartId: string;
      leagueId: string;
      name?: string;
    }) => copyGlobalChartToLeague(globalChartId, leagueId, name),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: thresholdChartKeys.league(data.entity_id),
      });
    },
  });
}

// =============================================================================
// RE-EXPORTS
// =============================================================================

export type {
  ThresholdChartType,
  ThresholdEntityType,
  ThresholdLookupMode,
  ThresholdChart,
  ThresholdChartRow,
  ThresholdChartWithRows,
  ThresholdLookupResult,
  CreateThresholdChartInput,
  CreateThresholdChartRowInput,
};
