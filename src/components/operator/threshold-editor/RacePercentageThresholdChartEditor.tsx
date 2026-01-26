/**
 * @fileoverview Race Percentage Threshold Chart Editor
 *
 * Editor for individual race (player vs player) threshold charts using 2D RANGED lookup.
 * This chart uses TWO dimensions to determine race lengths:
 *
 * 1. GAP - The difference between the two players' handicaps (determines handicap advantage)
 * 2. SKILL LEVEL - The higher player's handicap tier (determines base race length)
 *
 * Key concept:
 * - Player A (99%) vs Player B (90%): Gap=9, Higher=99 → high skill tier, small gap → 5-5
 * - Player A (52%) vs Player B (49%): Gap=3, Higher=52 → low skill tier, small gap → 4-4
 * - Player A (85%) vs Player B (55%): Gap=30, Higher=85 → high skill tier, medium gap → 5-4
 *
 * The base race length decreases as skill levels decrease (same as points-based race chart).
 * This ensures lower-skilled players play shorter races.
 *
 * Chart structure (2D matrix):
 * - Rows: Gap ranges (e.g., 0-15, 16-30, 31-45)
 * - Columns: Skill level tiers (e.g., 80-100, 60-79, 40-59, 20-39)
 * - Each cell: [higherRacesTo, lowerRacesTo]
 *
 * Database storage:
 * - comp_1 = max gap for this range (e.g., 15 means "gaps 0-15")
 * - comp_2 = min handicap for this skill tier (e.g., 80 means "handicaps 80-100")
 * - result_1 = Games higher-handicapped player races to
 * - result_3 = Games lower-handicapped player races to
 * - result_2 = NULL (no ties in races)
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
 * Single cell in the 2D race percentage threshold chart
 *
 * Each cell represents a specific (gap range, skill tier) combination.
 */
export interface RacePercentageChartRow {
  /** Maximum gap for this range (e.g., 15 means gaps 0-15) - stored in comp_1 */
  maxGap: number;
  /** Minimum handicap for this skill tier (e.g., 80 means handicaps 80-100) - stored in comp_2 */
  minSkillLevel: number;
  /** Games the higher-handicapped player races to - stored in result_1 */
  higherRacesTo: number | null;
  /** Games the lower-handicapped player races to - stored in result_3 */
  lowerRacesTo: number | null;
}

/**
 * Generate default race percentage chart rows
 *
 * Creates a 2D matrix with:
 * - 6 gap ranges: 0-15, 16-30, 31-45, 46-60, 61-75, 76+
 * - 5 skill tiers: 80-100, 60-79, 40-59, 20-39, 0-19
 *
 * Base race decreases by skill tier (5 for top, 4 for next, etc.)
 * Gap adjustments applied on top of base.
 */
export function getDefaultRacePercentageChartRows(): RacePercentageChartRow[] {
  const rows: RacePercentageChartRow[] = [];

  // Gap thresholds (comp_1 values)
  const gapThresholds = [15, 30, 45, 60, 75, 999];

  // Skill tier thresholds (comp_2 values) - higher numbers = higher skill
  // 80 means "80-100", 60 means "60-79", etc.
  const skillTiers = [80, 60, 40, 20, 0];

  // Base race lengths for each skill tier (highest skill = longest base)
  const baseLengths = [5, 5, 4, 4, 3];

  skillTiers.forEach((minSkill, tierIndex) => {
    const base = baseLengths[tierIndex];

    gapThresholds.forEach((maxGap, gapIndex) => {
      // Calculate race lengths using alternating algorithm
      let higherRacesTo = base;
      let lowerRacesTo = base;

      // Apply gap adjustments
      // diff 1: lower -1
      // diff 2: higher +1
      // diff 3: lower -1
      // diff 4: higher +1
      for (let d = 1; d <= gapIndex; d++) {
        if (d % 2 === 1) {
          lowerRacesTo--;
        } else {
          higherRacesTo++;
        }
      }

      // Apply limits (max 7, min 2)
      higherRacesTo = Math.min(7, Math.max(2, higherRacesTo));
      lowerRacesTo = Math.min(7, Math.max(2, lowerRacesTo));

      rows.push({
        maxGap,
        minSkillLevel: minSkill,
        higherRacesTo,
        lowerRacesTo,
      });
    });
  });

  return rows;
}

/**
 * Generate race chart rows from settings
 *
 * Creates a 2D matrix based on provided settings.
 *
 * @param baseRaceLength - Base race length for highest skill tier at gap 0
 * @param maxRaceLength - Maximum games any player can race to
 * @param minRaceLength - Minimum games any player can race to
 * @param gapThresholds - Array of max gap values for each range
 * @param skillTiers - Array of min handicap values for each tier (descending)
 * @param baseReductionPerTier - How much to reduce base for each lower tier (default 0.5)
 */
