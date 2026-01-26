/**
 * @fileoverview Threshold Chart Editor Components
 *
 * Dedicated editors for different threshold chart types.
 * Each chart type has its own editor due to fundamental structural differences.
 *
 * Chart Types:
 * - Points: Exact diff lookup (-12 to +12), has ties on even diffs
 * - Percentage: Range-based lookup (0-14, 15-40, etc.), no ties
 * - Race: Player vs player 2D matrix lookup (no ties)
 *
 * Shared Components:
 * - ThresholdChartPageLayout: Common page shell (loading, error, header)
 * - DatabaseStatusCard: Shows chart ownership status and copy action
 * - useThresholdChartPage: Custom hook with shared page logic
 */

// === Editor Components ===
export {
  PointsThresholdChartEditor,
  getDefaultPointsChartRows,
  type PointsChartRow,
  type ChartType,
} from './PointsThresholdChartEditor';

export {
  PercentageThresholdChartEditor,
  getDefaultPercentageChartRows,
  type PercentageChartRow,
} from './PercentageThresholdChartEditor';

export {
  RaceThresholdChartEditor,
  getDefaultRacePointsChartRows,
  getDefaultRaceMatrixPercentageChartRows,
  generateRaceChartRows,
  generateRacePercentageChartRowsWithGap,
  calculateRaceLengths,
  calculateRaceLengthRange,
  type RaceChartRow,
  type RaceChartType,
} from './RaceThresholdChartEditor';

export {
  RacePercentageThresholdChartEditor,
  getDefaultRacePercentageChartRows,
  generateRacePercentageChartRows,
  calculateRacePercentageLengthRange,
  type RacePercentageChartRow,
} from './RacePercentageThresholdChartEditor';

// === UI Components ===
export {
  ChartTypeSelector,
  type ChartEditorType,
  type RaceChartType as ChartRaceType,
} from './ChartTypeSelector';

export {
  SaveChartModal,
  type SaveChartData,
} from './SaveChartModal';

// === Shared Page Components ===
export { DatabaseStatusCard, type DatabaseStatusCardProps } from './DatabaseStatusCard';

export {
  ThresholdChartPageLayout,
  type ThresholdChartPageLayoutProps,
} from './ThresholdChartPageLayout';

// === Custom Hook ===
export {
  useThresholdChartPage,
  type UseThresholdChartPageConfig,
  type UseThresholdChartPageResult,
  type DbRowFormat,
} from './useThresholdChartPage';
