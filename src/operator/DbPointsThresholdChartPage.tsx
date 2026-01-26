/**
 * @fileoverview Database-Backed Points Threshold Chart Editor Page
 *
 * Full-page editor for points-based threshold charts using database storage.
 * Season-based: the chart is stored on and linked to a specific season.
 *
 * Route: /league/:leagueId/season/:seasonId/threshold-chart/points
 *
 * This page uses the shared useThresholdChartPage hook for all common logic.
 * Only chart-type-specific conversions and the editor component are defined here.
 *
 * Data flow:
 * 1. Load season to get threshold_chart_id and league_id
 * 2. If season has threshold_chart_id → load that specific chart
 * 3. If season has no chart (null) → load league/org/global default for display
 * 4. On save → create/update chart AND link it to the season via threshold_chart_id
 *
 * Back navigation always returns to the match list page.
 */

import {
  PointsThresholdChartEditor,
  ChartTypeSelector,
  SaveChartModal,
  DatabaseStatusCard,
  ThresholdChartPageLayout,
  useThresholdChartPage,
  getDefaultPointsChartRows,
  type PointsChartRow,
  type DbRowFormat,
} from '@/components/operator/threshold-editor';
import type { ThresholdChartWithRows } from '@/api/hooks';

/**
 * Convert database chart rows to editor format
 *
 * DB format: comp_1 (diff), result_1 (win), result_2 (tie), result_3 (lose)
 * Editor format: diff, win, tie, lose
 *
 * @param dbRows - Rows from the database in threshold_chart_rows format
 * @returns Rows formatted for the PointsThresholdChartEditor
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
 *
 * Editor format: diff, win, tie, lose
 * DB format: comp_1 (diff), comp_2 (null for team), result_1 (win), result_2 (tie), result_3 (lose)
 *
 * @param editorRows - Rows from the editor in PointsChartRow format
 * @returns Rows formatted for database insertion
 */
function editorRowsToDbRows(editorRows: PointsChartRow[]): DbRowFormat[] {
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
 * Uses the shared useThresholdChartPage hook for all common logic.
 * Only defines the chart-type-specific conversion functions and
 * renders the Points-specific editor component.
 *
 * Reduced from ~395 lines to ~80 lines by extracting shared logic.
 */
export default function DbPointsThresholdChartPage() {
  // Use the shared hook with points-specific configuration
  const page = useThresholdChartPage<PointsChartRow>({
    chartType: 'team_points',
    dbRowsToEditor: dbRowsToEditorRows,
    editorRowsToDb: editorRowsToDbRows,
    getDefaultRows: getDefaultPointsChartRows,
  });

  return (
    <ThresholdChartPageLayout {...page.layoutProps}>
      {/* Database Status Card - shows chart ownership and copy option */}
      <DatabaseStatusCard {...page.statusCardProps} />

      {/* Chart Type Selector - allows switching to other chart types */}
      <ChartTypeSelector
        currentType="points"
        onChartTypeChange={page.handleChartTypeChange}
        hasUnsavedChanges={page.hasUnsavedChanges}
      />

      {/* Points-specific Chart Editor */}
      <PointsThresholdChartEditor
        initialData={page.chartRows}
        onSave={page.handleEditorSave}
        onCancel={page.handleCancel}
        isSaving={page.isSaving}
        onUnsavedChangesChange={page.setHasUnsavedChanges}
      />

      {/* Save Chart Modal - shown when creating a new season chart */}
      <SaveChartModal
        open={page.showSaveModal}
        onOpenChange={page.setShowSaveModal}
        onSave={page.handleModalSave}
        isSaving={page.isSaving}
        chartTypeLabel={page.chartTypeLabel}
      />
    </ThresholdChartPageLayout>
  );
}
