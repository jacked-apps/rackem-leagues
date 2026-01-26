/**
 * @fileoverview Threshold Chart Constants and Type Metadata
 *
 * Centralizes all threshold chart type configuration in one place.
 * This eliminates duplication of chart type labels, lookup modes, and
 * other metadata across the editor pages.
 *
 * Chart Types:
 * - team_points: Team format with point handicaps (exact lookup)
 * - team_percentage: Team format with percentage handicaps (range lookup)
 * - race_points: Individual race with point handicaps (exact lookup)
 * - race_percentage: Individual race with percentage handicaps (exact lookup)
 */

import type { ThresholdChartType, ThresholdLookupMode } from '@/api/queries/thresholdCharts';

/**
 * Metadata for a threshold chart type
 *
 * Contains all the configuration needed to properly display and
 * process a specific chart type.
 */
export interface ThresholdChartTypeConfig {
  /** Human-readable short label (e.g., "Points", "Percentage") */
  label: string;

  /** Full title for the page header (e.g., "Team/Points", "Individual/Percentage") */
  title: string;

  /** How rows are matched: 'exact' for direct match, 'range' for VLOOKUP-style */
  lookupMode: ThresholdLookupMode;

  /** Content max-width: '3xl' for team charts, '4xl' for race charts (more columns) */
  maxWidth: '3xl' | '4xl';

  /** Whether this is a team format (vs individual race format) */
  isTeamFormat: boolean;
}

/**
 * Configuration for all threshold chart types
 *
 * This is the single source of truth for chart type metadata.
 * Use this when rendering UI or determining chart behavior.
 *
 * @example
 * ```ts
 * const config = THRESHOLD_CHART_TYPES['team_points'];
 * console.log(config.label); // "Points"
 * console.log(config.lookupMode); // "exact"
 * ```
 */
export const THRESHOLD_CHART_TYPES: Record<ThresholdChartType, ThresholdChartTypeConfig> = {
  team_points: {
    label: 'Points',
    title: 'Team/Points',
    lookupMode: 'exact',
    maxWidth: '3xl',
    isTeamFormat: true,
  },
  team_percentage: {
    label: 'Percentage',
    title: 'Team/Percentage',
    lookupMode: 'range',
    maxWidth: '3xl',
    isTeamFormat: true,
  },
  race_points: {
    label: 'Race Points',
    title: 'Individual/Points',
    lookupMode: 'exact',
    maxWidth: '4xl',
    isTeamFormat: false,
  },
  race_percentage: {
    label: 'Race Percentage',
    title: 'Individual/Percentage',
    lookupMode: 'exact',
    maxWidth: '4xl',
    isTeamFormat: false,
  },
} as const;

/**
 * Get the configuration for a chart type
 *
 * @param chartType - The database chart type
 * @returns Configuration object for the chart type
 */
export function getChartTypeConfig(chartType: ThresholdChartType): ThresholdChartTypeConfig {
  return THRESHOLD_CHART_TYPES[chartType];
}

/**
 * Get the page title for a chart type
 *
 * @param chartType - The database chart type
 * @returns Full page title string
 *
 * @example
 * ```ts
 * getChartPageTitle('team_points');
 * // Returns: "Threshold Chart Editor (Team/Points)"
 * ```
 */
export function getChartPageTitle(chartType: ThresholdChartType): string {
  const config = THRESHOLD_CHART_TYPES[chartType];
  return `Threshold Chart Editor (${config.title})`;
}

/**
 * Get the chart label for the save modal
 *
 * @param chartType - The database chart type
 * @returns Label string for use in the save modal
 */
export function getChartTypeLabel(chartType: ThresholdChartType): string {
  return THRESHOLD_CHART_TYPES[chartType].label;
}