export function generateRacePercentageChartRows(
  baseRaceLength: number,
  maxRaceLength: number,
  minRaceLength: number,
  gapThresholds: number[],
  skillTiers: number[],
  baseReductionPerTier: number = 0.5
): RacePercentageChartRow[] {
  const rows: RacePercentageChartRow[] = [];

  skillTiers.forEach((minSkill, tierIndex) => {
    // Calculate base for this tier (reduces as skill decreases)
    // Use rounding to handle 0.5 reductions properly
    const base = Math.round(baseRaceLength - tierIndex * baseReductionPerTier);

    gapThresholds.forEach((maxGap, gapIndex) => {
      let higherRacesTo = base;
      let lowerRacesTo = base;

      // Apply gap adjustments using alternating algorithm
      for (let d = 1; d <= gapIndex; d++) {
        if (d % 2 === 1) {
          lowerRacesTo--;
        } else {
          higherRacesTo++;
        }
      }

      // Apply limits
      higherRacesTo = Math.min(maxRaceLength, Math.max(minRaceLength, higherRacesTo));
      lowerRacesTo = Math.min(maxRaceLength, Math.max(minRaceLength, lowerRacesTo));

      rows.push({
        maxGap,
        minSkillLevel: minSkill,
        higherRacesTo,
        lowerRacesTo,
      });
    });
  });

  return rows;
}

/**
 * Calculate the actual max and min race lengths from chart data
 */
export function calculateRacePercentageLengthRange(
  rows: RacePercentageChartRow[]
): { max: number; min: number } {
  let max = 0;
  let min = Infinity;

  rows.forEach((row) => {
    if (row.higherRacesTo !== null) {
      max = Math.max(max, row.higherRacesTo);
      min = Math.min(min, row.higherRacesTo);
    }
    if (row.lowerRacesTo !== null) {
      max = Math.max(max, row.lowerRacesTo);
      min = Math.min(min, row.lowerRacesTo);
    }
  });

  if (min === Infinity) min = 0;

  return { max, min };
}

/**
 * Extract unique gap thresholds from rows
 */
function getUniqueGapThresholds(rows: RacePercentageChartRow[]): number[] {
  const gaps = [...new Set(rows.map((r) => r.maxGap))];
  return gaps.sort((a, b) => a - b);
}

/**
 * Extract unique skill tiers from rows
 */
function getUniqueSkillTiers(rows: RacePercentageChartRow[]): number[] {
  const tiers = [...new Set(rows.map((r) => r.minSkillLevel))];
  return tiers.sort((a, b) => b - a); // Descending (highest first)
}

interface RacePercentageThresholdChartEditorProps {
  /** Initial chart data (if loading from saved) */
  initialData?: RacePercentageChartRow[] | null;
  /** Callback when save is clicked */
  onSave?: (data: RacePercentageChartRow[]) => void;
  /** Callback when cancel/back is clicked */
  onCancel?: () => void;
  /** Whether save is in progress */
  isSaving?: boolean;
  /** Callback when unsaved changes state changes - allows parent to track dirty state */
  onUnsavedChangesChange?: (hasUnsavedChanges: boolean) => void;
}

/**
 * Race Percentage Threshold Chart Editor
 *
 * Editor for 2D gap-based race threshold charts.
 * Uses both gap ranges AND skill level tiers to determine race lengths.
 */
