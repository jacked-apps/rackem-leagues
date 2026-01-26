/**
 * @fileoverview Custom Hook for Threshold Chart Editor Pages
 *
 * Encapsulates all shared logic for threshold chart editor pages:
 * - URL parameter extraction
 * - Data fetching (season, league, charts)
 * - Mutation handlers (create, update, copy)
 * - Navigation handlers
 * - Derived state calculations
 *
 * This hook reduces ~80% code duplication across Points, Percentage,
 * and Race chart editor pages. Each page only needs to provide:
 * - Chart type configuration
 * - Row conversion functions (dbRowsToEditor, editorRowsToDb)
 * - Default rows function
 *
 * @example
 * ```tsx
 * const page = useThresholdChartPage({
 *   chartType: 'team_points',
 *   dbRowsToEditor: pointsDbRowsToEditor,
 *   editorRowsToDb: pointsEditorRowsToDb,
 *   getDefaultRows: getDefaultPointsChartRows,
 * });
 *
 * return (
 *   <ThresholdChartPageLayout {...page.layoutProps}>
 *     <DatabaseStatusCard {...page.statusCardProps} />
 *     <Editor initialData={page.chartRows} onSave={page.handleEditorSave} />
 *   </ThresholdChartPageLayout>
 * );
 * ```
 */

import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useThresholdChart,
  useDefaultThresholdChart,
  useGlobalThresholdCharts,
  useCreateThresholdChart,
  useReplaceThresholdChartRows,
  useCopyGlobalChartToLeague,
  useSeasonById,
  useUpdateSeason,
  useLeagueById,
  type ThresholdChartWithRows,
} from '@/api/hooks';
import type { ThresholdChartType, ThresholdLookupMode } from '@/api/queries/thresholdCharts';
import { getChartTypeConfig, getChartPageTitle, getChartTypeLabel } from '@/constants/thresholdCharts';
import type { ChartEditorType, SaveChartData } from './index';

/**
 * Database row format for threshold chart rows
 *
 * This is the format used when saving rows to the database.
 * Each chart type converts its editor format to this format.
 */
export interface DbRowFormat {
  comp_1: number;
  comp_2: number | null;
  result_1: number;
  result_2: number | null;
  result_3: number;
  sort_order: number;
}

/**
 * Configuration for the useThresholdChartPage hook
 *
 * Each chart editor page provides this configuration to customize
 * the hook's behavior for that specific chart type.
 */
export interface UseThresholdChartPageConfig<TEditorRow> {
  /** Database chart type (team_points, team_percentage, race_points, race_percentage) */
  chartType: ThresholdChartType;

  /** Function to convert database rows to editor format */
  dbRowsToEditor: (dbRows: ThresholdChartWithRows['rows']) => TEditorRow[];

  /** Function to convert editor rows to database format */
  editorRowsToDb: (rows: TEditorRow[]) => DbRowFormat[];

  /** Function to get default rows when no chart data exists */
  getDefaultRows: () => TEditorRow[];
}

/**
 * Return type for the useThresholdChartPage hook
 *
 * Contains all state, data, and handlers needed by chart editor pages.
 */
export interface UseThresholdChartPageResult<TEditorRow> {
  // === Navigation ===
  /** League ID from URL params */
  leagueId: string | undefined;
  /** Season ID from URL params */
  seasonId: string | undefined;
  /** Path for back button navigation */
  backTo: string;
  /** Label for back button */
  backLabel: string;
  /** React Router navigate function */
  navigate: ReturnType<typeof useNavigate>;
  /** Navigate back to match list */
  handleCancel: () => void;
  /** Navigate to a different chart type editor */
  handleChartTypeChange: (chartType: ChartEditorType) => void;

  // === Data ===
  /** Season record */
  season: ReturnType<typeof useSeasonById>['data'];
  /** The currently active chart (season-specific or default) */
  activeChart: ThresholdChartWithRows | null | undefined;
  /** Chart rows converted to editor format */
  chartRows: TEditorRow[];
  /** Whether the season has its own chart (vs using a default) */
  hasSeasonChart: boolean;
  /** Whether currently using a global template (read-only) */
  isUsingGlobalTemplate: boolean;
  /** Global templates available for copying */
  globalTemplates: ReturnType<typeof useGlobalThresholdCharts>['data'];

  // === State ===
  /** Whether data is loading */
  isLoading: boolean;
  /** Whether a save/copy operation is in progress */
  isSaving: boolean;
  /** Error from default chart fetch (null if no error) */
  defaultChartError: Error | null;
  /** Whether editor has unsaved changes */
  hasUnsavedChanges: boolean;
  /** Setter for unsaved changes state */
  setHasUnsavedChanges: (value: boolean) => void;
  /** Whether save modal is open */
  showSaveModal: boolean;
  /** Setter for save modal state */
  setShowSaveModal: (value: boolean) => void;

