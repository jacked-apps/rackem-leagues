/**
 * @fileoverview Race Threshold Chart Editor
 *
 * Editor for individual race (player vs player) threshold charts.
 * This chart type uses a 2D matrix where:
 * - comp_1 = Player 1's handicap (higher or equal)
 * - comp_2 = Player 2's handicap (lower or equal)
 * - result_1 = Games Player 1 needs to win
 * - result_3 = Games Player 2 needs to win
 * - result_2 = NULL (no ties in races)
 *
 * Key differences from team charts:
 * - 2D lookup (two player handicaps) instead of single team diff
 * - Symmetrical: comp_1 >= comp_2 (upper triangle only stored)
 * - The lookup function swaps players if needed and reverses results
 * - No ties (races go until someone wins the required games)
 *
 * Supports both:
 * - race_points: Point-based player handicaps (e.g., 1-10 scale)
 * - race_percentage: Percentage-based player handicaps (0-100%)
 *
 * Used for leagues that use individual race scoring.
 */

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Plus, RotateCcw, Save, ArrowLeft, AlertTriangle } from 'lucide-react';
import { InfoButton } from '@/components/InfoButton';

/**
 * Calculate race lengths for a given handicap difference using alternating adjustments.
 *
 * Algorithm:
 * - Start with even race at baseRace (both players race to baseRace)
 * - For each adjustment step (1 to gameDiff):
 *   - Odd steps: -1 to lower player
 *   - Even steps: +1 to higher player
 * - If lower hits min, overflow to higher (add instead)
 * - If higher hits max, overflow to lower (subtract instead)
 * - If both are at limits, clamp
 *
 * @param baseRace - Starting race length for both players (even matchup)
 * @param gameDiff - Number of adjustment steps to apply
 * @param maxRace - Maximum race length (higher player cap)
 * @param minRace - Minimum race length (lower player floor)
 * @returns Object with player1Wins (higher) and player2Wins (lower)
 *
 * @example
 * // base=5, gameDiff=0 → 5-5 (even)
 * // base=5, gameDiff=1 → 5-4 (step 1: -1 to lower)
 * // base=5, gameDiff=2 → 6-4 (step 2: +1 to higher)
 * // base=5, gameDiff=3 → 6-3 (step 3: -1 to lower)
 * // base=5, gameDiff=4 → 7-3 (step 4: +1 to higher)
 */
export function calculateRaceLengths(
  baseRace: number,
  gameDiff: number,
  maxRace: number,
  minRace: number
): { player1Wins: number; player2Wins: number } {
  let player1Wins = baseRace; // Higher handicap player
  let player2Wins = baseRace; // Lower handicap player

  // Apply alternating adjustments: odd = -1 to lower, even = +1 to higher
  for (let step = 1; step <= gameDiff; step++) {
    if (step % 2 === 1) {
      // Odd step: try to subtract from lower player
      if (player2Wins > minRace) {
        player2Wins--;
      } else if (player1Wins < maxRace) {
        // Lower is at min, overflow to higher
        player1Wins++;
      }
      // else: both at limits, can't adjust
    } else {
      // Even step: try to add to higher player
      if (player1Wins < maxRace) {
        player1Wins++;
      } else if (player2Wins > minRace) {
        // Higher is at max, overflow to lower
        player2Wins--;
      }
      // else: both at limits, can't adjust
    }
  }

  return { player1Wins, player2Wins };
}

/**
 * Single row in the race threshold chart
 *
 * For race charts, we store the upper triangle only:
 * - player1Handicap >= player2Handicap
 * - When looking up a matchup where player1 < player2, we swap them
 *   and reverse the results
 */
export interface RaceChartRow {
  player1Handicap: number; // comp_1 - The higher (or equal) handicap
  player2Handicap: number; // comp_2 - The lower (or equal) handicap
  player1Wins: number | null; // result_1 - Games player 1 needs
  player2Wins: number | null; // result_3 - Games player 2 needs
}

/**
 * Race chart type for display purposes
 */
export type RaceChartType = 'points' | 'percentage';

/**
 * Generate default race chart rows for points-based handicaps
 *
 * Points-based race charts typically use handicaps 1-10 (or similar range).
 * The chart shows how many games each player needs to win based on
 * their relative skill levels.
 *
 * Common pattern: Equal handicaps = equal race length (e.g., both race to 5)
 * Higher handicap player races to more, lower to fewer.
 */
export function getDefaultRacePointsChartRows(): RaceChartRow[] {
  const rows: RaceChartRow[] = [];
  const maxHandicap = 10;
  const baseRace = 5; // Base race length for equal handicaps

  // Generate upper triangle only (player1 >= player2)
  for (let p1 = maxHandicap; p1 >= 1; p1--) {
    for (let p2 = p1; p2 >= 1; p2--) {
      // Difference determines adjustment
      const diff = p1 - p2;

      // Equal handicaps = equal race
      // Higher handicap races to more games
      // Lower handicap races to fewer games
      // Typical pattern: +1 game per 2 handicap difference
      const adjustment = Math.floor(diff / 2);

      const player1Wins = baseRace + adjustment;
      const player2Wins = Math.max(2, baseRace - adjustment);

      rows.push({
        player1Handicap: p1,
        player2Handicap: p2,
        player1Wins,
        player2Wins,
      });
    }
  }

  return rows;
}

/**
 * Generate default race chart rows for percentage-based handicaps
 *
 * For Individual/Percentage charts, the structure is different:
 * - player1Handicap = Diff (upper bound of a handicap difference range)
 * - player2Handicap = Highest H/C tier (for additional lookup dimension)
 * - Rows represent ranges: Diff=15 means 0-15%, Diff=30 means 16-30%, etc.
 *
 * Default uses Gap mode with gap=15 and handicap tiers at 100, 80, 60, 40, 20
 */
export function getDefaultRaceMatrixPercentageChartRows(): RaceChartRow[] {
  // Use divisions mode with 5 divisions to match points chart structure
  // base=5, max=7, min=3 (same as points chart)
  return generateRacePercentageChartRowsWithGap(5, 'divisions', 100, 20, 5, 7, 3);
}

