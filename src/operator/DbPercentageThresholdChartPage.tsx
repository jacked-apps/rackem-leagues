/**
 * @fileoverview Database-Backed Percentage Threshold Chart Editor Page
 *
 * Full-page editor for percentage-based threshold charts using database storage.
 * This is the database-backed version of PercentageThresholdChartPage.
 *
 * Route: /league/:leagueId/threshold-chart-db/percentage
 *
 * Key differences from the localStorage version:
 * - Loads chart data from threshold_charts and threshold_chart_rows tables
 * - Can use global templates, organization defaults, or league-specific charts
 * - Saves changes to database via mutation hooks
 * - Supports copying global templates to create league-specific charts
 *
 * Percentage charts use range-based lookup (VLOOKUP style) rather than exact match.
 */

import { useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
  useDefaultThresholdChart,
  useGlobalThresholdCharts,
  useLeagueThresholdCharts,
  useCreateThresholdChart,
  useReplaceThresholdChartRows,
  useCopyGlobalChartToLeague,
  type ThresholdChartWithRows,
} from '@/api/hooks';
import { useLeagueById } from '@/api/hooks/useLeagues';

/**
 * Convert database chart rows to editor format for percentage charts
 *
 * DB format: comp_1 (minDiff), comp_2 (maxDiff), result_1 (higherWins), result_3 (lowerWins)
 * Note: For percentage charts, we use comp_1 as minDiff and a separate row attribute for maxDiff
 *       However, the DB schema uses comp_2 for the second comparison value (maxDiff in range charts)
 *
 * For range-based percentage charts, we store:
 * - comp_1: min of the range
 * - comp_2: max of the range (we'll use sort_order to derive this if not stored)
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
 * Loads charts from database and saves changes via mutations.
 */
export default function DbPercentageThresholdChartPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Get params from query string
  const returnTo = searchParams.get('returnTo');

  // Track unsaved changes from the editor (for navigation warning)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Modal state for saving new charts
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [pendingChartData, setPendingChartData] = useState<PercentageChartRow[] | null>(null);

  // Fetch league to get organization ID for fallback lookup
  const { data: league, isLoading: isLeagueLoading } = useLeagueById(leagueId);

  // Fetch charts from database
  const {
    data: defaultChart,
    isLoading: isDefaultChartLoading,
    error: defaultChartError,
  } = useDefaultThresholdChart(
    'league',
    leagueId,
    'team_percentage',
    league?.organization_id
  );

  // Fetch league's own charts
  const { data: leagueCharts, isLoading: isLeagueChartsLoading } = useLeagueThresholdCharts(
    leagueId,
    'team_percentage'
  );

  // Fetch global templates (for copy option)
  const { data: globalTemplates } = useGlobalThresholdCharts('team_percentage');

  // Mutations
  const { mutate: createChart, isPending: isCreating } = useCreateThresholdChart();
  const { mutate: replaceRows, isPending: isReplacing } = useReplaceThresholdChartRows();
  const { mutate: copyGlobalChart, isPending: isCopying } = useCopyGlobalChartToLeague();

  // Track the active chart
  // Note: defaultChart follows the hierarchy: league → org → global, and includes rows
  const hasLeagueChart = leagueCharts && leagueCharts.length > 0;
  const isUsingGlobalTemplate = !hasLeagueChart && defaultChart?.entity_type === 'global';

  // Convert DB rows to editor format
  // Use defaultChart which already has rows loaded
  const chartRows = useMemo(() => {
    if (defaultChart?.rows && defaultChart.rows.length > 0) {
      return dbRowsToEditorRows(defaultChart.rows);
    }
    return getDefaultPercentageChartRows();
  }, [defaultChart]);

  // Loading state
  const isLoading = isLeagueLoading || isDefaultChartLoading || isLeagueChartsLoading;
  const isSaving = isCreating || isReplacing || isCopying;

  /**
   * Handle save from editor - shows modal if creating new chart
   */
  const handleEditorSave = (data: PercentageChartRow[]) => {
    if (!leagueId) return;

    // If league already has a chart, just update the rows (no modal needed)
    if (hasLeagueChart && leagueCharts[0]) {
      replaceRows({
        chartId: leagueCharts[0].id,
        rows: editorRowsToDbRows(data),
      });
      return;
    }

    // Need to create a new chart - show modal to collect name/description
    setPendingChartData(data);
    setShowSaveModal(true);
  };

  /**
   * Handle modal confirmation - creates chart with name/description
   */
  const handleModalSave = (saveData: SaveChartData) => {
    if (!leagueId || !pendingChartData) return;

    createChart(
      {
        entity_type: 'league',
        entity_id: leagueId,
        chart_type: 'team_percentage',
        lookup_mode: 'range', // Percentage charts use range lookup
        name: saveData.name,
        description: saveData.description,
        is_default: true,
      },
      {
        onSuccess: (newChart) => {
          replaceRows({
            chartId: newChart.id,
            rows: editorRowsToDbRows(pendingChartData),
          });
          setShowSaveModal(false);
          setPendingChartData(null);
        },
      }
    );
  };

  /**
   * Handle copying a global template
   */
  const handleCopyTemplate = (templateId: string) => {
    if (!leagueId) return;

    copyGlobalChart({
      globalChartId: templateId,
      leagueId,
      name: 'League Percentage Chart',
    });
  };

  /**
   * Handle cancel/back navigation
   */
  const handleCancel = () => {
    if (returnTo) {
      navigate(returnTo);
    } else if (leagueId) {
      navigate(`/league/${leagueId}`);
    } else {
      navigate(-1);
    }
  };

  /**
   * Handle chart type change from ChartTypeSelector
   * Navigates to the appropriate chart editor page
   */
  const handleChartTypeChange = (chartType: ChartEditorType) => {
    if (!leagueId) return;
    const params = new URLSearchParams();
    if (returnTo) params.set('returnTo', returnTo);
    const queryString = params.toString();
    navigate(`/league/${leagueId}/threshold-chart-db/${chartType}${queryString ? `?${queryString}` : ''}`);
  };

  // Navigation
  const backTo = returnTo || (leagueId ? `/league/${leagueId}` : '/');
  const backLabel = returnTo?.includes('match') ? 'Back to Match' : 'Back to League';

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
  if (defaultChartError) {
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
        subtitle="Configure games-to-win thresholds for teams using percentage-style handicaps"
      />

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Database Status Card */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-700">
                <Database className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {hasLeagueChart ? (
                    'Using league-specific chart'
                  ) : isUsingGlobalTemplate ? (
                    'Using global template (read-only until customized)'
                  ) : defaultChart ? (
                    'Using organization default'
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
                  disabled={isCopying}
                  className="h-7 text-xs"
                >
                  {isCopying ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Copy className="h-3 w-3 mr-1" />
                  )}
                  Create League Copy
                </Button>
              )}
            </div>
            {defaultChart && (
              <p className="text-xs text-blue-600 mt-1">
                Chart: {defaultChart.name} ({defaultChart.entity_type})
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

      {/* Save Chart Modal - shown when creating a new league chart */}
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
