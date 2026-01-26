/**
 * @fileoverview Database-Backed Percentage Threshold Chart Editor Page
 *
 * Full-page editor for percentage-based threshold charts using database storage.
 * Season-based: the chart is stored on and linked to a specific season.
 *
 * Route: /league/:leagueId/season/:seasonId/threshold-chart/percentage
 *
 * Data flow:
 * 1. Load season to get threshold_chart_id and league_id
 * 2. If season has threshold_chart_id → load that specific chart
 * 3. If season has no chart (null) → load league/org/global default for display
 * 4. On save → create/update chart AND link it to the season via threshold_chart_id
 *
 * Percentage charts use range-based lookup (VLOOKUP style) rather than exact match.
 * Back navigation always returns to the match list page.
 */

import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Database, Copy, AlertCircle } from 'lucide-react';
import {
  PercentageThresholdChartEditor,
  ChartTypeSelector,
  SaveChartModal,
  getDefaultPercentageChartRows,
  type PercentageChartRow,
  type ChartEditorType,
  type SaveChartData,
} from '@/components/operator/threshold-editor';
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

/**
 * Convert database chart rows to editor format for percentage charts
 *
 * DB format: comp_1 (minDiff), comp_2 (maxDiff), result_1 (higherWins), result_3 (lowerWins)
 *
 * For range-based percentage charts, we store:
 * - comp_1: min of the range
 * - comp_2: max of the range
 * - result_1: higher handicap team games to win
 * - result_3: lower handicap team games to win
 * - result_2: NULL (no ties in percentage format)
 */
function dbRowsToEditorRows(dbRows: ThresholdChartWithRows['rows']): PercentageChartRow[] {
  // Sort by sort_order to ensure proper ordering
  const sortedRows = [...dbRows].sort((a, b) => a.sort_order - b.sort_order);

  return sortedRows.map((row, idx) => {
    // For percentage charts, comp_2 stores maxDiff
    // If comp_2 is null, derive maxDiff from next row's comp_1 - 1
    const nextRow = sortedRows[idx + 1];
    const maxDiff = row.comp_2 !== null
      ? row.comp_2
      : nextRow
        ? nextRow.comp_1 - 1
        : 999; // Last row goes to infinity

    return {
      minDiff: row.comp_1,
      maxDiff: maxDiff,
      higherWins: row.result_1,
      lowerWins: row.result_3,
    };
  });
}

/**
 * Convert editor format rows to database format
 */
function editorRowsToDbRows(
  editorRows: PercentageChartRow[]
): Array<{
  comp_1: number;
  comp_2: number | null;
  result_1: number;
  result_2: number | null;
  result_3: number;
  sort_order: number;
}> {
  return editorRows.map((row, idx) => ({
    comp_1: row.minDiff,
    comp_2: row.maxDiff, // Store maxDiff in comp_2 for range charts
    result_1: row.higherWins ?? 0,
    result_2: null, // No ties in percentage charts
    result_3: row.lowerWins ?? 0,
    sort_order: idx,
  }));
}

/**
 * Database-Backed Percentage Threshold Chart Editor Page
 *
 * Season-based: loads chart from season.threshold_chart_id or falls back to defaults.
 * On save, links the chart to the season.
 */
