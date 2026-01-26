/**
 * @fileoverview Database Status Card Component for Threshold Chart Editors
 *
 * Displays the current chart status (season-specific, global template, or default)
 * and provides a "Create Season Copy" button when using a global template.
 *
 * This component is shared across all threshold chart editor pages (Points,
 * Percentage, and Race) to reduce code duplication.
 *
 * @example
 * ```tsx
 * <DatabaseStatusCard
 *   hasSeasonChart={true}
 *   isUsingGlobalTemplate={false}
 *   activeChart={chartData}
 *   globalTemplates={templates}
 *   onCopyTemplate={handleCopy}
 *   isCopying={false}
 * />
 * ```
 */

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Database, Copy } from 'lucide-react';
import type { ThresholdChart } from '@/api/queries/thresholdCharts';

/**
 * Props for the DatabaseStatusCard component
 */
export interface DatabaseStatusCardProps {
  /** Whether the season has its own dedicated chart (not inherited) */
  hasSeasonChart: boolean;

  /** Whether the current chart is from a global template (read-only until copied) */
  isUsingGlobalTemplate: boolean;

  /** The currently active chart (season-specific, default, or global template) */
  activeChart: ThresholdChart | null | undefined;

  /** List of available global templates for the current chart type */
  globalTemplates: ThresholdChart[] | undefined;

  /** Callback when user clicks "Create Season Copy" to copy a global template */
  onCopyTemplate: (templateId: string) => void;

  /** Whether a copy operation is currently in progress */
  isCopying: boolean;
}

/**
 * Database Status Card for Threshold Chart Editors
 *
 * Shows which chart is currently being used and provides actions based on
 * the chart's ownership status:
 *
 * - **Season-specific chart**: Editable, no actions needed
 * - **Global template**: Read-only, shows "Create Season Copy" button
 * - **Default chart**: Shows which level (league/org) the default is from
 * - **No chart**: Indicates hardcoded defaults are being used
 *
 * This visual feedback helps operators understand whether they're editing
 * a chart that will persist to their season or viewing a template.
 */
export function DatabaseStatusCard({
  hasSeasonChart,
  isUsingGlobalTemplate,
  activeChart,
  globalTemplates,
  onCopyTemplate,
  isCopying,
}: DatabaseStatusCardProps) {
  /**
   * Determine the status message to display based on chart ownership
   */
  const getStatusMessage = (): string => {
    if (hasSeasonChart) {
      return 'Using season-specific chart';
    }
    if (isUsingGlobalTemplate) {
      return 'Using global template (read-only until customized)';
    }
    if (activeChart) {
      return `Using ${activeChart.entity_type} default`;
    }
    return 'No chart found - using hardcoded defaults';
  };

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardContent className="py-3">
        {/* Main status row with icon, message, and optional action button */}
        <div className="flex items-center justify-between">
          {/* Status indicator with database icon */}
          <div className="flex items-center gap-2 text-blue-700">
            <Database className="h-4 w-4" />
            <span className="text-sm font-medium">{getStatusMessage()}</span>
          </div>

          {/* "Create Season Copy" button - only shown when using global template */}
          {isUsingGlobalTemplate && globalTemplates && globalTemplates.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCopyTemplate(globalTemplates[0].id)}
              disabled={isCopying}
              className="h-7 text-xs"
            >
              {isCopying ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Copy className="h-3 w-3 mr-1" />
              )}
              Create Season Copy
            </Button>
          )}
        </div>

        {/* Chart name and entity type - shown when a chart is loaded */}
        {activeChart && (
          <p className="text-xs text-blue-600 mt-1">
            Chart: {activeChart.name} ({activeChart.entity_type})
          </p>
        )}
      </CardContent>
    </Card>
  );
}
