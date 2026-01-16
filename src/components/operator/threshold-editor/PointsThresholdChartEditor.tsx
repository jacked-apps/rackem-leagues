/**
 * @fileoverview Points Threshold Chart Editor
 *
 * Full-page editor for the Points-based threshold chart.
 * This chart uses exact handicap differences (e.g., -12 to +12) to determine
 * how many games each team needs to win/tie/lose.
 *
 * Features:
 * - View and edit all chart rows
 * - Add rows to top (higher diff) or bottom (lower diff)
 * - Delete rows
 * - Pattern-following for new rows (when chart matches default)
 * - Reset to default BCA chart
 *
 * Used by leagues that use points-based handicapping (typically 5-man/3v3 formats).
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Plus, RotateCcw, Save, ArrowLeft, AlertTriangle } from 'lucide-react';
import { InfoButton } from '@/components/InfoButton';
import { get3v3GamesNeeded } from '@/utils/handicap/get3v3GamesNeeded';

/**
 * Single row in the points threshold chart
 */
export interface PointsChartRow {
  diff: number;
  win: number | null;
  tie: number | null;
  lose: number | null;
}

/**
 * Generate the default BCA points chart rows
 * Range: +12 to -12 (25 rows)
 */
export function getDefaultPointsChartRows(): PointsChartRow[] {
  const rows: PointsChartRow[] = [];
  for (let diff = 12; diff >= -12; diff--) {
    const thresholds = get3v3GamesNeeded(diff);
    rows.push({
      diff,
      win: thresholds.games_to_win,
      tie: thresholds.games_to_tie,
      lose: thresholds.games_to_lose,
    });
  }
  return rows;
}

/**
 * Generate chart rows based on total games and tie settings
 *
 * KEY MATHEMATICAL CONSTRAINT:
 * For any +N/-N pair, the values must add up to totalGames:
 * - win(+N) + lose(-N) = totalGames
 * - win(-N) + lose(+N) = totalGames
 * - tie(+N) + tie(-N) = totalGames (when ties exist)
 *
 * Examples from BCA 18-game chart:
 * - +3: win=11, lose=10  |  -3: win=8, lose=7  → 11+7=18, 8+10=18
 * - +4: win=12, tie=11, lose=10  |  -4: win=8, tie=7, lose=6  → 12+6=18, 11+7=18, 8+10=18
 *
 * Pattern:
 * - At diff 0: win = half + 1, tie = half, lose = half - 1
 * - Going positive: win increases every 2 diffs, lose increases every 2 diffs
 * - Going negative: derived from the constraint (lose = totalGames - win of opposite)
 *
 * @param totalGames - Total games played in a match
 * @param allowTies - Whether ties are allowed
 * @param minDiff - Minimum diff value (default -12)
 * @param maxDiff - Maximum diff value (default +12)
 */