/**
 * Generate race chart rows for percentage-based handicaps using Gap/Divisions
 *
 * For Individual/Percentage charts:
 * - player1Handicap = Diff (upper bound of handicap difference range, exclusive)
 *   - Diff=15 means 0-14, Diff=30 means 15-29, etc.
 * - player2Handicap = Highest H/C tier (lower bound of skill tier, inclusive)
 *
 * Gap mode: Creates rows at gap, gap×2, gap×3, etc.
 *   Example: gap=15 → rows at 15 (0-14), 30 (15-29), 45 (30-44), etc.
 *
 * Divisions mode: Splits the max difference range into equal portions
 *   Example: divisions=5, maxDiff=100 → rows at 20, 40, 60, 80, 100
 *
 * Tier count is DERIVED from settings:
 * - Number of tiers = baseRaceLength - minRaceLength + 1
 * - Example: base=5, min=3 → 3 tiers (5, 4, 3)
 * - Example: base=7, min=3 → 5 tiers (7, 6, 5, 4, 3)
 *
 * Tier thresholds divide the handicap range into equal portions:
 * - 3 tiers on 0-100: thresholds at 67, 34, 0 (covering 67-100, 34-66, 0-33)
 * - 5 tiers on 0-100: thresholds at 80, 60, 40, 20, 0 (standard 20% jumps)
 *
 * Each tier gets its own base (decreases by 1 per tier) to avoid redundancy.
 *
 * Row ordering: Grouped by Highest H/C tier first, then Diff within each tier.
 *
 * @param gapOrDivisions - Gap value (fixed step) or number of divisions
 * @param mode - 'gap' for fixed step, 'divisions' for equal portions
 * @param maxHandicap - Maximum handicap value (for Highest H/C tiers)
 * @param minHandicap - Minimum handicap value
 * @param baseRaceLength - Base race length for equal matchups at highest tier
 * @param maxRaceLength - Maximum race length limit
 * @param minRaceLength - Minimum race length limit
 */
export function generateRacePercentageChartRowsWithGap(
  gapOrDivisions: number,
  mode: 'gap' | 'divisions',
  maxHandicap: number,
  minHandicap: number,
  baseRaceLength: number,
  maxRaceLength: number = 9,
  minRaceLength: number = 3
): RaceChartRow[] {
  const rows: RaceChartRow[] = [];

  // Calculate diff values based on mode
  const diffValues: number[] = [];
  const maxDiff = maxHandicap - minHandicap; // Maximum possible difference

  // For calculating adjustments, we need to know the step size
  // Gap mode: step size = gap value
  // Divisions mode: step size = divisionSize (range / divisions)
  let stepSize: number;

  if (mode === 'gap') {
    // Gap mode: diff values at gap, gap×2, gap×3, etc. up to maxDiff
    stepSize = gapOrDivisions;
    for (let d = gapOrDivisions; d <= maxDiff; d += gapOrDivisions) {
      diffValues.push(d);
    }
    // Ensure we have at least the max diff if gap doesn't divide evenly
    if (diffValues.length === 0 || diffValues[diffValues.length - 1] < maxDiff) {
      diffValues.push(maxDiff);
    }
  } else {
    // Divisions mode: split range into equal portions
    stepSize = Math.ceil(maxDiff / gapOrDivisions);
    for (let i = 1; i <= gapOrDivisions; i++) {
      diffValues.push(Math.min(stepSize * i, maxDiff));
    }
  }

  // Calculate number of tiers from base and min race lengths
  // Example: base=5, min=3 → 3 tiers (5, 4, 3)
  // Example: base=7, min=3 → 5 tiers (7, 6, 5, 4, 3)
  const tierCount = baseRaceLength - minRaceLength + 1;

  // Generate handicap tier thresholds by dividing range into tierCount portions
  // These are the LOWER bounds of each tier
  // Example: 3 tiers on 0-100 → thresholds at 67, 34, 0
  // Example: 5 tiers on 0-100 → thresholds at 80, 60, 40, 20, 0
  const handicapRange = maxHandicap - minHandicap;
  const tierSize = Math.floor(handicapRange / tierCount);
  const handicapTiers: number[] = [];

  for (let i = 0; i < tierCount; i++) {
    // Calculate threshold from top down
    // Tier 0 threshold = maxHandicap - tierSize (e.g., 100 - 33 = 67 for 3 tiers)
    // Tier 1 threshold = maxHandicap - 2*tierSize (e.g., 100 - 66 = 34)
    // Last tier threshold = minHandicap (always 0 or whatever min is)
    if (i === tierCount - 1) {
      handicapTiers.push(minHandicap);
    } else {
      handicapTiers.push(maxHandicap - tierSize * (i + 1));
    }
  }

  // Generate rows grouped by Highest H/C tier first, then Diff within each tier
  for (let tierIdx = 0; tierIdx < handicapTiers.length; tierIdx++) {
    const highestHc = handicapTiers[tierIdx];

    // Each tier gets its own base (decreases by 1 per tier)
    // Tier 0: base, Tier 1: base-1, Tier 2: base-2, etc.
    const tierBase = baseRaceLength - tierIdx;

    for (let diffIdx = 0; diffIdx < diffValues.length; diffIdx++) {
      const diff = diffValues[diffIdx];
      // diffIdx tells us which diff range this is (0 = smallest diff, 1 = next, etc.)
      // The number of adjustments = diffIdx (first diff is even race, no adjustments)
      //
      // Example with 5 divisions on range 80, base=5:
      //   diffIdx=0, Diff 16 (0-15): adjustments=0 → 5-5 (even)
      //   diffIdx=1, Diff 32 (16-31): adjustments=1 → 5-4 (step 1: -1 to lower)
      //   diffIdx=2, Diff 48 (32-47): adjustments=2 → 6-4 (step 2: +1 to higher)
      //   diffIdx=3, Diff 64 (48-63): adjustments=3 → 6-3 (step 3: -1 to lower)
      //   diffIdx=4, Diff 80 (64-79): adjustments=4 → 7-3 (step 4: +1 to higher)
      const adjustmentSteps = diffIdx;

      // Use shared helper to calculate race lengths with overflow handling
      const { player1Wins, player2Wins } = calculateRaceLengths(
        tierBase,
        adjustmentSteps,
        maxRaceLength,
        minRaceLength
      );

      rows.push({
        player1Handicap: diff,       // This is the Diff (upper bound of range)
        player2Handicap: highestHc,  // This is the Highest H/C tier (lower bound)
        player1Wins,
        player2Wins,
      });
    }
  }

  return rows;
}