  // === Handlers ===
  /** Handle save from editor - shows modal if creating new chart */
  handleEditorSave: (data: TEditorRow[]) => void;
  /** Handle modal confirmation - creates chart and links to season */
  handleModalSave: (saveData: SaveChartData) => void;
  /** Handle copying a global template to create a season-specific chart */
  handleCopyTemplate: (templateId: string) => void;

  // === Props for Components ===
  /** Props to spread to ThresholdChartPageLayout */
  layoutProps: {
    title: string;
    subtitle: string;
    maxWidth: '3xl' | '4xl';
    backTo: string;
    backLabel: string;
    isLoading: boolean;
    error: Error | null;
  };

  /** Props to spread to DatabaseStatusCard */
  statusCardProps: {
    hasSeasonChart: boolean;
    isUsingGlobalTemplate: boolean;
    activeChart: ThresholdChartWithRows | null | undefined;
    globalTemplates: ReturnType<typeof useGlobalThresholdCharts>['data'];
    onCopyTemplate: (templateId: string) => void;
    isCopying: boolean;
  };

  // === Chart Type Config ===
  /** Label for the chart type (e.g., "Points", "Percentage") */
  chartTypeLabel: string;
  /** Lookup mode for the chart type */
  lookupMode: ThresholdLookupMode;
}

/**
 * Custom Hook for Threshold Chart Editor Pages
 *
 * Provides all the shared logic needed by chart editor pages:
 *
 * 1. **Data Fetching**: Loads season, league, and chart data
 * 2. **State Management**: Tracks unsaved changes, modal state
 * 3. **Mutations**: Handles create, update, and copy operations
 * 4. **Navigation**: Handles cancel, chart type switching
 * 5. **Derived State**: Calculates loading, chart ownership status
 *
 * The hook is generic over the editor row type (TEditorRow), allowing
 * each chart type to use its own row format while sharing all other logic.
 *
 * @param config - Configuration specific to the chart type
 * @returns All state and handlers needed for the page
 */
