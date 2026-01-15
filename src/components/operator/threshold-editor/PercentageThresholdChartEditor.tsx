/**
 * @fileoverview Percentage Threshold Chart Editor
 *
 * Full-page editor for the Percentage-based threshold chart.
 * This chart uses handicap difference RANGES (e.g., 0-14, 15-40, etc.) to determine
 * how many games each team needs to win/lose.
 *
 * Key differences from Points chart:
 * - Range-based lookup instead of exact diff
 * - Higher/Lower team values instead of Win/Tie/Lose
 * - No ties (typically 25 games = odd number)
 * - Handicap diffs are percentage-based (0-500+ range)
 *
 * Used by leagues that use percentage-based handicapping (typically 8-man/5v5 formats).
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Plus, RotateCcw, Save, ArrowLeft, AlertTriangle } from 'lucide-react';
import { InfoButton } from '@/components/InfoButton';

/**
 * Single row (range) in the percentage threshold chart
 */
export interface PercentageChartRow {
  minDiff: number;
  maxDiff: number;
  higherWins: number | null;
  lowerWins: number | null;
}

/**
 * Default BCA 5v5 percentage chart ranges
 * Based on BCA Standard Handicap System for 25-game matches
 */
export function getDefaultPercentageChartRows(): PercentageChartRow[] {
  return [
    { minDiff: 0, maxDiff: 14, higherWins: 13, lowerWins: 13 },
    { minDiff: 15, maxDiff: 40, higherWins: 14, lowerWins: 12 },
    { minDiff: 41, maxDiff: 66, higherWins: 15, lowerWins: 11 },
    { minDiff: 67, maxDiff: 92, higherWins: 16, lowerWins: 10 },
    { minDiff: 93, maxDiff: 118, higherWins: 17, lowerWins: 9 },
    { minDiff: 119, maxDiff: 144, higherWins: 18, lowerWins: 8 },
    { minDiff: 145, maxDiff: 999, higherWins: 19, lowerWins: 7 },
  ];
}

/**
 * Generate chart rows based on total games
 *
 * For percentage charts, we maintain the range structure but adjust
 * the higher/lower win values based on total games.
 *
 * Pattern:
 * - At 0 diff range: both teams need ceil(totalGames/2) to win
 * - Each subsequent range: higher +1, lower -1
 *
 * @param totalGames - Total games played in a match
 * @param existingRanges - Existing range boundaries to preserve
 */
export function generateChartFromGames(
  totalGames: number,
  existingRanges?: PercentageChartRow[]
): PercentageChartRow[] {
  // Use existing range boundaries or defaults
  const ranges = existingRanges ?? getDefaultPercentageChartRows();

  // Calculate center point (even teams)
  const centerWin = Math.ceil(totalGames / 2);

  return ranges.map((range, index) => ({
    minDiff: range.minDiff,
    maxDiff: range.maxDiff,
    higherWins: Math.min(totalGames, centerWin + index),
    lowerWins: Math.max(1, centerWin - index),
  }));
}

/** Chart type for navigation (imported from PointsThresholdChartEditor) */
type ChartType = 'points' | 'percentage' | 'race';

interface PercentageThresholdChartEditorProps {
  /** Initial chart data (if loading from saved) */
  initialData?: PercentageChartRow[] | null;
  /** Callback when save is clicked */
  onSave?: (data: PercentageChartRow[]) => void;
  /** Callback when cancel/back is clicked */
  onCancel?: () => void;
  /** Whether save is in progress */
  isSaving?: boolean;
  /** Callback when chart type is changed (for navigation) */
  onChartTypeChange?: (type: ChartType) => void;
  /** Initial lineup size from URL param (determines default total games) */
  initialLineupSize?: number;
}

/**
 * Calculate the default total games based on lineup size for percentage chart
 * Percentage chart typically uses single round-robin: each player plays every opponent once
 * Default = lineupSize * lineupSize = lineupSize^2
 *
 * Examples:
 * - 5 players: 5 * 5 = 25 games (default)
 * - 4 players: 4 * 4 = 16 games (default)
 * - 6 players: 6 * 6 = 36 games (default)
 */
function getDefaultTotalGames(lineupSize: number): number {
  return lineupSize * lineupSize;
}

/**
 * Get the maximum possible handicap percentage difference
 * With percentage-based handicaps, each player has a percentage (0-100%).
 * Team handicap is typically the average or sum of player percentages.
 *
 * The max theoretical diff would be 100% (one team has 100%, other has 0%).
 * In practice, diffs rarely exceed 50-60% for reasonable team matchups.
 *
 * Unlike points handicaps, percentage diffs don't scale with team size.
 */