export function RacePercentageThresholdChartEditor({
  initialData,
  onSave,
  onCancel,
  isSaving = false,
  onUnsavedChangesChange,
}: RacePercentageThresholdChartEditorProps) {
  // Chart data state
  const [rows, setRows] = useState<RacePercentageChartRow[]>(
    initialData ?? getDefaultRacePercentageChartRows()
  );

  // Race length settings
  const [baseRaceLength, setBaseRaceLength] = useState(5);
  const [maxRaceLength, setMaxRaceLength] = useState(7);
  const [minRaceLength, setMinRaceLength] = useState(2);

  // String values for inputs
  const [baseRaceLengthInput, setBaseRaceLengthInput] = useState('5');
  const [maxRaceLengthInput, setMaxRaceLengthInput] = useState('7');
  const [minRaceLengthInput, setMinRaceLengthInput] = useState('2');

  // Whether to ignore chart warnings
  const [ignoreWarnings, setIgnoreWarnings] = useState(false);

  // Extract gap thresholds and skill tiers from current data
  const gapThresholds = useMemo(() => getUniqueGapThresholds(rows), [rows]);
  const skillTiers = useMemo(() => getUniqueSkillTiers(rows), [rows]);

  // Calculate the actual race length range from current chart data
  const actualRaceRange = useMemo(() => calculateRacePercentageLengthRange(rows), [rows]);

  // Track if chart has been modified from default
  const defaultRows = getDefaultRacePercentageChartRows();
  const isCustomized = JSON.stringify(rows) !== JSON.stringify(defaultRows);

  // Check for critical issues
  const criticalRows = rows.filter(
    (row) =>
      row.higherRacesTo !== null &&
      row.lowerRacesTo !== null &&
      (row.higherRacesTo >= maxRaceLength + 3 ||
        row.lowerRacesTo <= 1 ||
        row.higherRacesTo <= 1 ||
        row.lowerRacesTo >= maxRaceLength + 3)
  );
  const hasCriticalIssues = criticalRows.length > 0;

  // Check if chart matches default
  const matchesDefaultChart = JSON.stringify(rows) === JSON.stringify(defaultRows);
  const hasManualEdits = !matchesDefaultChart;

  const hasAnyIssues = hasCriticalIssues || hasManualEdits;

  // Track unsaved changes
  const [savedRows, setSavedRows] = useState<RacePercentageChartRow[]>(
    initialData ?? getDefaultRacePercentageChartRows()
  );
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
   * Regenerate chart from current settings
   */
  const handleRegenerate = () => {
    setRows(
      generateRacePercentageChartRows(
        baseRaceLength,
        maxRaceLength,
        minRaceLength,
        gapThresholds,
        skillTiers
      )
    );
  };

  /**
   * Reset to default chart
   */
  const handleReset = () => {
    setRows(getDefaultRacePercentageChartRows());
    setBaseRaceLength(5);
    setMaxRaceLength(7);
    setMinRaceLength(2);
    setBaseRaceLengthInput('5');
    setMaxRaceLengthInput('7');
    setMinRaceLengthInput('2');
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
            <InfoButton title="Race Percentage Chart Settings" size="sm">
              <p className="mb-2">
                <strong>2D Gap-Based Race Charts</strong> use two factors to determine race lengths:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-sm mb-2">
                <li><strong>Gap</strong> - The handicap difference between players</li>
                <li><strong>Skill Level</strong> - The higher player&apos;s handicap tier</li>
              </ol>
              <p className="text-sm mb-2">
                <strong>Why two dimensions?</strong> Higher-skilled players play longer races.
                A 99% vs 90% (gap 9) plays 5-5, but a 52% vs 49% (same gap 3) plays 4-4 because
                the skill level is lower.
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
                  <strong>Base</strong> is the race length for the highest skill tier
                  with no gap (even matchup).
                </p>
                <p className="text-sm mb-2">
                  <strong>Max</strong> is the most games any player can race to.
                </p>
                <p className="text-sm mb-2">
                  <strong>Min</strong> is the fewest games any player can race to.
                </p>
                <p className="text-xs text-gray-500">
                  The base decreases for lower skill tiers (like the points-based race chart).
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
                      setMaxRaceLength(7);
                      setMaxRaceLengthInput('7');
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
              {gapThresholds.length} gap ranges × {skillTiers.length} skill tiers = {rows.length} cells
            </p>
          </div>

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
              Race Chart (Gap × Skill Level)
              <InfoButton title="2D Race Chart" size="sm">
                <p className="mb-2">
                  <strong>How to read this chart:</strong>
                </p>
                <ol className="list-decimal list-inside space-y-1 text-sm mb-2">
                  <li>Calculate the gap between the two players</li>
                  <li>Find the column for the higher player&apos;s skill tier</li>
                  <li>Find the row for the gap range</li>
                  <li>The cell shows [Higher races to]-[Lower races to]</li>
                </ol>
                <p className="text-sm mb-2">
                  <strong>Example:</strong> 85% vs 55%
                  <br />
                  Gap = 30 → Row &quot;16-30&quot;
                  <br />
                  Higher = 85% → Column &quot;80-100%&quot;
                  <br />
                  Result: 5-4 race
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
          {/* Add/Remove Row Buttons (Top) */}
          <div className="flex justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const firstRow = rows[0];
                setRows([
                  {
                    maxGap: firstRow ? Math.max(0, firstRow.maxGap - 15) : 0,
                    minSkillLevel: firstRow ? firstRow.minSkillLevel : 80,
                    higherRacesTo: baseRaceLength,
                    lowerRacesTo: baseRaceLength,
                  },
                  ...rows,
                ]);
              }}
              className="h-8"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Row
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (rows.length > 1) {
                  setRows(rows.slice(1));
                }
              }}
              disabled={rows.length <= 1}
              className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Remove Top Row
            </Button>
          </div>

          {/* Chart Table */}
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="border-b">
                  <th className="text-center py-2 px-2 font-medium text-gray-700">
                    Diff
                  </th>
                  <th className="text-center py-2 px-2 font-medium text-gray-700">
                    Highest H/C
                  </th>
                  <th className="text-center py-2 px-2 font-medium text-gray-700">
                    P1 Race
                  </th>
                  <th className="text-center py-2 px-2 font-medium text-gray-700">
                    P2 Race
                  </th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const isEven = row.higherRacesTo === row.lowerRacesTo;

                  return (
                    <tr
                      key={index}
                      className={`border-b last:border-b-0 ${isEven ? 'bg-blue-50' : ''}`}
                    >
                      {/* Diff (max gap threshold) */}
                      <td className="py-1.5 px-2">
                        <Input
                          type="number"
                          min="0"
                          value={row.maxGap >= 999 ? '' : row.maxGap}
                          placeholder="∞"
                          onChange={(e) => {
                            const newRows = [...rows];
                            newRows[index] = {
                              ...newRows[index],
                              maxGap: e.target.value ? parseInt(e.target.value, 10) : 999,
                            };
                            setRows(newRows);
                          }}
                          className="w-16 h-8 text-center text-sm"
                        />
                      </td>

                      {/* Highest H/C (min skill level threshold) */}
                      <td className="py-1.5 px-2">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={row.minSkillLevel}
                          onChange={(e) => {
                            const newRows = [...rows];
                            newRows[index] = {
                              ...newRows[index],
                              minSkillLevel: parseInt(e.target.value, 10) || 0,
                            };
                            setRows(newRows);
                          }}
                          className="w-16 h-8 text-center text-sm"
                        />
                      </td>

                      {/* P1 Race (higher races to) */}
                      <td className="py-1.5 px-2">
                        <Input
                          type="number"
                          min="1"
                          max="15"
                          value={row.higherRacesTo ?? ''}
                          onChange={(e) => {
                            const newRows = [...rows];
                            newRows[index] = {
                              ...newRows[index],
                              higherRacesTo: e.target.value ? parseInt(e.target.value, 10) : null,
                            };
                            setRows(newRows);
                          }}
                          className="w-16 h-8 text-center text-sm"
                          placeholder="—"
                        />
                      </td>

                      {/* P2 Race (lower races to) */}
                      <td className="py-1.5 px-2">
                        <Input
                          type="number"
                          min="1"
                          max="15"
                          value={row.lowerRacesTo ?? ''}
                          onChange={(e) => {
                            const newRows = [...rows];
                            newRows[index] = {
                              ...newRows[index],
                              lowerRacesTo: e.target.value ? parseInt(e.target.value, 10) : null,
                            };
                            setRows(newRows);
                          }}
                          className="w-16 h-8 text-center text-sm"
                          placeholder="—"
                        />
                      </td>

                      {/* Delete */}
                      <td className="py-1.5 px-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (rows.length <= 1) return;
                            setRows(rows.filter((_, i) => i !== index));
                          }}
                          className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
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

          {/* Add/Remove Row Buttons (Bottom) */}
          <div className="flex justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const lastRow = rows[rows.length - 1];
                setRows([
                  ...rows,
                  {
                    maxGap: lastRow ? lastRow.maxGap + 15 : 15,
                    minSkillLevel: lastRow ? lastRow.minSkillLevel : 80,
                    higherRacesTo: baseRaceLength,
                    lowerRacesTo: baseRaceLength,
                  },
                ]);
              }}
              className="h-8"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Row
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (rows.length > 1) {
                  setRows(rows.slice(0, -1));
                }
              }}
              disabled={rows.length <= 1}
              className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Remove Bottom Row
            </Button>
          </div>

          {/* Legend */}
          <div className="text-xs text-gray-500 space-y-1">
            <p>
              <span className="inline-block w-3 h-3 bg-blue-50 border mr-1"></span>
              Even race (both players race to same number)
            </p>
            <p>
              <strong>Diff</strong> = max handicap difference for this row,{' '}
              <strong>Highest H/C</strong> = min handicap of higher player
            </p>
            <p>
              <strong>P1</strong> = higher-handicapped player,{' '}
              <strong>P2</strong> = lower-handicapped player
            </p>
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
                  Critical Issues ({criticalRows.length} cell
                  {criticalRows.length !== 1 ? 's' : ''}):
                </p>
                <p className="text-gray-700">
                  Some cells have extreme race lengths. This may create unfair matchups.
                </p>
              </div>
            )}

            {hasManualEdits && !hasCriticalIssues && (
              <div className="text-sm">
                <p className="font-medium text-orange-700 mb-1">Manual Edits Detected:</p>
                <p className="text-gray-700">
                  This chart has been manually edited. Verify race lengths are fair for all combinations.
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
