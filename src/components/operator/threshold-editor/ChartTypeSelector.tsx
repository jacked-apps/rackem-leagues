/**
 * @fileoverview Chart Type Selector Component
 *
 * Universal navigation component for switching between threshold chart editor types.
 * Uses two dimensions to select one of four chart types:
 *
 * Match Type × Handicap Format = Chart Type
 * - Team + Points = team_points (exact lookup)
 * - Team + Percentage = team_percentage (range lookup)
 * - Individual Race + Points = race_points (exact lookup)
 * - Individual Race + Percentage = race_percentage (range lookup)
 *
 * Used on all threshold chart editor pages.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { InfoButton } from '@/components/InfoButton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

/**
 * Match type dimension
 */
export type MatchType = 'team' | 'race';

/**
 * Handicap format dimension
 */
export type HandicapFormat = 'points' | 'percentage';

/**
 * Legacy chart editor type - maps to the 4 page routes
 * @deprecated Use MatchType + HandicapFormat instead
 */
export type ChartEditorType = 'points' | 'percentage' | 'race';

/**
 * For race charts, there's an additional sub-type (points-based or percentage-based races)
 * @deprecated Use HandicapFormat instead
 */
export type RaceChartType = 'points' | 'percentage';

interface ChartTypeSelectorProps {
  /** Currently selected chart type (legacy) */
  currentType: ChartEditorType;
  /** For race charts, the sub-type (points or percentage based) */
  raceChartType?: RaceChartType;
  /** Callback when chart type changes - typically navigates to different page */
  onChartTypeChange: (chartType: ChartEditorType) => void;
  /** For race charts, callback when race sub-type changes */
  onRaceChartTypeChange?: (raceType: RaceChartType) => void;
  /** Whether to show the selector expanded by default */
  defaultExpanded?: boolean;
  /** Whether there are unsaved changes in the current chart editor */
  hasUnsavedChanges?: boolean;
}

/**
 * Derive match type from legacy chart type
 */
function getMatchType(chartType: ChartEditorType): MatchType {
  return chartType === 'race' ? 'race' : 'team';
}

/**
 * Derive handicap format from legacy types
 */
function getHandicapFormat(chartType: ChartEditorType, raceChartType?: RaceChartType): HandicapFormat {
  if (chartType === 'race') {
    return raceChartType === 'percentage' ? 'percentage' : 'points';
  }
  return chartType === 'percentage' ? 'percentage' : 'points';
}

/**
 * Convert match type + handicap format back to legacy types
 */
function toLegacyTypes(
  matchType: MatchType,
  handicapFormat: HandicapFormat
): { chartType: ChartEditorType; raceChartType?: RaceChartType } {
  if (matchType === 'race') {
    return { chartType: 'race', raceChartType: handicapFormat };
  }
  return { chartType: handicapFormat };
}

/**
 * Chart Type Selector
 *
 * Allows selection between the 4 threshold chart types using two dimensions:
 * - Match Type: Team vs Individual Race
 * - Handicap Format: Points (exact) vs Percentage (range)
 */