export function generateChartFromGames(
  totalGames: number,
  allowTies: boolean,
  minDiff = -12,
  maxDiff = 12
): PointsChartRow[] {
  const rows: PointsChartRow[] = [];
  const isEvenGames = totalGames % 2 === 0;
  const tiesPossible = isEvenGames && allowTies;

  // Calculate center point (diff = 0) values
  // For even games: win = half + 1, tie = half, lose = half - 1
  // For odd games: win = ceil(half) + 1, lose = floor(half)
  const half = totalGames / 2;
  const centerWin = isEvenGames ? half + 1 : Math.ceil(half) + 1;
  const centerLose = isEvenGames ? half - 1 : Math.floor(half);

  for (let diff = maxDiff; diff >= minDiff; diff--) {
    const isEvenDiff = diff % 2 === 0;
    const hasTie = tiesPossible && isEvenDiff;

    let win: number;
    let lose: number;
    let tie: number | null;

    if (diff === 0) {
      // Center point
      win = centerWin;
      lose = centerLose;
      tie = hasTie ? half : null;
    } else if (diff > 0) {
      // Positive diffs: higher handicap team
      // Win increases every 2 diffs: diff 1,2 get +1, diff 3,4 get +2, etc.
      const winIncrease = Math.ceil(diff / 2);
      win = centerWin + winIncrease;

      // Lose also increases: diff 1 gets +1, diff 2,3 get +1, diff 4,5 get +2, etc.
      const loseIncrease = Math.floor((diff + 1) / 2);
      lose = centerLose + loseIncrease;

      tie = hasTie ? win - 1 : null;
    } else {
      // Negative diffs: derived from constraint with positive counterpart
      // My win = totalGames - lose(+N)
      // My lose = totalGames - win(+N)
      const posDiff = Math.abs(diff);
      const posWinIncrease = Math.ceil(posDiff / 2);
      const posLoseIncrease = Math.floor((posDiff + 1) / 2);

      const posWin = centerWin + posWinIncrease;
      const posLose = centerLose + posLoseIncrease;

      win = totalGames - posLose;
      lose = totalGames - posWin;
      tie = hasTie ? win - 1 : null;
    }

    // Ensure values stay within bounds
    const boundedWin = Math.max(1, Math.min(totalGames, win));
    const boundedLose = Math.max(0, Math.min(totalGames - 1, lose));
    const boundedTie = tie !== null ? Math.max(1, Math.min(totalGames - 1, tie)) : null;

    rows.push({ diff, win: boundedWin, tie: boundedTie, lose: boundedLose });
  }

  return rows;
}

/**
 * Generate new row values following the BCA pattern
 *
 * Pattern rules (for positive diffs, going up):
 * - Ties only exist on even diffs
 * - Win +1 when going from odd to even
 * - Lose +1 when going from even to odd
 * - Reverse for negative diffs (going down)
 *
 * @param prevRow - The adjacent row to base the pattern on
 * @param newDiff - The diff value for the new row
 * @param direction - 'top' (higher diff) or 'bottom' (lower diff)
 */
function generatePatternRow(
  prevRow: PointsChartRow,
  newDiff: number,
  direction: 'top' | 'bottom'
): PointsChartRow {
  const isEvenDiff = newDiff % 2 === 0;

  // If previous row has null values, return blank row
  if (prevRow.win === null || prevRow.lose === null) {
    return { diff: newDiff, win: null, tie: null, lose: null };
  }

  let win = prevRow.win;
  let lose = prevRow.lose;

  if (direction === 'top') {
    // Adding to top means higher diff
    // Pattern: win +1 on odd→even, lose +1 on even→odd
    const prevIsEven = prevRow.diff % 2 === 0;
    if (prevIsEven) {
      // Previous was even, new is odd → lose stays, win stays
      // Actually for going UP: even→odd means we don't change
    } else {
      // Previous was odd, new is even → win +1
      if (isEvenDiff) {
        win = prevRow.win + 1;
      }
    }
    // For lose: going from even→odd means lose +1
    if (prevIsEven && !isEvenDiff) {
      lose = prevRow.lose + 1;
    }
  } else {
    // Adding to bottom means lower diff
    // Reverse the pattern
    const prevIsEven = prevRow.diff % 2 === 0;
    if (prevIsEven && !isEvenDiff) {
      // even→odd (going down): win -1
      win = prevRow.win - 1;
    }
    if (!prevIsEven && isEvenDiff) {
      // odd→even (going down): lose -1
      lose = prevRow.lose - 1;
    }
  }

  // Tie only exists on even diffs
  const tie = isEvenDiff ? win - 1 : null;

  return { diff: newDiff, win, tie, lose };
}

/** Chart type for navigation */
export type ChartType = 'points' | 'percentage' | 'race';

