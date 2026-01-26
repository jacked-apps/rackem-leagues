/**
 * @fileoverview Database-Backed Race Threshold Chart Editor Page
 *
 * Full-page editor for race-based threshold charts using database storage.
 * Race charts are for individual player vs player matchups.
 *
 * Route: /league/:leagueId/threshold-chart-db/race
 *
 * Key features:
 * - 2D matrix lookup (player 1 handicap vs player 2 handicap)
 * - Supports both points (race_points) and percentage (race_percentage) formats
 * - Loads chart data from threshold_charts and threshold_chart_rows tables
 * - Saves changes to database via mutation hooks
 * - Supports copying global templates to create league-specific charts
 */

import { useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Database, Copy, AlertCircle } from 'lucide-react';
import {
  RaceThresholdChartEditor,
  ChartTypeSelector,
  SaveChartModal,
  getDefaultRacePointsChartRows,
  getDefaultRaceMatrixPercentageChartRows,
  type RaceChartRow,
  type RaceChartType,
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
  type ThresholdChartType,
} from '@/api/hooks';
import { useLeagueById } from '@/api/hooks/useLeagues';

/**
 * Convert database chart rows to editor format for race charts
 *
 * DB format: comp_1 (player1 handicap), comp_2 (player2 handicap),
 *            result_1 (player1 wins), result_3 (player2 wins)
 * Editor format: player1Handicap, player2Handicap, player1Wins, player2Wins
 */
function dbRowsToEditorRows(dbRows: ThresholdChartWithRows['rows']): RaceChartRow[] {
  return dbRows.map((row) => ({
    player1Handicap: row.comp_1,
    player2Handicap: row.comp_2 ?? row.comp_1, // For equal handicaps, comp_2 might equal comp_1
    player1Wins: row.result_1,
    player2Wins: row.result_3,
  }));
}

/**
 * Convert editor format rows to database format
 */
function editorRowsToDbRows(
  editorRows: RaceChartRow[]
): Array<{
  comp_1: number;
  comp_2: number | null;
  result_1: number;
  result_2: number | null;
  result_3: number;
  sort_order: number;
}> {
  return editorRows.map((row, idx) => ({
    comp_1: row.player1Handicap,
    comp_2: row.player2Handicap,
    result_1: row.player1Wins ?? 0,
    result_2: null, // Race charts don't have ties
    result_3: row.player2Wins ?? 0,
    sort_order: idx,
  }));
}

/**
 * Map race chart type to database chart type
 */
function raceChartTypeToDbType(raceType: RaceChartType): ThresholdChartType {
  return raceType === 'percentage' ? 'race_percentage' : 'race_points';
}

/**
 * Database-Backed Race Threshold Chart Editor Page
 */
export default function DbRaceThresholdChartPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Get params from query string
  const returnTo = searchParams.get('returnTo');
  const raceTypeParam = searchParams.get('raceType') as RaceChartType | null;

  // Race chart type - determined from URL params, defaults to 'points'
  const raceChartType: RaceChartType = raceTypeParam ?? 'points';

  // Track unsaved changes from the editor (for navigation warning)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Modal state for saving new charts
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [pendingChartData, setPendingChartData] = useState<RaceChartRow[] | null>(null);

  // Fetch league to get organization ID for fallback lookup
  const { data: league, isLoading: isLeagueLoading } = useLeagueById(leagueId);

  // Determine the database chart type based on race chart type
  const dbChartType = raceChartTypeToDbType(raceChartType);

  // Fetch charts from database
  const {
    data: defaultChart,
    isLoading: isDefaultChartLoading,
    error: defaultChartError,
  } = useDefaultThresholdChart('league', leagueId, dbChartType, league?.organization_id);

  // Fetch league's own charts
  const { data: leagueCharts, isLoading: isLeagueChartsLoading } = useLeagueThresholdCharts(
    leagueId,
    dbChartType
  );

  // Fetch global templates
  const { data: globalTemplates } = useGlobalThresholdCharts(dbChartType);

  // Mutations
  const { mutate: createChart, isPending: isCreating } = useCreateThresholdChart();
  const { mutate: replaceRows, isPending: isReplacing } = useReplaceThresholdChartRows();
  const { mutate: copyGlobalChart, isPending: isCopying } = useCopyGlobalChartToLeague();

  // Track the active chart
  const hasLeagueChart = leagueCharts && leagueCharts.length > 0;
  const isUsingGlobalTemplate = !hasLeagueChart && defaultChart?.entity_type === 'global';

  // Get default rows based on race chart type
  const getDefaultRows = () => {
    return raceChartType === 'percentage'
      ? getDefaultRaceMatrixPercentageChartRows()
      : getDefaultRacePointsChartRows();
  };

  // Convert DB rows to editor format
  const chartRows = useMemo(() => {
    if (defaultChart?.rows && defaultChart.rows.length > 0) {
      return dbRowsToEditorRows(defaultChart.rows);
    }
    return getDefaultRows();
  }, [defaultChart, raceChartType]);

  // Loading state
  const isLoading = isLeagueLoading || isDefaultChartLoading || isLeagueChartsLoading;
  const isSaving = isCreating || isReplacing || isCopying;

  /**
   * Handle save from editor - shows modal if creating new chart
   */
  const handleEditorSave = (data: RaceChartRow[]) => {
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
        chart_type: dbChartType,
        lookup_mode: 'exact', // Race charts use exact lookup by handicap pair
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
   * Handle copying a global template to create a league chart
   */
  const handleCopyTemplate = (templateId: string) => {
    if (!leagueId) return;

    copyGlobalChart({
      globalChartId: templateId,
      leagueId,
      name: `League Race ${raceChartType === 'percentage' ? 'Percentage' : 'Points'} Chart`,
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

  /**
   * Handle race chart sub-type change (points vs percentage)
   * Updates the URL query param to switch between race_points and race_percentage
   */
  const handleRaceChartTypeChange = (newRaceType: RaceChartType) => {
    if (!leagueId) return;
    const params = new URLSearchParams();
    if (returnTo) params.set('returnTo', returnTo);
    params.set('raceType', newRaceType);
    navigate(`/league/${leagueId}/threshold-chart-db/race?${params.toString()}`);
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
          title={`Threshold Chart Editor (Individual/${raceChartType === 'percentage' ? 'Percentage' : 'Points'})`}
          subtitle="Loading chart data..."
        />
        <div className="max-w-4xl mx-auto px-4 py-6">
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
          title={`Threshold Chart Editor (Individual/${raceChartType === 'percentage' ? 'Percentage' : 'Points'})`}
          subtitle="Error loading chart"
        />
        <div className="max-w-4xl mx-auto px-4 py-6">
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
        title={`Threshold Chart Editor (Individual/${raceChartType === 'percentage' ? 'Percentage' : 'Points'})`}
        subtitle="Configure race lengths for individual player matchups based on handicaps"
      />

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
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
                    'No chart found - using defaults'
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
          currentType="race"
          raceChartType={raceChartType}
          onChartTypeChange={handleChartTypeChange}
          onRaceChartTypeChange={handleRaceChartTypeChange}
          hasUnsavedChanges={hasUnsavedChanges}
        />

        {/* Chart Editor */}
        <RaceThresholdChartEditor
          initialData={chartRows}
          onSave={handleEditorSave}
          onCancel={handleCancel}
          isSaving={isSaving}
          raceChartType={raceChartType}
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
        chartTypeLabel={`Race ${raceChartType === 'percentage' ? 'Percentage' : 'Points'}`}
      />
    </div>
  );
}