/**
 * Generate race chart rows based on parameters
 *
 * Algorithm:
 * 1. Each row starts with equal handicaps at a "row base"
 * 2. Row base decreases by 1 for every 2 rows below the first row
 *    - Row 0 (highest handicap): base = baseRaceLength
 *    - Row 1: base = baseRaceLength - 1
 *    - Row 2: base = baseRaceLength - 1
 *    - Row 3: base = baseRaceLength - 2
 *    - Row 4: base = baseRaceLength - 2
 *    - etc.
 * 3. For each row, differences alternate: -1 to lower, +1 to higher, repeat
 * 4. Clamp at max/min when limits are reached
 *
 * Example with max=2, min=-2, base=5, maxRace=7, minRace=2:
 * Row 0 (2 vs X): base=5
 *   - 2 vs 2: 5-5
 *   - 2 vs 1: 5-4 (diff 1: -1 to lower)
 *   - 2 vs 0: 6-4 (diff 2: +1 to higher)
 *   - 2 vs -1: 6-3 (diff 3: -1 to lower)
 *   - 2 vs -2: 7-3 (diff 4: +1 to higher)
 * Row 1 (1 vs X): base=4
 *   - 1 vs 1: 4-4
 *   - 1 vs 0: 4-3
 *   - 1 vs -1: 5-3
 *   - 1 vs -2: 5-2
 * Row 2 (0 vs X): base=4
 *   - 0 vs 0: 4-4
 *   - 0 vs -1: 4-3
 *   - 0 vs -2: 5-3
 * Row 3 (-1 vs X): base=3
 *   - -1 vs -1: 3-3
 *   - -1 vs -2: 3-2
 * Row 4 (-2 vs X): base=3
 *   - -2 vs -2: 3-3
 *
 * @param maxHandicap - Maximum handicap value in the chart
 * @param minHandicap - Minimum handicap value in the chart
 * @param baseRaceLength - Games needed when both players have max handicap (row 0)
 * @param isPercentage - Whether this is a percentage chart (affects step size)
 * @param maxRaceLength - Maximum games any player can race to (optional)
 * @param minRaceLength - Minimum games any player can race to (default 2)
 */
export function generateRaceChartRows(
  maxHandicap: number,
  minHandicap: number,
  baseRaceLength: number,
  isPercentage: boolean,
  maxRaceLength?: number,
  minRaceLength: number = 2
): RaceChartRow[] {
  const rows: RaceChartRow[] = [];

  // For percentage, use larger steps (e.g., 20)
  // For points, use step of 1
  const step = isPercentage ? 20 : 1;

  // Generate handicap levels from max to min
  const levels: number[] = [];
  for (let h = maxHandicap; h >= minHandicap; h -= step) {
    levels.push(h);
  }

  // Generate upper triangle only (player1 >= player2)
  // i = row index (0 = highest handicap row)
  for (let i = 0; i < levels.length; i++) {
    // Calculate row base: drops by 1 for every 2 rows after the first
    // Row 0: base, Row 1: base-1, Row 2: base-1, Row 3: base-2, etc.
    const rowReduction = i === 0 ? 0 : Math.floor((i + 1) / 2);
    const rowBase = Math.max(minRaceLength, baseRaceLength - rowReduction);

    for (let j = i; j < levels.length; j++) {
      const p1 = levels[i]; // Higher handicap (row handicap)
      const p2 = levels[j]; // Lower handicap

      const diff = p1 - p2;

      // For percentage charts, each 20% step = 1 game difference
      const gameDiff = isPercentage ? Math.floor(diff / 20) : diff;

      // Use shared helper to calculate race lengths with overflow handling
      const effectiveMax = maxRaceLength ?? 99;
      const { player1Wins, player2Wins } = calculateRaceLengths(
        rowBase,
        gameDiff,
        effectiveMax,
        minRaceLength
      );

      rows.push({
        player1Handicap: p1,
        player2Handicap: p2,
        player1Wins,
        player2Wins,
      });
    }
  }

  return rows;
}

/**
 * Calculate the actual max and min race lengths from chart data
 */
export function calculateRaceLengthRange(rows: RaceChartRow[]): { max: number; min: number } {
  let max = 0;
  let min = Infinity;

  rows.forEach((row) => {
    if (row.player1Wins !== null) {
      max = Math.max(max, row.player1Wins);
      min = Math.min(min, row.player1Wins);
    }
    if (row.player2Wins !== null) {
      max = Math.max(max, row.player2Wins);
      min = Math.min(min, row.player2Wins);
    }
  });

  // Handle empty charts
  if (min === Infinity) min = 0;

  return { max, min };
}

interface RaceThresholdChartEditorProps {
  /** Initial chart data (if loading from saved) */
  initialData?: RaceChartRow[] | null;
  /** Callback when save is clicked */
  onSave?: (data: RaceChartRow[]) => void;
  /** Callback when cancel/back is clicked */
  onCancel?: () => void;
  /** Whether save is in progress */
  isSaving?: boolean;
  /** Whether this is a points or percentage chart */
  raceChartType?: RaceChartType;
  /** Callback when unsaved changes state changes - allows parent to track dirty state */
  onUnsavedChangesChange?: (hasUnsavedChanges: boolean) => void;
}

/**
 * Race Threshold Chart Editor
 *
 * Editor for individual race threshold charts.
 * Displays a 2D matrix of player handicaps and their race lengths.
 */