export function ChartTypeSelector({
  currentType,
  raceChartType = 'points',
  onChartTypeChange,
  onRaceChartTypeChange,
  defaultExpanded = false,
  hasUnsavedChanges = false,
}: ChartTypeSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // State for the unsaved changes warning dialog
  const [pendingNavigation, setPendingNavigation] = useState<{
    matchType: MatchType;
    handicapFormat: HandicapFormat;
  } | null>(null);

  // Derive current values from legacy props
  const currentMatchType = getMatchType(currentType);
  const currentHandicapFormat = getHandicapFormat(currentType, raceChartType);

  const getMatchTypeLabel = (type: MatchType) => {
    switch (type) {
      case 'team':
        return 'Team';
      case 'race':
        return 'Individual Race';
    }
  };

  const getHandicapFormatLabel = (format: HandicapFormat) => {
    switch (format) {
      case 'points':
        return 'Points';
      case 'percentage':
        return 'Percentage';
    }
  };

  const getLookupTypeLabel = (format: HandicapFormat) => {
    return format === 'points' ? 'exact lookup' : 'range lookup';
  };

  /**
   * Handle selection change - shows warning if there are unsaved changes
   */
  const handleSelectionChange = (matchType: MatchType, handicapFormat: HandicapFormat) => {
    // No change
    if (matchType === currentMatchType && handicapFormat === currentHandicapFormat) {
      return;
    }

    if (hasUnsavedChanges) {
      setPendingNavigation({ matchType, handicapFormat });
    } else {
      applySelection(matchType, handicapFormat);
    }
  };

  /**
   * Apply the selection by calling the appropriate callbacks
   */
  const applySelection = (matchType: MatchType, handicapFormat: HandicapFormat) => {
    const { chartType, raceChartType: newRaceType } = toLegacyTypes(matchType, handicapFormat);

    // Determine if we need to change chart type (page navigation) or just race sub-type
    if (chartType !== currentType) {
      onChartTypeChange(chartType);
      // If navigating to race page with percentage, also set the race type via URL param
      // (handled by the page component)
    } else if (matchType === 'race' && newRaceType && newRaceType !== raceChartType) {
      onRaceChartTypeChange?.(newRaceType);
    }
  };

  /**
   * Confirm navigation and discard changes
   */
  const handleConfirmNavigation = () => {
    if (!pendingNavigation) return;
    applySelection(pendingNavigation.matchType, pendingNavigation.handicapFormat);
    setPendingNavigation(null);
  };

  /**
   * Cancel navigation and keep editing
   */
  const handleCancelNavigation = () => {
    setPendingNavigation(null);
  };

  return (
    <Card>
      <CardContent className="py-3">
        {/* Header - always visible */}
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Chart Type:</Label>
            <span className="text-sm font-semibold text-blue-600">
              {getMatchTypeLabel(currentMatchType)} - {getHandicapFormatLabel(currentHandicapFormat)}
            </span>
            <span className="text-xs text-gray-500">
              ({getLookupTypeLabel(currentHandicapFormat)})
            </span>
            <span onClick={(e) => e.stopPropagation()}>
              <InfoButton title="Threshold Chart Types" size="sm">
                <p className="mb-2">
                  Charts are defined by two settings:
                </p>
                <p className="text-sm font-medium mb-1">Match Type:</p>
                <ul className="list-disc list-inside space-y-1 text-sm mb-3">
                  <li>
                    <strong>Team:</strong> For team vs team matches. Looks up games-to-win
                    based on team handicap difference.
                  </li>
                  <li>
                    <strong>Individual Race:</strong> For player vs player matchups.
                    Looks up race lengths based on both players&apos; handicaps.
                  </li>
                </ul>
                <p className="text-sm font-medium mb-1">Handicap Format:</p>
                <ul className="list-disc list-inside space-y-1 text-sm mb-2">
                  <li>
                    <strong>Points:</strong> Integer handicaps (e.g., +5, 0, -3).
                    Uses <em>exact lookup</em> - each value has its own entry.
                  </li>
                  <li>
                    <strong>Percentage:</strong> Percentage handicaps (e.g., 45%, 78%).
                    Uses <em>range lookup</em> - values fall into ranges.
                  </li>
                </ul>
                <p className="text-xs text-gray-500">
                  Click to expand and change chart type.
                </p>
              </InfoButton>
            </span>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>

        {/* Expanded content - two-dimension selection */}
        {isExpanded && (
          <div className="mt-4 space-y-4">
            {/* Match Type selection */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-500">Match Type:</Label>
              <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
                {(['team', 'race'] as MatchType[]).map((type) => (
                  <Button
                    key={type}
                    type="button"
                    variant={currentMatchType === type ? 'secondary' : 'ghost'}
                    size="sm"
                    className={`px-3 py-1 h-7 text-xs ${
                      currentMatchType === type
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-transparent hover:bg-gray-200'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectionChange(type, currentHandicapFormat);
                    }}
                  >
                    {getMatchTypeLabel(type)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Handicap Format selection */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-500">Handicap Format:</Label>
              <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
                {(['points', 'percentage'] as HandicapFormat[]).map((format) => (
                  <Button
                    key={format}
                    type="button"
                    variant={currentHandicapFormat === format ? 'secondary' : 'ghost'}
                    size="sm"
                    className={`px-3 py-1 h-7 text-xs ${
                      currentHandicapFormat === format
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-transparent hover:bg-gray-200'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectionChange(currentMatchType, format);
                    }}
                  >
                    {getHandicapFormatLabel(format)}
                    <span className="ml-1 text-[10px] opacity-70">
                      ({format === 'points' ? 'exact' : 'range'})
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {/* Unsaved Changes Warning Dialog */}
      <AlertDialog open={pendingNavigation !== null} onOpenChange={(open) => !open && handleCancelNavigation()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Unsaved Changes
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                You have unsaved changes in the current chart editor.
              </p>
              <p>
                Switching to a different chart type will take you to a new page with a different
                data format. <strong>Your current changes will be lost.</strong>
              </p>
              <p className="text-amber-600 font-medium">
                Are you sure you want to leave without saving?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelNavigation}>
              Keep Editing
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmNavigation}
              className="bg-red-600 hover:bg-red-700"
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
