/**
 * @fileoverview Database-Backed Race Threshold Chart Editor Page
 *
 * Full-page editor for race-based threshold charts using database storage.
 * Season-based: the chart is stored on and linked to a specific season.
 * Race charts are for individual player vs player matchups.
 *
 * Route: /league/:leagueId/season/:seasonId/threshold-chart/race
 * Query params: ?raceType=points | ?raceType=percentage
 *
 * This page handles BOTH race_points AND race_percentage chart types via
 * the raceType query parameter. This avoids duplicating the race-specific logic.
 *
 * Data flow:
 * 1. Load season to get threshold_chart_id and league_id
 * 2. If season has threshold_chart_id → load that specific chart
 * 3. If season has no chart (null) → load league/org/global default for display
 * 4. On save → create/update chart AND link it to the season via threshold_chart_id
 *
 * Key features:
 * - 2D matrix lookup (player 1 handicap vs player 2 handicap)
 * - Supports both points (race_points) and percentage (race_percentage) formats
 *
 * Back navigation always returns to the match list page.
 */

import { useCallback } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import {
  RaceThresholdChartEditor,
  ChartTypeSelector,
  SaveChartModal,
  DatabaseStatusCard,
  ThresholdChartPageLayout,
  useThresholdChartPage,
  getDefaultRacePointsChartRows,
  getDefaultRaceMatrixPercentageChartRows,
  type RaceChartRow,
  type RaceChartType,
  type DbRowFormat,
} from '@/components/operator/threshold-editor';
import type { ThresholdChartWithRows, ThresholdChartType } from '@/api/hooks';

/**
 * Convert database chart rows to editor format for race charts
 *
 * DB format: comp_1 (player1 handicap), comp_2 (player2 handicap),
 *            result_1 (player1 wins), result_3 (player2 wins)
 * Editor format: player1Handicap, player2Handicap, player1Wins, player2Wins
 *
 * @param dbRows - Rows from the database in threshold_chart_rows format
 * @returns Rows formatted for the RaceThresholdChartEditor
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
 *
 * Editor format: player1Handicap, player2Handicap, player1Wins, player2Wins
 * DB format: comp_1 (player1), comp_2 (player2), result_1 (p1 wins), result_2 (null), result_3 (p2 wins)
 *
 * @param editorRows - Rows from the editor in RaceChartRow format
 * @returns Rows formatted for database insertion
 */
function editorRowsToDbRows(editorRows: RaceChartRow[]): DbRowFormat[] {
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
 *
 * @param raceType - 'points' or 'percentage' from the URL query param
 * @returns The corresponding database chart type
 */
function raceChartTypeToDbType(raceType: RaceChartType): ThresholdChartType {
  return raceType === 'percentage' ? 'race_percentage' : 'race_points';
}

/**
 * Get default rows based on race chart type
 *
 * @param raceType - 'points' or 'percentage'
 * @returns Default chart rows for the specified type
 */
function getDefaultRowsForRaceType(raceType: RaceChartType): RaceChartRow[] {
  return raceType === 'percentage'
    ? getDefaultRaceMatrixPercentageChartRows()
    : getDefaultRacePointsChartRows();
}

/**
 * Database-Backed Race Threshold Chart Editor Page
 *
 * Handles both race_points and race_percentage chart types via URL query param.
 * Uses the shared useThresholdChartPage hook for common logic, with additional
 * handling for the race type sub-selection.
 *
 * Reduced from ~435 lines to ~120 lines by extracting shared logic.
 */
export default function DbRaceThresholdChartPage() {
  const { leagueId, seasonId } = useParams<{ leagueId: string; seasonId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Get race chart sub-type from query string (points vs percentage)
  const raceTypeParam = searchParams.get('raceType') as RaceChartType | null;
  const raceChartType: RaceChartType = raceTypeParam ?? 'points';

  // Determine the database chart type based on race chart type
  const dbChartType = raceChartTypeToDbType(raceChartType);

  // Use the shared hook with race-specific configuration
  // Note: We create a getDefaultRows function that uses the current raceChartType
  const page = useThresholdChartPage<RaceChartRow>({
    chartType: dbChartType,
    dbRowsToEditor: dbRowsToEditorRows,
    editorRowsToDb: editorRowsToDbRows,
    getDefaultRows: () => getDefaultRowsForRaceType(raceChartType),
  });

  /**
   * Handle race chart sub-type change (points vs percentage)
   * Updates the URL query param to switch between race_points and race_percentage
   */
  const handleRaceChartTypeChange = useCallback(
    (newRaceType: RaceChartType) => {
      if (!leagueId || !seasonId) return;
      navigate(`/league/${leagueId}/season/${seasonId}/threshold-chart/race?raceType=${newRaceType}`);
    },
    [leagueId, seasonId, navigate]
  );

  return (
    <ThresholdChartPageLayout {...page.layoutProps}>
      {/* Database Status Card - shows chart ownership and copy option */}
      <DatabaseStatusCard {...page.statusCardProps} />

      {/* Chart Type Selector - allows switching to other chart types AND race sub-types */}
      <ChartTypeSelector
        currentType="race"
        raceChartType={raceChartType}
        onChartTypeChange={page.handleChartTypeChange}
        onRaceChartTypeChange={handleRaceChartTypeChange}
        hasUnsavedChanges={page.hasUnsavedChanges}
      />

      {/* Race-specific Chart Editor */}
      <RaceThresholdChartEditor
        initialData={page.chartRows}
        onSave={page.handleEditorSave}
        onCancel={page.handleCancel}
        isSaving={page.isSaving}
        raceChartType={raceChartType}
        onUnsavedChangesChange={page.setHasUnsavedChanges}
      />

      {/* Save Chart Modal - shown when creating a new season chart */}
      <SaveChartModal
        open={page.showSaveModal}
        onOpenChange={page.setShowSaveModal}
        onSave={page.handleModalSave}
        isSaving={page.isSaving}
        chartTypeLabel={`Race ${raceChartType === 'percentage' ? 'Percentage' : 'Points'}`}
      />
    </ThresholdChartPageLayout>
  );
}