export function RaceThresholdChartEditor({
  initialData,
  onSave,
  onCancel,
  isSaving = false,
  raceChartType = 'points',
  onUnsavedChangesChange,
}: RaceThresholdChartEditorProps) {
  // Determine default rows based on race chart type
  const getDefaultRows = () => {
    if (raceChartType === 'percentage') {
      return getDefaultRaceMatrixPercentageChartRows();
    }
    return getDefaultRacePointsChartRows();
  };

  // Chart data state
  const [rows, setRows] = useState<RaceChartRow[]>(initialData ?? getDefaultRows());

  // Chart settings - percentage uses same race lengths as points (base=5, max=7, min=3)
  const [baseRaceLength, setBaseRaceLength] = useState(5);
  const [maxHandicap, setMaxHandicap] = useState(raceChartType === 'percentage' ? 100 : 10);
  const [minHandicap, setMinHandicap] = useState(raceChartType === 'percentage' ? 20 : 1);

  // Race length limits - max games any player could be assigned (same for both chart types)
  const [maxRaceLength, setMaxRaceLength] = useState(7);
  const [minRaceLength, setMinRaceLength] = useState(raceChartType === 'percentage' ? 3 : 2);

  // String values for inputs
  const [baseRaceLengthInput, setBaseRaceLengthInput] = useState(String(baseRaceLength));
  const [maxHandicapInput, setMaxHandicapInput] = useState(String(maxHandicap));
  const [minHandicapInput, setMinHandicapInput] = useState(String(minHandicap));
  const [maxRaceLengthInput, setMaxRaceLengthInput] = useState(String(maxRaceLength));
  const [minRaceLengthInput, setMinRaceLengthInput] = useState(String(minRaceLength));

  // Gap/Divisions settings - only one is used at a time
  // Percentage defaults to divisions mode (5 divisions), points defaults to gap mode (gap=1)
  const [gapMode, setGapMode] = useState<'gap' | 'divisions'>(raceChartType === 'percentage' ? 'divisions' : 'gap');
  const [gapValue, setGapValue] = useState(raceChartType === 'percentage' ? 16 : 1);
  const [divisionsValue, setDivisionsValue] = useState(5);
  const [gapDivisionsInput, setGapDivisionsInput] = useState(raceChartType === 'percentage' ? '5' : '1');

  // Whether to ignore chart warnings
  const [ignoreWarnings, setIgnoreWarnings] = useState(false);

  // Update rows when race chart type changes
  useEffect(() => {
    if (raceChartType === 'percentage') {
      // Percentage: same race lengths as points (base=5, max=7, min=3)
      // but uses divisions mode with 5 divisions on 100-20 range
      setBaseRaceLength(5);
      setMaxHandicap(100);
      setMinHandicap(20);
      setMaxRaceLength(7);
      setMinRaceLength(3);
      setBaseRaceLengthInput('5');
      setMaxHandicapInput('100');
      setMinHandicapInput('20');
      setMaxRaceLengthInput('7');
      setMinRaceLengthInput('3');
      setGapMode('divisions');
      setGapValue(16); // 80/5 = 16 for reference
      setDivisionsValue(5);
      setGapDivisionsInput('5');
    } else {
      // Points: base=5, max=7, min=2, gap=1
      setBaseRaceLength(5);
      setMaxHandicap(10);
      setMinHandicap(1);
      setMaxRaceLength(7);
      setMinRaceLength(2);
      setBaseRaceLengthInput('5');
      setMaxHandicapInput('10');
      setMinHandicapInput('1');
      setMaxRaceLengthInput('7');
      setMinRaceLengthInput('2');
      setGapMode('gap');
      setGapValue(1);
      setDivisionsValue(5);
      setGapDivisionsInput('1');
    }
    // Only regenerate if no initial data
    if (!initialData) {
      setRows(getDefaultRows());
    }
  }, [raceChartType, initialData]);

  // Track if chart has been modified from default
  const defaultRows = getDefaultRows();
  const isCustomized = JSON.stringify(rows) !== JSON.stringify(defaultRows);

  // Get unique handicap levels from rows for matrix display
  const handicapLevels = useMemo(() => {
    const levels = new Set<number>();
    rows.forEach((row) => {
      levels.add(row.player1Handicap);
      levels.add(row.player2Handicap);
    });
    return Array.from(levels).sort((a, b) => b - a); // Descending order
  }, [rows]);

  // Calculate the actual race length range from current chart data
  const actualRaceRange = useMemo(() => calculateRaceLengthRange(rows), [rows]);

  // Create a map for quick lookup
  const rowMap = useMemo(() => {
    const map = new Map<string, RaceChartRow>();
    rows.forEach((row, index) => {
      // Key as "higher-lower" so we always look up consistently
      const key = `${Math.max(row.player1Handicap, row.player2Handicap)}-${Math.min(row.player1Handicap, row.player2Handicap)}`;
      map.set(key, { ...row, index } as RaceChartRow & { index: number });
    });
    return map;
  }, [rows]);

  // Function to get row for a cell
  const getRowForCell = (h1: number, h2: number): (RaceChartRow & { index: number }) | undefined => {
    const key = `${Math.max(h1, h2)}-${Math.min(h1, h2)}`;
    return rowMap.get(key) as (RaceChartRow & { index: number }) | undefined;
  };

  // Count critical issues (race to all games or 0)
  const maxRace = baseRaceLength + 5; // Reasonable max race length
  const criticalRows = rows.filter(
    (row) =>
      row.player1Wins !== null &&
      row.player2Wins !== null &&
      (row.player1Wins >= maxRace || row.player2Wins <= 1 || row.player1Wins <= 1 || row.player2Wins >= maxRace)
  );
  const hasCriticalIssues = criticalRows.length > 0;

  // Check for missing rows (gaps in the matrix)
  const expectedRowCount = (handicapLevels.length * (handicapLevels.length + 1)) / 2;
  const hasMissingRows = rows.length < expectedRowCount && handicapLevels.length > 0;

  // Check if chart matches a generated chart
  const generatedChart = generateRaceChartRows(
    maxHandicap,
    minHandicap,
    baseRaceLength,
    raceChartType === 'percentage',
    maxRaceLength,
    minRaceLength
  );
  const matchesGeneratedChart = JSON.stringify(rows) === JSON.stringify(generatedChart);
  const matchesDefaultChart = JSON.stringify(rows) === JSON.stringify(defaultRows);
  const hasManualEdits = !matchesGeneratedChart && !matchesDefaultChart;

  // Calculate number of handicap levels based on settings (for warning about large ranges)
  const step = raceChartType === 'percentage' ? 20 : 1;
  const settingsLevelCount = Math.floor((maxHandicap - minHandicap) / step) + 1;
  const hasLargeRange = settingsLevelCount > 10;

  const hasAnyIssues = hasCriticalIssues || hasMissingRows || hasManualEdits;

  // Track unsaved changes
  const [savedRows, setSavedRows] = useState<RaceChartRow[]>(initialData ?? getDefaultRows());
  const hasUnsavedChanges = JSON.stringify(rows) !== JSON.stringify(savedRows);

  // Notify parent of unsaved changes state
  useEffect(() => {
    onUnsavedChangesChange?.(hasUnsavedChanges);
  }, [hasUnsavedChanges, onUnsavedChangesChange]);

  // Update saved rows when initial data changes
  useEffect(() => {
    if (initialData) {
      setSavedRows(initialData);
    }
  }, [initialData]);

  /**
   * Update a cell value in the matrix
   */
  const handleCellChange = (
    h1: number,
    h2: number,
    field: 'player1Wins' | 'player2Wins',
    value: number | null
  ) => {
    const row = getRowForCell(h1, h2);
    if (!row) return;

    const newRows = [...rows];
    const index = rows.findIndex(
      (r) => r.player1Handicap === row.player1Handicap && r.player2Handicap === row.player2Handicap
    );
    if (index !== -1) {
      newRows[index] = { ...newRows[index], [field]: value };
      setRows(newRows);
    }
  };

  /**
   * Add a new handicap level
   *
   * Supports negative handicaps for systems like +2 to -2
   */
  const handleAddLevel = (position: 'top' | 'bottom') => {
    const step = raceChartType === 'percentage' ? 20 : 1;
    const newLevel =
      position === 'top'
        ? handicapLevels[0] + step
        : handicapLevels[handicapLevels.length - 1] - step;

    // No longer block negative levels - allow systems like +2 to -2

    // Add rows for this new level with all existing levels
    const newRows: RaceChartRow[] = [];
    const diffPerAdjustment = raceChartType === 'percentage' ? 20 : 2;

    // Add row for new level vs itself
    newRows.push({
      player1Handicap: newLevel,
      player2Handicap: newLevel,
      player1Wins: Math.min(maxRaceLength, Math.max(minRaceLength, baseRaceLength)),
      player2Wins: Math.min(maxRaceLength, Math.max(minRaceLength, baseRaceLength)),
    });

    // Add rows for new level vs existing levels
    handicapLevels.forEach((existingLevel) => {
      const p1 = Math.max(newLevel, existingLevel);
      const p2 = Math.min(newLevel, existingLevel);
      const diff = p1 - p2;
      const adjustment = Math.floor(diff / diffPerAdjustment);

      // Apply min/max limits
      const p1Wins = Math.min(maxRaceLength, Math.max(minRaceLength, baseRaceLength + adjustment));
      const p2Wins = Math.min(maxRaceLength, Math.max(minRaceLength, baseRaceLength - adjustment));

      newRows.push({
        player1Handicap: p1,
        player2Handicap: p2,
        player1Wins: p1Wins,
        player2Wins: p2Wins,
      });
    });

    setRows([...rows, ...newRows]);
  };

  /**
   * Remove a handicap level and all its rows
   */
  const handleRemoveLevel = (level: number) => {
    if (handicapLevels.length <= 2) return;

    const newRows = rows.filter(
      (row) => row.player1Handicap !== level && row.player2Handicap !== level
    );
    setRows(newRows);
  };

  /**
   * Reset to default chart
   */
  const handleReset = () => {
    setRows(getDefaultRows());
    if (raceChartType === 'percentage') {
      setBaseRaceLength(7);
      setMaxHandicap(100);
      setMinHandicap(20);
      setMaxRaceLength(9);
      setMinRaceLength(3);
      setBaseRaceLengthInput('7');
      setMaxHandicapInput('100');
      setMinHandicapInput('20');
      setMaxRaceLengthInput('9');
      setMinRaceLengthInput('3');
    } else {
      setBaseRaceLength(5);
      setMaxHandicap(10);
      setMinHandicap(1);
      setMaxRaceLength(7);
      setMinRaceLength(2);
      setBaseRaceLengthInput('5');
      setMaxHandicapInput('10');
      setMinHandicapInput('1');
      setMaxRaceLengthInput('7');
      setMinRaceLengthInput('2');
    }
  };

  /**
   * Regenerate chart from settings
   *
   * For points mode: Uses the matrix generator (2D handicap lookup)
   * For percentage mode: Uses the ranged generator with Gap/Divisions
   *   - Gap mode: Diff column = gap, gap×2, gap×3, etc.
   *   - Divisions mode: Diff column = range/divisions × 1, 2, 3, etc.
   */
  const handleRegenerate = () => {
    if (raceChartType === 'percentage') {
      // Use the percentage-specific generator with Gap/Divisions
      const gapOrDivisionsValue = gapMode === 'gap' ? gapValue : divisionsValue;
      setRows(generateRacePercentageChartRowsWithGap(
        gapOrDivisionsValue,
        gapMode,
        maxHandicap,
        minHandicap,
        baseRaceLength,
        maxRaceLength,
        minRaceLength
      ));
    } else {
      // Points mode uses the matrix generator
      setRows(generateRaceChartRows(
        maxHandicap,
        minHandicap,
        baseRaceLength,
        false, // isPercentage = false for points
        maxRaceLength,
        minRaceLength
      ));
    }
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
      {/* Chart Settings Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            Chart Settings
            <InfoButton title="Race Chart Settings" size="sm">
              <p className="mb-2">
                <strong>Individual Race Charts</strong> determine how many games each player
                needs to win based on their handicap difference.
              </p>
              <p className="text-sm mb-2">
                This chart uses <strong>ranged lookup</strong>: the handicap difference (Diff)
                between two players determines which row applies, and the higher player&apos;s
                handicap (Highest H/C) determines the base race length.
              </p>
              <p className="text-sm mb-2">
                <strong>How it works:</strong>
              </p>
              <ol className="text-sm list-decimal list-inside mb-2 space-y-0.5">
                <li>Calculate the diff between handicaps</li>
                <li>Find the row where diff falls within range</li>
                <li>Check the higher player&apos;s handicap tier</li>
                <li>Read the race lengths for each player</li>
              </ol>
              <p className="text-xs text-gray-500">
                Use Gap/Divisions setting to control how the handicap range is divided into rows.
              </p>
            </InfoButton>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Race Length Settings - grouped together */}
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label className="text-sm font-medium">Race Length</Label>
              <InfoButton title="Race Length Settings" size="sm">
                <p className="mb-2">
                  <strong>Base</strong> is the number of games each player races to
                  when they have <strong>equal handicaps</strong>.
                </p>
                <p className="text-sm mb-2">
                  <strong>Max</strong> is the most games any player can race to
                  (highest vs lowest handicap matchup).
                </p>
                <p className="text-sm mb-2">
                  <strong>Min</strong> is the fewest games any player can race to
                  (the lower-handicapped player in an uneven matchup).
                </p>
                <p className="text-xs text-gray-500">
                  Example: Base 5, Max 7, Min 2 means equal handicaps race to 5,
                  and the range spans from 7 to 2 for uneven matchups.
                </p>
              </InfoButton>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="baseRaceLength" className="text-sm whitespace-nowrap text-gray-600">
                  Base:
                </Label>
                <Input
                  id="baseRaceLength"
                  type="number"
                  value={baseRaceLengthInput}
                  onChange={(e) => {
                    setBaseRaceLengthInput(e.target.value);
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= 1) setBaseRaceLength(val);
                  }}
                  onBlur={() => {
                    const val = parseInt(baseRaceLengthInput, 10);
                    if (isNaN(val) || val < 1) {
                      setBaseRaceLength(5);
                      setBaseRaceLengthInput('5');
                    } else {
                      setBaseRaceLengthInput(String(val));
                    }
                  }}
                  className="w-16 h-8 text-center"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="maxRaceLength" className="text-sm whitespace-nowrap text-gray-600">
                  Max:
                </Label>
                <Input
                  id="maxRaceLength"
                  type="number"
                  value={maxRaceLengthInput}
                  onChange={(e) => {
                    setMaxRaceLengthInput(e.target.value);
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= 1) setMaxRaceLength(val);
                  }}
                  onBlur={() => {
                    const val = parseInt(maxRaceLengthInput, 10);
                    if (isNaN(val) || val < 1) {
                      setMaxRaceLength(baseRaceLength + 2);
                      setMaxRaceLengthInput(String(baseRaceLength + 2));
                    } else {
                      setMaxRaceLengthInput(String(val));
                    }
                  }}
                  className="w-16 h-8 text-center"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="minRaceLength" className="text-sm whitespace-nowrap text-gray-600">
                  Min:
                </Label>
                <Input
                  id="minRaceLength"
                  type="number"
                  value={minRaceLengthInput}
                  onChange={(e) => {
                    setMinRaceLengthInput(e.target.value);
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= 1) setMinRaceLength(val);
                  }}
                  onBlur={() => {
                    const val = parseInt(minRaceLengthInput, 10);
                    if (isNaN(val) || val < 1) {
                      setMinRaceLength(2);
                      setMinRaceLengthInput('2');
                    } else {
                      setMinRaceLengthInput(String(val));
                    }
                  }}
                  className="w-16 h-8 text-center"
                />
              </div>
            </div>
          </div>

          {/* Handicap Range - grouped together */}
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label className="text-sm font-medium">Handicap Range</Label>
              <InfoButton title="Handicap Range" size="sm">
                <p className="mb-2">
                  Define the range of player skill levels in your league.
                </p>
                <p className="text-sm mb-2">
                  Supports any handicap system:
                </p>
                <ul className="text-sm list-disc list-inside mb-2 space-y-1">
                  <li>Negative numbers (e.g., +2 to -2)</li>
                  <li>Decimals (e.g., 4.5 to 2.0)</li>
                  <li>Large ranges (e.g., Fargo 200-700)</li>
                </ul>
                <p className="text-xs text-gray-500">
                  The chart will create one row for each handicap level in your range.
                </p>
              </InfoButton>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Input
                  id="maxHandicap"
                  type="number"
                  step="any"
                  value={maxHandicapInput}
                  onChange={(e) => {
                    setMaxHandicapInput(e.target.value);
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) setMaxHandicap(val);
                  }}
                  className="w-20 h-8 text-center"
                  placeholder="Max"
                />
                <span className="text-gray-500">to</span>
                <Input
                  id="minHandicap"
                  type="number"
                  step="any"
                  value={minHandicapInput}
                  onChange={(e) => {
                    setMinHandicapInput(e.target.value);
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) setMinHandicap(val);
                  }}
                  className="w-20 h-8 text-center"
                  placeholder="Min"
                />
              </div>
              {/* Gap/Divisions - only show for percentage/ranged lookup */}
              {raceChartType === 'percentage' && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (gapMode === 'gap') {
                        setGapMode('divisions');
                        setGapDivisionsInput(String(divisionsValue));
                      } else {
                        setGapMode('gap');
                        setGapDivisionsInput(String(gapValue));
                      }
                    }}
                    className="text-sm whitespace-nowrap text-blue-600 hover:text-blue-800 underline cursor-pointer"
                  >
                    {gapMode === 'gap' ? 'Gap:' : 'Divisions:'}
                  </button>
                  <InfoButton title={gapMode === 'gap' ? 'Gap Mode' : 'Divisions Mode'} size="sm">
                    {gapMode === 'gap' ? (
                      <>
                        <p className="mb-2">
                          <strong>Gap</strong> sets a fixed handicap difference for each threshold row.
                        </p>
                        <p className="text-sm mb-2">
                          <strong>Example:</strong> Gap = 15
                        </p>
                        <ul className="text-sm list-disc list-inside mb-2 space-y-0.5">
                          <li>0-15% diff (shown as 15)</li>
                          <li>16-30% diff (shown as 30)</li>
                          <li>31-45% diff (shown as 45)</li>
                          <li>etc.</li>
                        </ul>
                        <p className="text-xs text-gray-500 mt-2">
                          Click the label to switch to <strong>Divisions</strong> mode.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="mb-2">
                          <strong>Divisions</strong> splits the handicap range into equal portions.
                        </p>
                        <p className="text-sm mb-2">
                          <strong>Example:</strong> Divisions = 5 (range 0-100)
                        </p>
                        <ul className="text-sm list-disc list-inside mb-2 space-y-0.5">
                          <li>0-20% diff (shown as 20)</li>
                          <li>21-40% diff (shown as 40)</li>
                          <li>41-60% diff (shown as 60)</li>
                          <li>61-80% diff (shown as 80)</li>
                          <li>81-100% diff (shown as 100)</li>
                        </ul>
                        <p className="text-xs text-gray-500">
                          Each division = 100 ÷ 5 = 20
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                          Click the label to switch to <strong>Gap</strong> mode.
                        </p>
                      </>
                    )}
                  </InfoButton>
                  <Input
                    id="gapDivisions"
                    type="number"
                    min="1"
                    value={gapDivisionsInput}
                    onChange={(e) => {
                      setGapDivisionsInput(e.target.value);
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val >= 1) {
                        if (gapMode === 'gap') {
                          setGapValue(val);
                        } else {
                          setDivisionsValue(val);
                        }
                      }
                    }}
                    onBlur={() => {
                      const val = parseInt(gapDivisionsInput, 10);
                      if (isNaN(val) || val < 1) {
                        if (gapMode === 'gap') {
                          setGapValue(1);
                          setGapDivisionsInput('1');
                        } else {
                          setDivisionsValue(1);
                          setGapDivisionsInput('1');
                        }
                      } else {
                        setGapDivisionsInput(String(val));
                      }
                    }}
                    className="w-16 h-8 text-center"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Current Chart Range Display */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-700 font-medium">
                Current Chart Range:
              </span>
              <span className="text-sm font-semibold text-blue-900">
                {actualRaceRange.max} to {actualRaceRange.min}
              </span>
            </div>
            <p className="text-xs text-blue-600 mt-1">
              Based on current chart data - longest race: {actualRaceRange.max} games, shortest: {actualRaceRange.min} games
            </p>
          </div>

          {/* Large Range Warning - suggests ranged lookup may be needed */}
          {hasLargeRange && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    Large Handicap Range Detected ({settingsLevelCount} levels)
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    Your range from {maxHandicap} to {minHandicap} creates {settingsLevelCount} handicap levels.
                    Charts with more than 10 levels may benefit from <strong>ranged lookup</strong> instead of exact lookup.
                  </p>
                  <div className="mt-2 text-xs text-amber-700">
                    <p className="font-medium mb-1">Lookup Types:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li><strong>Exact lookup</strong> (points): Each handicap has its own row. Best for small ranges (1-10 levels).</li>
                      <li><strong>Ranged lookup</strong> (percentage): Handicaps fall into ranges. Better for large systems like Fargo (0-800).</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              className="h-8"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Regenerate Chart
            </Button>
            <p className="text-xs text-gray-500 mt-1">
              Recalculates all race lengths based on settings
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Chart Editor Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span className="flex items-center gap-2">
              Race Chart
              <InfoButton title="Race Threshold Chart" size="sm">
                <p className="mb-2">
                  <strong>How the Race Chart works:</strong>
                </p>
                <ol className="list-decimal list-inside space-y-1 text-sm mb-2">
                  <li>Each player has an individual handicap</li>
                  <li>Look up the intersection of both handicaps in this chart</li>
                  <li>The chart shows how many games each player races to</li>
                </ol>
                <p className="text-sm mb-2">
                  <strong>Example:</strong> Player A (handicap 8) vs Player B (handicap 5)
                  <br />
                  Find row 8, column 5 to see race lengths
                </p>
                <p className="text-sm mb-2">
                  <strong>Lookup Mode:</strong> This chart uses <strong>exact lookup</strong> -
                  each handicap value has its own entry. Best for small handicap ranges (up to ~10 levels).
                  For large systems like Fargo, consider using ranged lookup (percentage chart type).
                </p>
                <p className="text-xs text-gray-500">
                  The chart only stores the upper triangle (higher ≥ lower).
                  When looking up a match where the first player has a lower handicap,
                  the system automatically swaps and reverses the results.
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
          {/* Add/Remove Level Buttons (Top) */}
          <div className="flex justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAddLevel('top')}
              className="h-8"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Level ({handicapLevels[0] + (raceChartType === 'percentage' ? 20 : 1)})
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleRemoveLevel(handicapLevels[0])}
              disabled={handicapLevels.length <= 2}
              className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Remove Top Level
            </Button>
          </div>

          {/* Mobile List View - shown on small screens */}
          <div className="block md:hidden border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="border-b">
                  <th className="text-center py-2 px-2 font-medium text-gray-700">Diff</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-700">Highest H/C</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-700">P1 Race</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-700">P2 Race</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const isEqual = row.player1Handicap === row.player2Handicap;
                  return (
                    <tr key={idx} className={`border-b last:border-b-0 ${isEqual ? 'bg-blue-50' : ''}`}>
                      {/* Diff (player1Handicap) - always editable */}
                      <td className="text-center py-1.5 px-1">
                        <Input
                          type="number"
                          value={row.player1Handicap}
                          onChange={(e) => {
                            const newVal = parseInt(e.target.value, 10) || 0;
                            const newRows = rows.map((r, i) =>
                              i === idx ? { ...r, player1Handicap: newVal } : r
                            );
                            setRows(newRows);
                          }}
                          className="w-14 h-7 text-center text-sm mx-auto"
                        />
                      </td>
                      {/* Highest H/C (player2Handicap) - always editable */}
                      <td className="text-center py-1.5 px-1">
                        <Input
                          type="number"
                          value={row.player2Handicap}
                          onChange={(e) => {
                            const newVal = parseInt(e.target.value, 10) || 0;
                            const newRows = rows.map((r, i) =>
                              i === idx ? { ...r, player2Handicap: newVal } : r
                            );
                            setRows(newRows);
                          }}
                          className="w-14 h-7 text-center text-sm mx-auto"
                        />
                      </td>
                      <td className="text-center py-1.5 px-1">
                        <Input
                          type="number"
                          min="1"
                          max="15"
                          value={row.player1Wins ?? ''}
                          onChange={(e) =>
                            handleCellChange(
                              row.player1Handicap,
                              row.player2Handicap,
                              'player1Wins',
                              e.target.value ? parseInt(e.target.value, 10) : null
                            )
                          }
                          className="w-14 h-7 text-center text-sm mx-auto"
                        />
                      </td>
                      <td className="text-center py-1.5 px-1">
                        <Input
                          type="number"
                          min="1"
                          max="15"
                          value={row.player2Wins ?? ''}
                          onChange={(e) =>
                            handleCellChange(
                              row.player1Handicap,
                              row.player2Handicap,
                              'player2Wins',
                              e.target.value ? parseInt(e.target.value, 10) : null
                            )
                          }
                          className="w-14 h-7 text-center text-sm mx-auto"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Legend */}
          <div className="block md:hidden text-xs text-gray-500 space-y-1">
            <p>
              <span className="inline-block w-3 h-3 bg-blue-50 border mr-1"></span>
              Equal handicaps (same race for both players)
            </p>
            <p>P1 H/C = Higher handicap player, P2 H/C = Lower handicap player</p>
          </div>

          {/* Desktop Matrix View - hidden on small screens */}
          <div className="hidden md:block border rounded-lg overflow-x-auto">
            <table className="text-sm">
              <thead className="bg-gray-50">
                <tr className="border-b">
                  <th className="text-center py-2 px-2 font-medium text-gray-700 bg-gray-100 sticky left-0">
                    Diff \ Highest H/C
                  </th>
                  {handicapLevels.map((level) => (
                    <th key={level} className="text-center py-2 px-2 font-medium text-gray-700 min-w-[60px]">
                      {level}
                      {raceChartType === 'percentage' && '%'}
                    </th>
                  ))}
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {handicapLevels.map((rowLevel) => (
                  <tr key={rowLevel} className="border-b last:border-b-0">
                    {/* Row header (Player 1 handicap) */}
                    <td className="py-1.5 px-2 font-medium text-gray-700 bg-gray-50 sticky left-0">
                      {rowLevel}
                      {raceChartType === 'percentage' && '%'}
                    </td>

                    {/* Cells for each column (Player 2 handicap) */}
                    {handicapLevels.map((colLevel) => {
                      // Only show upper triangle (rowLevel >= colLevel)
                      if (rowLevel < colLevel) {
                        return (
                          <td key={colLevel} className="py-1.5 px-1 bg-gray-100 text-center text-gray-400">
                            —
                          </td>
                        );
                      }

                      const row = getRowForCell(rowLevel, colLevel);
                      const isEqual = rowLevel === colLevel;

                      return (
                        <td key={colLevel} className={`py-1.5 px-1 ${isEqual ? 'bg-blue-50' : ''}`}>
                          <div className="flex flex-col gap-0.5 items-center">
                            {/* Player 1 wins */}
                            <Input
                              type="number"
                              min="1"
                              max="15"
                              value={row?.player1Wins ?? ''}
                              onChange={(e) =>
                                handleCellChange(
                                  rowLevel,
                                  colLevel,
                                  'player1Wins',
                                  e.target.value ? parseInt(e.target.value, 10) : null
                                )
                              }
                              className="w-12 h-6 text-center text-xs px-1"
                              placeholder="—"
                              title={`P1 (${rowLevel}) races to`}
                            />
                            <Input
                              type="number"
                              min="1"
                              max="15"
                              value={row?.player2Wins ?? ''}
                              onChange={(e) =>
                                handleCellChange(
                                  rowLevel,
                                  colLevel,
                                  'player2Wins',
                                  e.target.value ? parseInt(e.target.value, 10) : null
                                )
                              }
                              className="w-12 h-6 text-center text-xs px-1"
                              placeholder="—"
                              title={`P2 (${colLevel}) races to`}
                            />
                          </div>
                        </td>
                      );
                    })}

                    {/* Delete button */}
                    <td className="py-1.5 px-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveLevel(rowLevel)}
                        className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                        disabled={handicapLevels.length <= 2}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Desktop Legend - hidden on mobile */}
          <div className="hidden md:block text-xs text-gray-500 space-y-1">
            <p>
              <span className="inline-block w-3 h-3 bg-blue-50 border mr-1"></span>
              Equal handicaps (same race length for both)
            </p>
            <p>
              <span className="inline-block w-3 h-3 bg-gray-100 border mr-1"></span>
              Mirror of upper triangle (lookup swaps automatically)
            </p>
            <p>In each cell: Top = Higher handicap player&apos;s race, Bottom = Lower handicap player&apos;s race</p>
          </div>

          {/* Add/Remove Level Buttons (Bottom) */}
          <div className="flex justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAddLevel('bottom')}
              className="h-8"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Level ({handicapLevels[handicapLevels.length - 1] - (raceChartType === 'percentage' ? 20 : 1)})
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleRemoveLevel(handicapLevels[handicapLevels.length - 1])}
              disabled={handicapLevels.length <= 2}
              className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Remove Bottom Level
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
            {hasCriticalIssues && (
              <div className="text-sm">
                <p className="font-medium text-red-700 mb-1">
                  Critical Issues ({criticalRows.length} cell{criticalRows.length !== 1 ? 's' : ''}):
                </p>
                <p className="text-gray-700">
                  Some cells have extreme race lengths (≥{maxRace} or ≤1 games).
                  This may create unfair matchups.
                </p>
              </div>
            )}

            {hasMissingRows && (
              <div className="text-sm">
                <p className="font-medium text-orange-700 mb-1">Missing Cells:</p>
                <p className="text-gray-700">
                  Some handicap combinations are missing from the chart.
                  Use &quot;Regenerate Chart&quot; to fill all combinations.
                </p>
              </div>
            )}

            {hasManualEdits && (
              <div className="text-sm">
                <p className="font-medium text-orange-700 mb-1">Manual Edits Detected:</p>
                <p className="text-gray-700">
                  This chart has been manually edited. Verify race lengths are fair for all matchups.
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
