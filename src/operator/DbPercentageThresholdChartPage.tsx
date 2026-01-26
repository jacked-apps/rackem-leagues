/**
 * @fileoverview Database-Backed Percentage Threshold Chart Editor Page
 *
 * Full-page editor for percentage-based threshold charts using database storage.
 * Season-based: the chart is stored on and linked to a specific season.
 *
 * Route: /league/:leagueId/season/:seasonId/threshold-chart/percentage
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
 * Percentage charts use range-based lookup (VLOOKUP style) rather than exact match.
 * Back navigation always returns to the match list page.
 */

import {
  PercentageThresholdChartEditor,
  ChartTypeSelector,
  SaveChartModal,
  DatabaseStatusCard,
  ThresholdChartPageLayout,
  useThresholdChartPage,
  getDefaultPercentageChartRows,
  type PercentageChartRow,
  type DbRowFormat,
} from '@/components/operator/threshold-editor';
import type { ThresholdChartWithRows } from '@/api/hooks';

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
 *
 * @param dbRows - Rows from the database in threshold_chart_rows format
 * @returns Rows formatted for the PercentageThresholdChartEditor
 */
function dbRowsToEditorRows(dbRows: ThresholdChartWithRows['rows']): PercentageChartRow[] {
  // Sort by sort_order to ensure proper ordering
  const sortedRows = [...dbRows].sort((a, b) => a.sort_order - b.sort_order);

  return sortedRows.map((row, idx) => {
    // For percentage charts, comp_2 stores maxDiff
    // If comp_2 is null, derive maxDiff from next row's comp_1 - 1
    const nextRow = sortedRows[idx + 1];
    const maxDiff =
      row.comp_2 !== null ? row.comp_2 : nextRow ? nextRow.comp_1 - 1 : 999; // Last row goes to infinity

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
 *
 * Editor format: minDiff, maxDiff, higherWins, lowerWins
 * DB format: comp_1 (minDiff), comp_2 (maxDiff), result_1 (higherWins), result_2 (null), result_3 (lowerWins)
 *
 * @param editorRows - Rows from the editor in PercentageChartRow format
 * @returns Rows formatted for database insertion
 */
function editorRowsToDbRows(editorRows: PercentageChartRow[]): DbRowFormat[] {
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
 * Uses the shared useThresholdChartPage hook for all common logic.
 * Only defines the chart-type-specific conversion functions and
 * renders the Percentage-specific editor component.
 *
 * Reduced from ~416 lines to ~80 lines by extracting shared logic.
 */
export default function DbPercentageThresholdChartPage() {
  // Use the shared hook with percentage-specific configuration
  const page = useThresholdChartPage<PercentageChartRow>({
    chartType: 'team_percentage',
    dbRowsToEditor: dbRowsToEditorRows,
    editorRowsToDb: editorRowsToDbRows,
    getDefaultRows: getDefaultPercentageChartRows,
  });

  return (
    <ThresholdChartPageLayout {...page.layoutProps}>
      {/* Database Status Card - shows chart ownership and copy option */}
      <DatabaseStatusCard {...page.statusCardProps} />

      {/* Chart Type Selector - allows switching to other chart types */}
      <ChartTypeSelector
        currentType="percentage"
        onChartTypeChange={page.handleChartTypeChange}
        hasUnsavedChanges={page.hasUnsavedChanges}
      />

      {/* Percentage-specific Chart Editor */}
      <PercentageThresholdChartEditor
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