interface PointsThresholdChartEditorProps {
  /** Initial chart data (if loading from saved) */
  initialData?: PointsChartRow[] | null;
  /** Callback when save is clicked */
  onSave?: (data: PointsChartRow[]) => void;
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
 * Points Threshold Chart Editor
 *
 * Full-page editor for points-based threshold charts.
 * Allows adding, editing, and removing rows.
 */
/**
 * Default total games for Points threshold chart
 *
 * Points charts use the BCA standard of 18 games (3v3 double round-robin).
 * This is the standard format and matches the default chart rows.
 * Users can adjust total games manually if using a different format.
 */
const DEFAULT_TOTAL_GAMES = 18;

/**
 * Calculate the maximum possible handicap difference based on lineup size
 * With points-based handicaps, each player contributes their handicap to the team total.
 * The max theoretical diff would be if one team has all max handicap players (e.g., 100 each)
 * and the other has all minimum (0 each).
 *
 * For practical purposes with 3-player teams using BCA handicaps (0-100 range):
 * Max diff = lineupSize * 100 (but typically capped much lower in practice)
 *
 * The chart rows should cover the reasonable range of diffs that might occur.
 */
function getMaxPossibleDiff(lineupSize: number): number {
  // With points handicaps, reasonable max diff scales with team size
  // 3 players: ~36 max reasonable diff (12 * 3)
  // 5 players: ~60 max reasonable diff (12 * 5)
  return lineupSize * 12;
}

export function PointsThresholdChartEditor({
  initialData,
  onSave,
  onCancel,
  isSaving = false,
  onChartTypeChange,
  initialLineupSize = 3,
}: PointsThresholdChartEditorProps) {
  // Chart data state
  const [rows, setRows] = useState<PointsChartRow[]>(
    initialData ?? getDefaultPointsChartRows()
  );

  // Lineup size (informs max diff range and default total games)
  const [lineupSize, setLineupSize] = useState(initialLineupSize);

  // Total games is directly editable (default is 18 for BCA standard)
  const [totalGames, setTotalGames] = useState(DEFAULT_TOTAL_GAMES);

  // String values for inputs to allow clearing/editing
  const [totalGamesInput, setTotalGamesInput] = useState(String(DEFAULT_TOTAL_GAMES));
  const [lineupSizeInput, setLineupSizeInput] = useState(() => String(initialLineupSize));

  // Max possible diff based on lineup size (informational)
  const maxPossibleDiff = getMaxPossibleDiff(lineupSize);

  // Whether to ignore chart warnings and allow saving anyway
  const [ignoreWarnings, setIgnoreWarnings] = useState(false);

  // Calculate expected center point (diff = 0) values based on total games
  // Points charts always allow ties (points are too likely to be exactly even)
  const expectedTie = totalGames / 2; // 18 games = 9 to tie
  const expectedWin = expectedTie + 1; // 18 games = 10 to win
  const isEvenGames = totalGames % 2 === 0;
  const tiesPossible = isEvenGames; // Always allow ties for points charts

  // Find the actual diff=0 row to check if it matches expected
  const zeroRow = rows.find((r) => r.diff === 0);
  const centerMatches =
    zeroRow && zeroRow.win === expectedWin && zeroRow.tie === expectedTie;

  // Track if chart has been modified from default
  const defaultRows = getDefaultPointsChartRows();
  const isCustomized = JSON.stringify(rows) !== JSON.stringify(defaultRows);

  // Count rows with warnings
  const criticalRows = rows.filter(
    (row) => row.win === totalGames || row.lose === 0
  );
  const cautionRows = rows.filter(
    (row) =>
      row.win !== totalGames &&
      row.lose !== 0 &&
      (row.win === totalGames - 1 || row.lose === 1)
  );
  const hasCriticalIssues = criticalRows.length > 0;
  const hasCautionIssues = cautionRows.length > 0;

  // Check if chart matches a generated chart (default BCA or regenerated)
  // Generate what the chart SHOULD look like based on current settings
  const maxDiff = rows.length > 0 ? Math.max(...rows.map((r) => r.diff)) : 12;
  const minDiff = rows.length > 0 ? Math.min(...rows.map((r) => r.diff)) : -12;
  const generatedChart = generateChartFromGames(totalGames, true, minDiff, maxDiff);
  const matchesGeneratedChart = JSON.stringify(rows) === JSON.stringify(generatedChart);
  const matchesDefaultChart = JSON.stringify(rows) === JSON.stringify(defaultRows);
  const hasManualEdits = !matchesGeneratedChart && !matchesDefaultChart;

  const hasAnyIssues = hasCriticalIssues || hasCautionIssues || hasManualEdits;

  // Track if there are unsaved changes (compared to initial)
  const [savedRows, setSavedRows] = useState<PointsChartRow[]>(
    initialData ?? getDefaultPointsChartRows()
  );
  const hasUnsavedChanges = JSON.stringify(rows) !== JSON.stringify(savedRows);

  // Update saved rows when initial data changes
  useEffect(() => {
    if (initialData) {
      setSavedRows(initialData);
    }
  }, [initialData]);

  /**
   * Add a row to the top (higher diff)
   */
  const handleAddTop = () => {
    const topRow = rows[0];
    const newDiff = topRow.diff + 1;

    // Generate new row following pattern (if not customized) or blank (if customized)
    const newRow = isCustomized
      ? { diff: newDiff, win: null, tie: null, lose: null }
      : generatePatternRow(topRow, newDiff, 'top');

    setRows([newRow, ...rows]);
  };

  /**
   * Add a row to the bottom (lower diff)
   */
  const handleAddBottom = () => {
    const bottomRow = rows[rows.length - 1];
    const newDiff = bottomRow.diff - 1;

    // Generate new row following pattern (if not customized) or blank (if customized)
    const newRow = isCustomized
      ? { diff: newDiff, win: null, tie: null, lose: null }
      : generatePatternRow(bottomRow, newDiff, 'bottom');

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
    field: keyof PointsChartRow,
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
    setRows(getDefaultPointsChartRows());
    setTotalGames(18); // Default BCA 3v3 double round-robin
    setLineupSize(3);
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
                  variant="secondary"
                  size="sm"
                  className="px-4 py-1 h-8 text-sm bg-blue-600 text-white hover:bg-blue-700"
                >
                  Points
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="px-4 py-1 h-8 text-sm bg-transparent hover:bg-gray-200"
                  onClick={() => onChartTypeChange('percentage')}
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
                At diff = 0 (even teams), ties should equal half the games,
                and wins should be one more than ties.
              </p>
              <p className="text-sm mb-2">
                <strong>Lineup Size</strong> affects the maximum possible handicap difference
                (typically lineupSize × 12 for points-based handicaps).
              </p>
              <p className="text-sm">
                <strong>Examples:</strong>
                <br />
                18 games → 0 diff = 9 tie, 10 win
                <br />
                32 games → 0 diff = 16 tie, 17 win
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
                value={totalGamesInput}
                onChange={(e) => {
                  setTotalGamesInput(e.target.value);
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1) setTotalGames(val);
                }}
                onBlur={() => {
                  const val = parseInt(totalGamesInput, 10);
                  if (isNaN(val) || val < 1) {
                    setTotalGames(18);
                    setTotalGamesInput('18');
                  } else {
                    setTotalGamesInput(String(val));
                  }
                }}
                className="w-20 h-8 text-center"
              />
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
                value={lineupSizeInput}
                onChange={(e) => {
                  setLineupSizeInput(e.target.value);
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 3) setLineupSize(val);
                }}
                onBlur={() => {
                  const val = parseInt(lineupSizeInput, 10);
                  if (isNaN(val) || val < 3) {
                    setLineupSize(3);
                    setLineupSizeInput('3');
                  } else {
                    setLineupSizeInput(String(val));
                  }
                }}
                className="w-16 h-8 text-center"
              />
            </div>
            <span className="text-gray-500">
              Max diff range: ±{maxPossibleDiff}
            </span>
          </div>

