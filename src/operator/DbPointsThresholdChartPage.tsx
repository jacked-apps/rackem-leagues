/**
 * @fileoverview Database-Backed Points Threshold Chart Editor Page
 *
 * Full-page editor for points-based threshold charts using database storage.
 * This is the database-backed version of PointsThresholdChartPage.
 *
 * Route: /league/:leagueId/threshold-chart-db/points
 *
 * Key differences from the localStorage version:
 * - Loads chart data from threshold_charts and threshold_chart_rows tables
 * - Can use global templates, organization defaults, or league-specific charts
 * - Saves changes to database via mutation hooks
 * - Supports copying global templates to create league-specific charts
 *
 * The SetupOptions component at the top shows the current configuration
 * and allows adjustments that affect the chart (lineup size, handicap type, etc.)
 */

import { useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Database, Copy, AlertCircle } from 'lucide-react';
import {
  PointsThresholdChartEditor,
  ChartTypeSelector,
  SaveChartModal,
  getDefaultPointsChartRows,
  type PointsChartRow,
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
 * Convert database chart rows to editor format
 *
 * DB format: comp_1 (diff), result_1 (win), result_2 (tie), result_3 (lose)
 * Editor format: diff, win, tie, lose
 */
function dbRowsToEditorRows(dbRows: ThresholdChartWithRows['rows']): PointsChartRow[] {
  return dbRows.map((row) => ({
    diff: row.comp_1,
    win: row.result_1,
    tie: row.result_2,
    lose: row.result_3,
  }));
}

/**
 * Convert editor format rows to database format
 */
function editorRowsToDbRows(
  editorRows: PointsChartRow[]
): Array<{
  comp_1: number;
  comp_2: number | null;
  result_1: number;
  result_2: number | null;
  result_3: number;
  sort_order: number;
}> {
  return editorRows.map((row, idx) => ({
    comp_1: row.diff,
    comp_2: null, // Team charts don't use comp_2
    result_1: row.win ?? 0,
    result_2: row.tie ?? null,
    result_3: row.lose ?? 0,
    sort_order: idx,
  }));
}

/**
 * Database-Backed Points Threshold Chart Editor Page
 *
 * Loads charts from database and saves changes via mutations.
 */
export default function DbPointsThresholdChartPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Get params from query string
  const returnTo = searchParams.get('returnTo');

  // Track unsaved changes from the editor (for navigation warning)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Modal state for saving new charts
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [pendingChartData, setPendingChartData] = useState<PointsChartRow[] | null>(null);

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
    'team_points',
    league?.organization_id
  );

  // Fetch league's own charts (to check if they have a custom one)
  const { data: leagueCharts, isLoading: isLeagueChartsLoading } = useLeagueThresholdCharts(
    leagueId,
    'team_points'
  );

  // Fetch global templates (for copy option)
  const { data: globalTemplates } = useGlobalThresholdCharts('team_points');

  // Mutations
  const { mutate: createChart, isPending: isCreating } = useCreateThresholdChart();
  const { mutate: replaceRows, isPending: isReplacing } = useReplaceThresholdChartRows();
  const { mutate: copyGlobalChart, isPending: isCopying } = useCopyGlobalChartToLeague();

  // Track the active chart (league-specific or inherited)
  // Note: defaultChart already includes rows via getDefaultThresholdChart which fetches with rows
  // The defaultChart follows the hierarchy: league → org → global, so if league has a chart, it returns that
  const hasLeagueChart = leagueCharts && leagueCharts.length > 0;
  const isUsingGlobalTemplate = !hasLeagueChart && defaultChart?.entity_type === 'global';

  // Convert DB rows to editor format
  // Use defaultChart which already has rows loaded
  const chartRows = useMemo(() => {
    if (defaultChart?.rows && defaultChart.rows.length > 0) {
      return dbRowsToEditorRows(defaultChart.rows);
    }
    return getDefaultPointsChartRows();
  }, [defaultChart]);

  // Loading state
  const isLoading = isLeagueLoading || isDefaultChartLoading || isLeagueChartsLoading;
  const isSaving = isCreating || isReplacing || isCopying;

  /**
   * Handle save from editor - shows modal if creating new chart
   */
  const handleEditorSave = (data: PointsChartRow[]) => {
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
        chart_type: 'team_points',
        lookup_mode: 'exact',
        name: saveData.name,
        description: saveData.description,
        is_default: true,
      },
      {
        onSuccess: (newChart) => {
          // Save the rows to the new chart
          replaceRows({
            chartId: newChart.id,
            rows: editorRowsToDbRows(pendingChartData),
          });
          // Close modal and clear pending data
          setShowSaveModal(false);
          setPendingChartData(null);
        },
      }
    );
  };

  /**
   * Handle copying a global template to create a league chart
   */
  const handleCopyTemplate = (templateId: string) => {
    if (!leagueId) return;

    copyGlobalChart({
      globalChartId: templateId,
      leagueId,
      name: 'League Points Chart',
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

  // Determine back navigation
  const backTo = returnTo || (leagueId ? `/league/${leagueId}` : '/');
  const backLabel = returnTo?.includes('match') ? 'Back to Match' : 'Back to League';

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader
          backTo={backTo}
          backLabel={backLabel}
          title="Threshold Chart Editor (Team/Points)"
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
          title="Threshold Chart Editor (Team/Points)"
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
        title="Threshold Chart Editor (Team/Points)"
        subtitle="Configure games-to-win thresholds for teams using points-style handicaps"
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
                  ) : (
                    'Using organization default'
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
          currentType="points"
          onChartTypeChange={handleChartTypeChange}
          hasUnsavedChanges={hasUnsavedChanges}
        />

        {/* Chart Editor */}
        <PointsThresholdChartEditor
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
        chartTypeLabel="Points"
      />
    </div>
  );
}