export function useThresholdChartPage<TEditorRow>(
  config: UseThresholdChartPageConfig<TEditorRow>
): UseThresholdChartPageResult<TEditorRow> {
  const { chartType, dbRowsToEditor, editorRowsToDb, getDefaultRows } = config;

  // Get chart type configuration from constants
  const chartConfig = getChartTypeConfig(chartType);

  // === URL Params & Navigation ===
  const { leagueId, seasonId } = useParams<{ leagueId: string; seasonId: string }>();
  const navigate = useNavigate();

  // === Local State ===
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [pendingChartData, setPendingChartData] = useState<TEditorRow[] | null>(null);

  // === Data Fetching ===

  // 1. Fetch the season to get threshold_chart_id and league_id
  const { data: season, isLoading: isSeasonLoading } = useSeasonById(seasonId);

  // 2. Fetch the league to get organization_id for fallback lookup
  const { data: league, isLoading: isLeagueLoading } = useLeagueById(season?.league_id);

  // 3. If season has a specific chart, load it directly
  const { data: seasonChart, isLoading: isSeasonChartLoading } = useThresholdChart(
    season?.threshold_chart_id
  );

  // 4. If no season-specific chart, load the default (league → org → global)
  const {
    data: defaultChart,
    isLoading: isDefaultChartLoading,
    error: defaultChartError,
  } = useDefaultThresholdChart(
    'league',
    season?.league_id,
    chartType,
    league?.organization_id
  );

  // 5. Fetch global templates (for copy option)
  const { data: globalTemplates } = useGlobalThresholdCharts(chartType);

  // === Mutations ===
  const { mutate: createChart, isPending: isCreating } = useCreateThresholdChart();
  const { mutate: replaceRows, isPending: isReplacing } = useReplaceThresholdChartRows();
  const { mutate: copyGlobalChart, isPending: isCopying } = useCopyGlobalChartToLeague();
  const { mutate: updateSeason, isPending: isUpdatingSeason } = useUpdateSeason();

  // === Derived State ===

  // Determine which chart we're actually using
  const activeChart = seasonChart || defaultChart;
  const hasSeasonChart = !!season?.threshold_chart_id && !!seasonChart;
  const isUsingGlobalTemplate = !hasSeasonChart && defaultChart?.entity_type === 'global';

  // Convert DB rows to editor format
  const chartRows = useMemo(() => {
    if (activeChart?.rows && activeChart.rows.length > 0) {
      return dbRowsToEditor(activeChart.rows);
    }
    return getDefaultRows();
  }, [activeChart, dbRowsToEditor, getDefaultRows]);

  // Loading state
  const isLoading =
    isSeasonLoading || isLeagueLoading || isSeasonChartLoading || isDefaultChartLoading;
  const isSaving = isCreating || isReplacing || isCopying || isUpdatingSeason;

  // Back navigation info
  const backTo = leagueId && seasonId ? `/league/${leagueId}/season/${seasonId}/match-list` : '/';
  const backLabel = 'Back to Match List';

  // === Handlers ===

  /**
   * Handle save from editor - shows modal if creating new chart
   */
  const handleEditorSave = useCallback(
    (data: TEditorRow[]) => {
      if (!seasonId || !season) return;

      // If season already has its own chart, just update the rows (no modal needed)
      if (hasSeasonChart && seasonChart) {
        replaceRows({
          chartId: seasonChart.id,
          rows: editorRowsToDb(data),
        });
        return;
      }

      // Need to create a new chart - show modal to collect name/description
      setPendingChartData(data);
      setShowSaveModal(true);
    },
    [seasonId, season, hasSeasonChart, seasonChart, replaceRows, editorRowsToDb]
  );

  /**
   * Handle modal confirmation - creates chart with name/description and links to season
   */
  const handleModalSave = useCallback(
    (saveData: SaveChartData) => {
      if (!seasonId || !season || !pendingChartData) return;

      createChart(
        {
          entity_type: 'league',
          entity_id: season.league_id,
          chart_type: chartType,
          lookup_mode: chartConfig.lookupMode,
          name: saveData.name,
          description: saveData.description,
          is_default: false, // Season-specific charts are not league defaults
        },
        {
          onSuccess: (newChart) => {
            // Save the rows to the new chart
            replaceRows(
              {
                chartId: newChart.id,
                rows: editorRowsToDb(pendingChartData),
              },
              {
                onSuccess: () => {
                  // Link the chart to the season
                  updateSeason({
                    seasonId: seasonId,
                    thresholdChartId: newChart.id,
                  });
                },
              }
            );
            // Close modal and clear pending data
            setShowSaveModal(false);
            setPendingChartData(null);
          },
        }
      );
    },
    [
      seasonId,
      season,
      pendingChartData,
      createChart,
      chartType,
      chartConfig.lookupMode,
      replaceRows,
      editorRowsToDb,
      updateSeason,
    ]
  );

  /**
   * Handle copying a global template to create a season-specific chart
   */
  const handleCopyTemplate = useCallback(
    (templateId: string) => {
      if (!seasonId || !season) return;

      copyGlobalChart(
        {
          globalChartId: templateId,
          leagueId: season.league_id,
          name: `${season.season_name} ${chartConfig.label} Chart`,
        },
        {
          onSuccess: (newChart) => {
            // Link the copied chart to the season
            updateSeason({
              seasonId: seasonId,
              thresholdChartId: newChart.id,
            });
          },
        }
      );
    },
    [seasonId, season, copyGlobalChart, chartConfig.label, updateSeason]
  );

  /**
   * Handle cancel/back navigation - always returns to match list
   */
  const handleCancel = useCallback(() => {
    if (leagueId && seasonId) {
      navigate(`/league/${leagueId}/season/${seasonId}/match-list`);
    } else {
      navigate(-1);
    }
  }, [leagueId, seasonId, navigate]);

  /**
   * Handle chart type change from ChartTypeSelector
   * Navigates to the appropriate chart editor page
   */
  const handleChartTypeChange = useCallback(
    (newChartType: ChartEditorType) => {
      if (!leagueId || !seasonId) return;
      navigate(`/league/${leagueId}/season/${seasonId}/threshold-chart/${newChartType}`);
    },
    [leagueId, seasonId, navigate]
  );

  // === Props for Components ===

  const layoutProps = {
    title: getChartPageTitle(chartType),
    subtitle: season ? `Season: ${season.season_name}` : 'Configure games-to-win thresholds',
    maxWidth: chartConfig.maxWidth,
    backTo,
    backLabel,
    isLoading,
    error: defaultChartError && !seasonChart ? (defaultChartError as Error) : null,
  };

  const statusCardProps = {
    hasSeasonChart,
    isUsingGlobalTemplate,
    activeChart,
    globalTemplates,
    onCopyTemplate: handleCopyTemplate,
    isCopying: isCopying || isUpdatingSeason,
  };

  return {
    // Navigation
    leagueId,
    seasonId,
    backTo,
    backLabel,
    navigate,
    handleCancel,
    handleChartTypeChange,

    // Data
    season,
    activeChart,
    chartRows,
    hasSeasonChart,
    isUsingGlobalTemplate,
    globalTemplates,

    // State
    isLoading,
    isSaving,
    defaultChartError: defaultChartError as Error | null,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    showSaveModal,
    setShowSaveModal: (open: boolean) => {
      setShowSaveModal(open);
      if (!open) setPendingChartData(null);
    },

    // Handlers
    handleEditorSave,
    handleModalSave,
    handleCopyTemplate,

    // Props for components
    layoutProps,
    statusCardProps,

    // Chart type config
    chartTypeLabel: getChartTypeLabel(chartType),
    lookupMode: chartConfig.lookupMode,
  };
}
