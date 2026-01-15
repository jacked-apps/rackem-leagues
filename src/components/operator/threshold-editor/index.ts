/**
 * @fileoverview Threshold Chart Editor Components
 *
 * Dedicated editors for different threshold chart types.
 * Each chart type has its own editor due to fundamental structural differences.
 *
 * Chart Types:
 * - Points: Exact diff lookup (-12 to +12), has ties on even diffs
 * - Percentage: Range-based lookup (0-14, 15-40, etc.), no ties
 * - PvP Race: Player vs player race format (future)
 */

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