export default function DbPercentageThresholdChartPage() {
  const { leagueId, seasonId } = useParams<{ leagueId: string; seasonId: string }>();
  const navigate = useNavigate();

  // Track unsaved changes from the editor (for navigation warning)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Modal state for saving new charts
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [pendingChartData, setPendingChartData] = useState<PercentageChartRow[] | null>(null);

  // === Data Fetching ===

  // 1. Fetch the season to get threshold_chart_id and league_id
  const { data: season, isLoading: isSeasonLoading } = useSeasonById(seasonId);

  // 2. Fetch the league to get organization_id for fallback lookup
  const { data: league, isLoading: isLeagueLoading } = useLeagueById(season?.league_id);

  // 3. If season has a specific chart, load it directly
  const {
    data: seasonChart,
    isLoading: isSeasonChartLoading,
  } = useThresholdChart(season?.threshold_chart_id);

  // 4. If no season-specific chart, load the default (league → org → global)
  const {
    data: defaultChart,
    isLoading: isDefaultChartLoading,
    error: defaultChartError,
  } = useDefaultThresholdChart(
    'league',
    season?.league_id,
    'team_percentage',
    league?.organization_id
  );

  // 5. Fetch global templates (for copy option)
  const { data: globalTemplates } = useGlobalThresholdCharts('team_percentage');

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
      return dbRowsToEditorRows(activeChart.rows);
    }
    return getDefaultPercentageChartRows();
  }, [activeChart]);

  // Loading state
  const isLoading = isSeasonLoading || isLeagueLoading || isSeasonChartLoading || isDefaultChartLoading;
  const isSaving = isCreating || isReplacing || isCopying || isUpdatingSeason;

  /**
   * Handle save from editor - shows modal if creating new chart
   */
  const handleEditorSave = (data: PercentageChartRow[]) => {
    if (!seasonId || !season) return;

    // If season already has its own chart, just update the rows (no modal needed)
    if (hasSeasonChart && seasonChart) {
      replaceRows({
        chartId: seasonChart.id,
        rows: editorRowsToDbRows(data),
      });
      return;
    }

    // Need to create a new chart - show modal to collect name/description
    setPendingChartData(data);
    setShowSaveModal(true);
  };

  /**
   * Handle modal confirmation - creates chart with name/description and links to season
   */
  const handleModalSave = (saveData: SaveChartData) => {
    if (!seasonId || !season || !pendingChartData) return;

    createChart(
      {
        entity_type: 'league',
        entity_id: season.league_id,
        chart_type: 'team_percentage',
        lookup_mode: 'range', // Percentage charts use range lookup
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
              rows: editorRowsToDbRows(pendingChartData),
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
  };

  /**
   * Handle copying a global template to create a season-specific chart
   */
  const handleCopyTemplate = (templateId: string) => {
    if (!seasonId || !season) return;

    copyGlobalChart(
      {
        globalChartId: templateId,
        leagueId: season.league_id,
        name: `${season.season_name} Percentage Chart`,
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
  };

  /**
   * Handle cancel/back navigation - always returns to match list
   */
  const handleCancel = () => {
    if (leagueId && seasonId) {
      navigate(`/league/${leagueId}/season/${seasonId}/match-list`);
    } else {
      navigate(-1);
    }
  };

  /**
   * Handle chart type change from ChartTypeSelector
   * Navigates to the appropriate chart editor page
   */
  const handleChartTypeChange = (chartType: ChartEditorType) => {
    if (!leagueId || !seasonId) return;
    navigate(`/league/${leagueId}/season/${seasonId}/threshold-chart/${chartType}`);
  };

  // Back navigation always goes to match list
  const backTo = leagueId && seasonId ? `/league/${leagueId}/season/${seasonId}/match-list` : '/';
  const backLabel = 'Back to Match List';

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader
          backTo={backTo}
          backLabel={backLabel}
          title="Threshold Chart Editor (Team/Percentage)"
          subtitle="Loading chart data..."
        />
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Card>
            <CardContent className="py-12 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <span className="ml-3 text-gray-600">Loading chart from database...</span>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Error state
  if (defaultChartError && !seasonChart) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader
          backTo={backTo}
          backLabel={backLabel}
          title="Threshold Chart Editor (Team/Percentage)"
          subtitle="Error loading chart"
        />
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-6">
              <div className="flex items-center gap-3 text-red-700">
                <AlertCircle className="h-5 w-5" />
                <span>Failed to load chart: {(defaultChartError as Error).message}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        backTo={backTo}
        backLabel={backLabel}
        title="Threshold Chart Editor (Team/Percentage)"
        subtitle={season ? `Season: ${season.season_name}` : 'Configure games-to-win thresholds'}
      />

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Database Status Card */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-700">
                <Database className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {hasSeasonChart ? (
                    'Using season-specific chart'
                  ) : isUsingGlobalTemplate ? (
                    'Using global template (read-only until customized)'
                  ) : activeChart ? (
                    `Using ${activeChart.entity_type} default`
                  ) : (
                    'No chart found - using hardcoded defaults'
                  )}
                </span>
              </div>
              {isUsingGlobalTemplate && globalTemplates && globalTemplates.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyTemplate(globalTemplates[0].id)}
                  disabled={isCopying || isUpdatingSeason}
                  className="h-7 text-xs"
                >
                  {isCopying || isUpdatingSeason ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Copy className="h-3 w-3 mr-1" />
                  )}
                  Create Season Copy
                </Button>
              )}
            </div>
            {activeChart && (
              <p className="text-xs text-blue-600 mt-1">
                Chart: {activeChart.name} ({activeChart.entity_type})
              </p>
            )}
          </CardContent>
        </Card>

        {/* Chart Type Selector */}
        <ChartTypeSelector
          currentType="percentage"
          onChartTypeChange={handleChartTypeChange}
          hasUnsavedChanges={hasUnsavedChanges}
        />

        {/* Chart Editor */}
        <PercentageThresholdChartEditor
          initialData={chartRows}
          onSave={handleEditorSave}
          onCancel={handleCancel}
          isSaving={isSaving}
          onUnsavedChangesChange={setHasUnsavedChanges}
        />
      </div>

      {/* Save Chart Modal - shown when creating a new season chart */}
      <SaveChartModal
        open={showSaveModal}
        onOpenChange={(open) => {
          setShowSaveModal(open);
          if (!open) setPendingChartData(null);
        }}
        onSave={handleModalSave}
        isSaving={isSaving}
        chartTypeLabel="Percentage"
      />
    </div>
  );
}