function getMaxPossibleDiff(): number {
  // Percentage diffs are generally 0-100 regardless of team size
  return 100;
}

/**
 * Percentage Threshold Chart Editor
 *
 * Full-page editor for percentage-based threshold charts.
 * Allows adding, editing, and removing range rows.
 */
export function PercentageThresholdChartEditor({
  initialData,
  onSave,
  onCancel,
  isSaving = false,
  onChartTypeChange,
  initialLineupSize = 5,
}: PercentageThresholdChartEditorProps) {
  // Chart data state
  const [rows, setRows] = useState<PercentageChartRow[]>(
    initialData ?? getDefaultPercentageChartRows()
  );

  // Lineup size (informs default total games)
  const [lineupSize, setLineupSize] = useState(initialLineupSize);

  // Total games is directly editable (default based on lineup but can be customized)
  const [totalGames, setTotalGames] = useState(() => getDefaultTotalGames(initialLineupSize));

  // Max possible diff (informational - percentage diffs max at 100)
  const maxPossibleDiff = getMaxPossibleDiff();

  // Whether to ignore chart warnings and allow saving anyway
  const [ignoreWarnings, setIgnoreWarnings] = useState(false);

  // Calculate expected center point values
  const centerWin = Math.ceil(totalGames / 2);

  // Track if chart has been modified from default
  const defaultRows = getDefaultPercentageChartRows();
  const isCustomized = JSON.stringify(rows) !== JSON.stringify(defaultRows);

  // Validate ranges - check for gaps and overlaps
  const rangeIssues: string[] = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const current = rows[i];
    const next = rows[i + 1];
    if (current.maxDiff + 1 !== next.minDiff) {
      if (current.maxDiff >= next.minDiff) {
        rangeIssues.push(
          `Range ${i + 1} overlaps with range ${i + 2} (${current.maxDiff} >= ${next.minDiff})`
        );
      } else {
        rangeIssues.push(
          `Gap between range ${i + 1} and ${i + 2} (${current.maxDiff} to ${next.minDiff})`
        );
      }
    }
  }
  const hasRangeIssues = rangeIssues.length > 0;

  // Check for critical values (win = totalGames or lose-equivalent = 0)
  const criticalRows = rows.filter(
    (row) =>
      row.higherWins === totalGames ||
      row.lowerWins === 0 ||
      row.lowerWins === totalGames ||
      row.higherWins === 0
  );
  const hasCriticalIssues = criticalRows.length > 0;

  // Check for caution values (win near max or lose-equivalent near 0)
  const cautionRows = rows.filter(
    (row) =>
      !criticalRows.includes(row) &&
      (row.higherWins === totalGames - 1 ||
        row.lowerWins === 1 ||
        row.lowerWins === totalGames - 1 ||
        row.higherWins === 1)
  );
  const hasCautionIssues = cautionRows.length > 0;

  // Check if chart matches a generated chart
  const generatedChart = generateChartFromGames(totalGames, rows);
  const matchesGeneratedChart = JSON.stringify(rows) === JSON.stringify(generatedChart);
  const matchesDefaultChart = JSON.stringify(rows) === JSON.stringify(defaultRows);
  const hasManualEdits = !matchesGeneratedChart && !matchesDefaultChart;

  const hasAnyIssues =
    hasCriticalIssues || hasCautionIssues || hasRangeIssues || hasManualEdits;

  // Track if there are unsaved changes
  const [savedRows, setSavedRows] = useState<PercentageChartRow[]>(
    initialData ?? getDefaultPercentageChartRows()
  );
  const hasUnsavedChanges = JSON.stringify(rows) !== JSON.stringify(savedRows);

  // Update saved rows when initial data changes
  useEffect(() => {
    if (initialData) {
      setSavedRows(initialData);
    }
  }, [initialData]);

  /**
   * Add a new range at the top (lower diff values)
   */
  const handleAddTop = () => {
    const topRow = rows[0];
    // Add a range below the current first range
    const newMin = 0;
    const newMax = topRow.minDiff - 1;

    if (newMax < 0) {
      // Can't add more at the top
      return;
    }

    const newRow: PercentageChartRow = {
      minDiff: newMin,
      maxDiff: newMax,
      higherWins: centerWin,
      lowerWins: centerWin,
    };

    // Also update the first row's minDiff
    const updatedRows = [...rows];
    updatedRows[0] = { ...updatedRows[0], minDiff: newMax + 1 };

    setRows([newRow, ...updatedRows]);
  };

  /**
   * Add a new range at the bottom (higher diff values)
   */
  const handleAddBottom = () => {
    const bottomRow = rows[rows.length - 1];
    const newMin = bottomRow.maxDiff + 1;
    const newMax = newMin + 25; // Default 26-point range

    // Calculate wins based on position
    const index = rows.length;
    const higherWins = Math.min(totalGames, centerWin + index);
    const lowerWins = Math.max(1, centerWin - index);

    const newRow: PercentageChartRow = {
      minDiff: newMin,
      maxDiff: newMax,
      higherWins,
      lowerWins,
    };

    setRows([...rows, newRow]);
  };

  /**
   * Remove a row
   */
  const handleRemoveRow = (index: number) => {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, i) => i !== index));
  };

  /**
   * Update a cell value
   */
  const handleCellChange = (
    index: number,
    field: keyof PercentageChartRow,
    value: number | null
  ) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], [field]: value };
    setRows(newRows);
  };

  /**
   * Reset to default BCA chart
   */
  const handleReset = () => {
    setRows(getDefaultPercentageChartRows());
    setTotalGames(25); // Default BCA 5v5 = 25 games
    setLineupSize(5);
  };

  /**
   * Save the chart
   */
  const handleSave = () => {
    if (onSave) {
      onSave(rows);
      setSavedRows(rows);
    }
  };

  return (
    <div className="space-y-4">
      {/* Chart Type Navigation */}
      {onChartTypeChange && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <Label className="text-sm text-gray-600 whitespace-nowrap">Chart Type:</Label>
              <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="px-4 py-1 h-8 text-sm bg-transparent hover:bg-gray-200"
                  onClick={() => onChartTypeChange('points')}
                >
                  Points
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="px-4 py-1 h-8 text-sm bg-blue-600 text-white hover:bg-blue-700"
                >
                  %
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="px-4 py-1 h-8 text-sm bg-transparent hover:bg-gray-200 text-gray-400 cursor-not-allowed"
                  disabled
                  title="Race chart coming soon"
                >
                  Race
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chart Settings Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            Chart Settings
            <InfoButton title="Chart Settings" size="sm">
              <p className="mb-2">
                <strong>Total Games</strong> is the number of individual games in a team match.
              </p>
              <p className="text-sm mb-2">
                At the lowest diff range (even teams), both teams need the same
                number of wins (typically half the games, rounded up).
              </p>
              <p className="text-sm mb-2">
                <strong>Lineup Size</strong> is informational - percentage handicap differences
                can range from 0-100% regardless of team size.
              </p>
              <p className="text-sm">
                <strong>Examples:</strong>
                <br />
                25 games → 0-14 range = 13 wins each
                <br />
                16 games → 0-14 range = 8 wins each
              </p>
            </InfoButton>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="totalGames" className="text-sm whitespace-nowrap">
                Total Games:
              </Label>
              <Input
                id="totalGames"
                type="number"
                min="1"
                max="100"
                value={totalGames}
                onChange={(e) => setTotalGames(parseInt(e.target.value, 10) || 25)}
                className="w-20 h-8 text-center"
              />
            </div>
            <div className="text-sm text-gray-600">
              At 0 diff: <strong>{centerWin}</strong> wins for both teams
            </div>
          </div>

          {/* Lineup size info row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Label htmlFor="lineupSize" className="whitespace-nowrap">
                Players per Team:
              </Label>
              <Input
                id="lineupSize"
                type="number"
                min="3"
                max="8"
                value={lineupSize}
                onChange={(e) => setLineupSize(parseInt(e.target.value, 10) || 5)}
                className="w-16 h-8 text-center"
              />
            </div>
            <span className="text-gray-500">
              Max diff range: 0-{maxPossibleDiff}%
            </span>
          </div>

          {/* Note about ties */}
          <div className="text-sm text-gray-500">
            Note: Odd game counts have no ties possible.
            {totalGames % 2 === 0 && ' Even game counts allow ties.'}
          </div>

          {/* Regenerate button */}
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setRows(generateChartFromGames(totalGames, rows));
              }}
              className="h-8"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Regenerate Chart
            </Button>
            <p className="text-xs text-gray-500 mt-1">
              Recalculates higher/lower wins based on total games (preserves ranges)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Chart Editor Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span className="flex items-center gap-2">
              Threshold Chart
              <InfoButton title="Percentage Based Threshold Chart" size="sm">
                <p className="mb-2">
                  <strong>How the Percentage Based Threshold Chart works:</strong>
                </p>
                <ol className="list-decimal list-inside space-y-1 text-sm mb-2">
                  <li>Each player has a percentage handicap (e.g., 52% or 78%)</li>
                  <li>Add all players&apos; handicaps to get each team&apos;s total</li>
                  <li>Calculate the absolute difference between team totals</li>
                  <li>Find which range the diff falls into to get games needed</li>
                </ol>
                <p className="text-sm mb-2">
                  <strong>Example:</strong> Home total = 320%, Away total = 280%
                  <br />
                  Diff = 40 → Falls in 15-40 range
                  <br />
                  Higher team needs 14 wins, Lower team needs 12 wins
                </p>
                <p className="text-xs text-gray-500">
                  Unlike point-based charts, the same range applies regardless of which
                  team has the higher handicap. The &quot;Higher Wins&quot; column is for the
                  team with more handicap points, &quot;Lower Wins&quot; for the team with fewer.
                </p>
              </InfoButton>
            </span>
            {isCustomized && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="h-8 text-orange-600 hover:text-orange-700 text-xs"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset to Default
              </Button>
            )}
          </CardTitle>
          {isCustomized && (
            <p className="text-sm text-orange-600 font-medium">
              This chart has been customized from the default.
            </p>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Add Row Button (Top) - only if first row doesn't start at 0 */}
          {rows[0]?.minDiff > 0 && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddTop}
                className="h-8"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Range (0 - {rows[0].minDiff - 1})
              </Button>
            </div>
          )}

          {/* Chart Table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm table-fixed">
              <thead className="bg-gray-50">
                <tr className="border-b">
                  <th className="text-center py-2 px-1 font-medium text-gray-700 w-[80px]">
                    Min
                  </th>
                  <th className="text-center py-2 px-1 font-medium text-gray-700 w-[80px]">
                    Max
                  </th>
                  <th className="text-center py-2 px-1 font-medium text-gray-700">
                    Higher Wins
                  </th>
                  <th className="text-center py-2 px-1 font-medium text-gray-700">
                    Lower Wins
                  </th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  // Check for problematic values
                  const isHigherAtMax = row.higherWins === totalGames;
                  const isLowerAtZero = row.lowerWins === 0;
                  const isHigherAtZero = row.higherWins === 0;
                  const isLowerAtMax = row.lowerWins === totalGames;

                  const isHigherNearMax = row.higherWins === totalGames - 1;
                  const isLowerNearZero = row.lowerWins === 1;
                  const isHigherNearZero = row.higherWins === 1;
                  const isLowerNearMax = row.lowerWins === totalGames - 1;

                  const hasCriticalWarning =
                    isHigherAtMax || isLowerAtZero || isHigherAtZero || isLowerAtMax;
                  const hasCautionWarning =
                    !hasCriticalWarning &&
                    (isHigherNearMax || isLowerNearZero || isHigherNearZero || isLowerNearMax);

                  // Cell background class for warning rows
                  const cellBg = hasCriticalWarning
                    ? 'bg-red-200'
                    : hasCautionWarning
                      ? 'bg-yellow-200'
                      : '';

                  const hasAnyWarning = hasCriticalWarning || hasCautionWarning;

                  return (
                    <tr
                      key={`${row.minDiff}-${row.maxDiff}-${index}`}
                      className={`border-b last:border-b-0 ${
                        hasAnyWarning ? '' : 'hover:bg-gray-50'
                      }`}
                    >
                      {/* Min */}
                      <td className={`py-1.5 px-1 ${cellBg}`}>
                        <Input
                          type="number"
                          min="0"
                          value={row.minDiff}
                          onChange={(e) =>
                            handleCellChange(
                              index,
                              'minDiff',
                              parseInt(e.target.value, 10) || 0
                            )
                          }
                          className="w-full h-8 text-center text-sm px-1 bg-white"
                        />
                      </td>
                      {/* Max */}
                      <td className={`py-1.5 px-1 ${cellBg}`}>
                        <Input
                          type="number"
                          min="0"
                          value={row.maxDiff}
                          onChange={(e) =>
                            handleCellChange(
                              index,
                              'maxDiff',
                              parseInt(e.target.value, 10) || 0
                            )
                          }
                          className="w-full h-8 text-center text-sm px-1 bg-white"
                        />
                      </td>
                      {/* Higher Wins */}
                      <td className={`py-1.5 px-1 ${cellBg}`}>
                        <Input
                          type="number"
                          min="1"
                          max={totalGames}
                          value={row.higherWins ?? ''}
                          onChange={(e) =>
                            handleCellChange(
                              index,
                              'higherWins',
                              e.target.value ? parseInt(e.target.value, 10) : null
                            )
                          }
                          className="w-full h-8 text-center text-sm px-1 bg-white"
                          placeholder="—"
                        />
                      </td>
                      {/* Lower Wins */}
                      <td className={`py-1.5 px-1 ${cellBg}`}>
                        <Input
                          type="number"
                          min="1"
                          max={totalGames}
                          value={row.lowerWins ?? ''}
                          onChange={(e) =>
                            handleCellChange(
                              index,
                              'lowerWins',
                              e.target.value ? parseInt(e.target.value, 10) : null
                            )
                          }
                          className="w-full h-8 text-center text-sm px-1 bg-white"
                          placeholder="—"
                        />
                      </td>
                      {/* Delete */}
                      <td className={`py-1.5 px-1 ${cellBg}`}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveRow(index)}
                          className={`h-8 w-8 p-0 hover:text-red-500 ${
                            hasAnyWarning ? 'text-gray-900' : 'text-gray-400'
                          }`}
                          disabled={rows.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Add Row Button (Bottom) */}
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddBottom}
              className="h-8"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Range ({rows[rows.length - 1]?.maxDiff + 1}+)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Issues Card */}
      {hasAnyIssues && (
        <Card className="border-orange-300 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-orange-800">
              <AlertTriangle className="h-5 w-5" />
              Chart Issues
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {hasRangeIssues && (
              <div className="text-sm">
                <p className="font-medium text-red-700 mb-1">
                  Range Issues ({rangeIssues.length}):
                </p>
                <ul className="text-gray-700 list-disc list-inside">
                  {rangeIssues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {hasCriticalIssues && (
              <div className="text-sm">
                <p className="font-medium text-red-700 mb-1">
                  Critical Issues ({criticalRows.length} range
                  {criticalRows.length !== 1 ? 's' : ''}):
                </p>
                <p className="text-gray-700">
                  Ranges highlighted in{' '}
                  <span className="bg-red-200 px-1 rounded">red</span> require a team
                  to win <strong>every game</strong> or allow winning with{' '}
                  <strong>0 games</strong>. These ranges should be removed.
                </p>
              </div>
            )}

            {hasCautionIssues && (
              <div className="text-sm">
                <p className="font-medium text-yellow-700 mb-1">
                  Caution ({cautionRows.length} range
                  {cautionRows.length !== 1 ? 's' : ''}):
                </p>
                <p className="text-gray-700">
                  Ranges highlighted in{' '}
                  <span className="bg-yellow-200 px-1 rounded">yellow</span> require
                  winning nearly all games or allow winning with only 1 game. Consider
                  removing these ranges.
                </p>
              </div>
            )}

            {hasManualEdits && (
              <div className="text-sm">
                <p className="font-medium text-orange-700 mb-1">
                  Manual Edits Detected:
                </p>
                <p className="text-gray-700">
                  This chart has been manually edited and does not match a generated
                  chart. Any changes other than those generated by the system may cause
                  threshold calculations to be incorrect or produce unexpected results.
                  <strong className="block mt-1">
                    You should verify the calculations for each match to ensure they are
                    correct.
                  </strong>
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2 border-t border-orange-200">
              <Checkbox
                id="ignoreWarnings"
                checked={ignoreWarnings}
                onCheckedChange={(checked) => setIgnoreWarnings(checked === true)}
              />
              <Label htmlFor="ignoreWarnings" className="text-sm text-gray-700">
                I understand the issues and want to save anyway
              </Label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer Actions */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
          className="w-full sm:w-auto"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        <div className="flex flex-col sm:flex-row items-center gap-2">
          {hasUnsavedChanges && (
            <span className="text-sm text-orange-600 hidden sm:inline">
              Unsaved changes
            </span>
          )}
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || (hasAnyIssues && !ignoreWarnings)}
            loadingText="Saving..."
            isLoading={isSaving}
            className="w-full sm:w-auto"
          >
            <Save className="h-4 w-4 mr-1" />
            {hasUnsavedChanges ? 'Save Chart' : 'Accept Chart'}
          </Button>
        </div>
      </div>
    </div>
  );
}