          <div className="text-sm text-gray-600">
            {tiesPossible ? (
              <span>
                At diff 0: <strong>{expectedTie}</strong> to tie,{' '}
                <strong>{expectedWin}</strong> to win
              </span>
            ) : (
              <span className="text-orange-600">
                Odd games = no ties possible
              </span>
            )}
          </div>

          {/* Regenerate button */}
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                // Get current range from existing rows
                const maxDiff = rows.length > 0 ? Math.max(...rows.map((r) => r.diff)) : 12;
                const minDiff = rows.length > 0 ? Math.min(...rows.map((r) => r.diff)) : -12;
                setRows(generateChartFromGames(totalGames, true, minDiff, maxDiff));
              }}
              className="h-8"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Regenerate Chart
            </Button>
            <p className="text-xs text-gray-500 mt-1">
              Recalculates all values based on total games
            </p>
          </div>

          {/* Validation warning */}
          {zeroRow && !centerMatches && tiesPossible && (
            <div className="text-sm text-orange-600 bg-orange-50 p-2 rounded">
              Your diff 0 row shows {zeroRow.win} to win / {zeroRow.tie ?? 'no'} tie,
              but with {totalGames} games it should be {expectedWin} to win / {expectedTie} to tie.
            </div>
          )}
          {!zeroRow && (
            <div className="text-sm text-orange-600 bg-orange-50 p-2 rounded">
              Warning: No diff 0 row found in your chart.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chart Editor Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span className="flex items-center gap-2">
              Threshold Chart
              <InfoButton title="Point Based Threshold Chart" size="sm">
                <p className="mb-2">
                  <strong>How the Point Based Threshold Chart works:</strong>
                </p>
                <ol className="list-decimal list-inside space-y-1 text-sm mb-2">
                  <li>Each player has a point based handicap (e.g., 5 or -2)</li>
                  <li>Add all players&apos; handicaps to get each team&apos;s total</li>
                  <li>Subtract away total from home total to get the diff</li>
                  <li>Look up the diff in this chart to find games needed</li>
                </ol>
                <p className="text-xs text-gray-500 mb-2">
                  A match will always use either 0 (even teams) or a +/- pair
                  (e.g., +4 and -4, or +10 and -10) since the diff is calculated
                  from both perspectives.
                </p>
                <p className="text-sm mb-2">
                  <strong>Example:</strong> Home total = 12, Away total = 8
                  <br />
                  Home diff = +4, Away diff = -4
                </p>
                <p className="text-xs text-gray-500">
                  The higher handicap team has a positive diff and needs more games to win.
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
          {/* Add Row Button (Top) */}
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddTop}
              className="h-8"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Row (Diff +{(rows[0]?.diff ?? 12) + 1})
            </Button>
          </div>

          {/* Chart Table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm table-fixed">
              <thead className="bg-gray-50">
                <tr className="border-b">
                  <th className="text-center py-2 px-1 font-medium text-gray-700 w-[60px]">
                    Diff
                  </th>
                  <th className="text-center py-2 px-1 font-medium text-gray-700">
                    Win
                  </th>
                  <th className="text-center py-2 px-1 font-medium text-gray-700">
                    Tie
                  </th>
                  <th className="text-center py-2 px-1 font-medium text-gray-700">
                    Lose
                  </th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  // Check for problematic values (red = critical, yellow = caution)
                  const isWinAtMax = row.win === totalGames;
                  const isLoseAtZero = row.lose === 0;
                  const isWinNearMax = row.win === totalGames - 1;
                  const isLoseNearZero = row.lose === 1;

                  const hasCriticalWarning = isWinAtMax || isLoseAtZero;
                  const hasCautionWarning = !hasCriticalWarning && (isWinNearMax || isLoseNearZero);

                  // Cell background class for warning rows
                  const cellBg = hasCriticalWarning
                    ? 'bg-red-200'
                    : hasCautionWarning
                      ? 'bg-yellow-200'
                      : '';

                  const hasAnyWarning = hasCriticalWarning || hasCautionWarning;

                  return (
                  <tr
                    key={`${row.diff}-${index}`}
                    className={`border-b last:border-b-0 ${
                      hasAnyWarning ? '' : 'hover:bg-gray-50'
                    }`}
                  >
                    {/* Diff */}
                    <td className={`py-1.5 px-1 ${cellBg}`}>
                      <Input
                        type="number"
                        value={row.diff}
                        onChange={(e) =>
                          handleCellChange(index, 'diff', parseInt(e.target.value, 10) || 0)
                        }
                        className="w-full h-8 text-center text-sm px-1 bg-white"
                      />
                    </td>
                    {/* Win */}
                    <td className={`py-1.5 px-1 ${cellBg}`}>
                      <Input
                        type="number"
                        min="1"
                        max="25"
                        value={row.win ?? ''}
                        onChange={(e) =>
                          handleCellChange(
                            index,
                            'win',
                            e.target.value ? parseInt(e.target.value, 10) : null
                          )
                        }
                        className="w-full h-8 text-center text-sm px-1 bg-white"
                        placeholder="—"
                      />
                    </td>
                    {/* Tie */}
                    <td className={`py-1.5 px-1 ${cellBg}`}>
                      <Input
                        type="number"
                        min="1"
                        max="25"
                        value={row.tie ?? ''}
                        onChange={(e) =>
                          handleCellChange(
                            index,
                            'tie',
                            e.target.value ? parseInt(e.target.value, 10) : null
                          )
                        }
                        className="w-full h-8 text-center text-sm px-1 bg-white"
                        placeholder="—"
                      />
                    </td>
                    {/* Lose */}
                    <td className={`py-1.5 px-1 ${cellBg}`}>
                      <Input
                        type="number"
                        min="1"
                        max="25"
                        value={row.lose ?? ''}
                        onChange={(e) =>
                          handleCellChange(
                            index,
                            'lose',
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
              Add Row (Diff {(rows[rows.length - 1]?.diff ?? -12) - 1})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Issues Card - shown when there are warning rows */}
      {hasAnyIssues && (
        <Card className="border-orange-300 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-orange-800">
              <AlertTriangle className="h-5 w-5" />
              Chart Issues
              <InfoButton title="Custom Handicap Integration" size="sm">
                <p className="text-sm mb-2">
                  Want your handicap system integrated with our scoring? Contact
                  us at{' '}
                  <a
                    href="mailto:support@rackemleagues.com"
                    className="text-blue-600 hover:underline"
                  >
                    support@rackemleagues.com
                  </a>
                  .
                </p>
                <p className="text-sm text-gray-600">
                  While we aim to support all handicap systems, we prioritize
                  those that are well-established, clearly documented with
                  specific rules and formulas, and submitted by experienced
                  league operators.
                </p>
              </InfoButton>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {hasCriticalIssues && (
              <div className="text-sm">
                <p className="font-medium text-red-700 mb-1">
                  Critical Issues ({criticalRows.length} row{criticalRows.length !== 1 ? 's' : ''}):
                </p>
                <p className="text-gray-700">
                  Rows highlighted in <span className="bg-red-200 px-1 rounded">red</span> require
                  a team to win <strong>every game</strong> or allow winning with <strong>0 games</strong>.
                  This is usually too harsh of a handicap and these rows should be removed.
                </p>
              </div>
            )}

            {hasCautionIssues && (
              <div className="text-sm">
                <p className="font-medium text-yellow-700 mb-1">
                  Caution ({cautionRows.length} row{cautionRows.length !== 1 ? 's' : ''}):
                </p>
                <p className="text-gray-700">
                  Rows highlighted in <span className="bg-yellow-200 px-1 rounded">yellow</span> require
                  winning nearly all games or allow winning with only 1 game.
                  Requiring a team to win fewer than 3 games is usually too strong of a handicap.
                  Consider removing these rows.
                </p>
              </div>
            )}

            {hasManualEdits && (
              <div className="text-sm">
                <p className="font-medium text-orange-700 mb-1">
                  Manual Edits Detected:
                </p>
                <p className="text-gray-700">
                  This chart has been manually edited and does not match a generated chart.
                  Any changes other than those generated by the system may cause threshold
                  calculations to be incorrect or produce unexpected results.
                  <strong className="block mt-1">
                    You should verify the calculations for each match to ensure they are correct.
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
                I understand the issues and want to use this chart anyway
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
            <span className="text-sm text-orange-600 hidden sm:inline">Unsaved changes</span>
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
