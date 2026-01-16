/**
 * @fileoverview Thresholds Section Component
 *
 * Displays and allows editing of games-to-win and games-to-tie thresholds.
 * Includes a collapsible options accordion showing the threshold chart/system.
 *
 * Threshold Systems:
 * - Points: 18 games, handicap range -12 to +12, ties possible on even diffs
 * - Percentage: 25 games, BCA ranges, no ties (odd game count)
 * - Custom: Manual entry for non-standard formats
 *
 * Layout:
 * - Threshold Options accordion: Shows which system is in use + chart preview
 * - Current Match Thresholds: Calculated values with edit capability
 *
 * Chart editing is done on a separate dedicated page (PointsThresholdChartPage).
 *
 * @example
 * <ThresholdsSection
 *   editorState={state}
 *   editorActions={actions}
 *   homeTeamName="Ball Busters"
 *   awayTeamName="Chalk & Awe"
 *   leagueId="123"
 * />
 */

import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Target, RefreshCw, ExternalLink, BarChart3 } from 'lucide-react';
import { InfoButton } from '@/components/InfoButton';
import { get3v3GamesNeeded } from '@/utils/handicap/get3v3GamesNeeded';
import { get5v5GamesNeeded } from '@/utils/handicap/get5v5GamesNeeded';
import type {
  MatchEditorState,
  Thresholds,
} from './useMatchEditorState';

/**
 * Threshold system type - derived from handicap type in SetupOptions
 * - points: Points-based handicapping (exact diff lookup)
 * - percentage: Percentage-based handicapping (range lookup)
 * - custom: Manual entry
 */
type ThresholdSystem = 'points' | 'percentage' | 'custom';

interface ThresholdsSectionProps {
  /** League ID for navigation to chart editor */
  leagueId?: string;
  /** Home team thresholds (legacy prop) */
  homeThresholds?: {
    win: number | null;
    tie: number | null;
  };
  /** Away team thresholds (legacy prop) */
  awayThresholds?: {
    win: number | null;
    tie: number | null;
  };
  /** League settings for determining auto-generate eligibility (legacy prop) */
  leagueSettings?: {
    handicap_variant?: string;
    team_format?: string;
  };
  /** Number of players in lineup (legacy prop) */
  playerCount?: number;
  /** Current editor state (from useMatchEditorState) */
  editorState?: MatchEditorState;
  /** Editor actions (from useMatchEditorState) */
  editorActions?: {
    setThresholds: (thresholds: Partial<Thresholds>) => void;
    generateThresholds: (thresholds: Thresholds) => void;
  };
  /** Home team name for display */
  homeTeamName?: string;
  /** Away team name for display */
  awayTeamName?: string;
  /** Callback when any value changes (legacy - deprecated with state hook) */
  onChange?: () => void;
}

/**
 * Calculate thresholds for a points-based match
 */
function calculatePointsThresholds(homeTotal: number, awayTotal: number): Thresholds {
  const diff = homeTotal - awayTotal;
  const homeThresholds = get3v3GamesNeeded(diff);
  const awayThresholds = get3v3GamesNeeded(-diff);

  return {
    homeWin: homeThresholds.games_to_win,
    homeTie: homeThresholds.games_to_tie,
    awayWin: awayThresholds.games_to_win,
    awayTie: awayThresholds.games_to_tie,
  };
}

/**
 * Calculate thresholds for a percentage-based match
 */
function calculatePercentageThresholds(homeTotal: number, awayTotal: number): Thresholds {
  const diff = homeTotal - awayTotal;
  const homeThresholds = get5v5GamesNeeded(diff);
  const awayThresholds = get5v5GamesNeeded(-diff);

  return {
    homeWin: homeThresholds.games_to_win,
    homeTie: null,
    awayWin: awayThresholds.games_to_win,
    awayTie: null,
  };
}

/**
 * Points Threshold Chart Display (Read-only preview)
 *
 * Shows a compact preview of the points threshold chart.
 * Full editing is done on the dedicated page.
 */
function PointsChartPreview({ highlightDiff }: { highlightDiff?: number }) {
  // Generate rows from default chart
  const rows: Array<{ diff: number; win: number; tie: number | null; lose: number }> = [];
  for (let diff = 12; diff >= -12; diff--) {
    const thresholds = get3v3GamesNeeded(diff);
    rows.push({
      diff,
      win: thresholds.games_to_win,
      tie: thresholds.games_to_tie,
      lose: thresholds.games_to_lose,
    });
  }

  const roundedHighlight = highlightDiff !== undefined ? Math.round(highlightDiff) : undefined;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-2 font-medium text-gray-600">
              Diff (exact)
              <span onClick={(e) => e.stopPropagation()} className="ml-1 inline-block align-middle">
                <InfoButton title="Handicap Difference" size="sm">
                  <p className="mb-2">
                    <strong>How to calculate the handicap difference:</strong>
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-sm mb-2">
                    <li>Each player in a lineup has a handicap</li>
                    <li>Add all players&apos; handicaps together to get the team&apos;s total handicap</li>
                    <li>Subtract one team&apos;s total from the other to find the differential (diff)</li>
                    <li>The diff determines how many games each team needs to win the night</li>
                  </ol>
                  <p className="text-sm mb-2">
                    <strong>Note:</strong> The higher handicap team has a positive diff, the lower handicap team has the negative of the same number.
                  </p>
                  <p className="text-xs text-gray-500">
                    Example: Team A total = 6, Team B total = 2 → Team A diff = +4, Team B diff = -4
                  </p>
                </InfoButton>
              </span>
            </th>
            <th className="text-center py-2 px-2 font-medium text-gray-600">Win</th>
            <th className="text-center py-2 px-2 font-medium text-gray-600">Tie</th>
            <th className="text-center py-2 px-2 font-medium text-gray-600">Lose</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isHighlighted = roundedHighlight !== undefined && roundedHighlight === row.diff;
            return (
              <tr
                key={row.diff}
                className={`border-b border-gray-100 ${isHighlighted ? 'bg-blue-50 font-medium' : ''}`}
              >
                <td className="py-1.5 px-2 text-gray-700">
                  {row.diff >= 0 ? `+${row.diff}` : row.diff}
                </td>
                <td className="py-1.5 px-2 text-center">{row.win}</td>
                <td className="py-1.5 px-2 text-center text-gray-500">{row.tie ?? '—'}</td>
                <td className="py-1.5 px-2 text-center">{row.lose}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Percentage Threshold Chart Display (Read-only)
 *
 * Shows the percentage/BCA ranges in a readable format
 */
function PercentageChartPreview({ highlightDiff }: { highlightDiff?: number }) {
  const ranges = [
    { min: 0, max: 14, higher: 13, lower: 13 },
    { min: 15, max: 40, higher: 14, lower: 12 },
    { min: 41, max: 66, higher: 15, lower: 11 },
    { min: 67, max: 92, higher: 16, lower: 10 },
    { min: 93, max: 118, higher: 17, lower: 9 },
    { min: 119, max: 144, higher: 18, lower: 8 },
    { min: 145, max: 999, higher: 19, lower: 7 },
  ];

  const absDiff = highlightDiff !== undefined ? Math.abs(Math.round(highlightDiff)) : undefined;
  const highlightRangeIndex = absDiff !== undefined
    ? ranges.findIndex(r => absDiff >= r.min && absDiff <= r.max)
    : -1;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-2 font-medium text-gray-600">
              Diff (range)
              <span onClick={(e) => e.stopPropagation()} className="ml-1 inline-block align-middle">
                <InfoButton title="Handicap Difference" size="sm">
                  <p className="mb-2">
                    <strong>How to calculate the handicap difference:</strong>
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-sm mb-2">
                    <li>Each player in a lineup has a handicap (percentage)</li>
                    <li>Add all players&apos; handicaps together to get the team&apos;s total handicap</li>
                    <li>Subtract one team&apos;s total from the other to find the differential (diff)</li>
                    <li>The diff determines how many games each team needs to win the night</li>
                  </ol>
                  <p className="text-sm mb-2">
                    <strong>Note:</strong> The higher handicap team has a positive diff, the lower handicap team has the negative of the same number. The chart shows ranges based on the absolute value.
                  </p>
                  <p className="text-xs text-gray-500">
                    Example: Team A total = 276%, Team B total = 260% → Team A diff = +16, Team B diff = -16 (both fall in 15-40 range)
                  </p>
                </InfoButton>
              </span>
            </th>
            <th className="text-center py-2 px-2 font-medium text-gray-600">Higher Wins</th>
            <th className="text-center py-2 px-2 font-medium text-gray-600">Lower Wins</th>
          </tr>
        </thead>
        <tbody>
          {ranges.map((range, idx) => {
            const isHighlighted = idx === highlightRangeIndex;
            return (
              <tr
                key={range.min}
                className={`border-b border-gray-100 ${isHighlighted ? 'bg-blue-50 font-medium' : ''}`}
              >
                <td className="py-1.5 px-2 text-gray-700">
                  {range.max === 999 ? `${range.min}+` : `${range.min}-${range.max}`}
                </td>
                <td className="py-1.5 px-2 text-center">{range.higher}</td>
                <td className="py-1.5 px-2 text-center">{range.lower}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-gray-500 mt-2">
        25 total games • No ties (odd game count)
      </p>
    </div>
  );
}

// ThresholdOptionsCard has been removed - settings now in SetupOptions component
// Chart previews are shown in an inline collapsible section below

/**
 * Threshold Chart Preview Card
 *
 * Collapsible accordion showing the threshold chart preview.
 * Settings (system/mode) are controlled by SetupOptions at page level.
 * Links to dedicated chart editor page.
 */
function ThresholdChartPreviewCard({
  leagueId,
  currentSystem,
  handicapDiff,
  lineupSize,
}: {
  leagueId?: string;
  currentSystem: ThresholdSystem;
  handicapDiff: number;
  lineupSize: number;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Navigate to the threshold chart editor page
   */
  const handleEditChart = () => {
    if (!leagueId) return;
    const chartType = currentSystem === 'percentage' ? 'percentage' : 'points';
    const returnTo = encodeURIComponent(location.pathname);
    navigate(`/league/${leagueId}/threshold-chart/${chartType}?returnTo=${returnTo}&lineupSize=${lineupSize}`);
  };

  // Don't show for custom system
  if (currentSystem === 'custom') {
    return null;
  }

  return (
    <Card>
      <Accordion type="single" collapsible defaultValue="">
        <AccordionItem value="chart" className="border-b-0">
          <AccordionTrigger className="px-6 py-3 hover:no-underline">
            <div className="flex items-center gap-2 text-sm font-medium">
              <BarChart3 className="h-4 w-4" />
              {currentSystem === 'points' ? 'Points Threshold Chart' : 'Percentage Threshold Chart'}
              <span className="text-xs font-normal text-gray-500 ml-2">
                (diff: {handicapDiff >= 0 ? '+' : ''}{handicapDiff.toFixed(1)})
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-4">
            <div className="space-y-3">
              {/* Edit Chart button */}
              {leagueId && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleEditChart}
                    className="h-7 text-xs"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Edit Chart
                  </Button>
                </div>
              )}

              {/* Chart preview */}
              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-2">
                {currentSystem === 'points' ? (
                  <PointsChartPreview highlightDiff={handicapDiff} />
                ) : (
                  <PercentageChartPreview highlightDiff={handicapDiff} />
                )}
              </div>
              <p className="text-xs text-gray-500">
                Current handicap difference: <span className="font-medium">{handicapDiff >= 0 ? '+' : ''}{handicapDiff.toFixed(1)}</span>
                {' '}(highlighted row)
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}

/**
 * Single threshold input row
 */
function ThresholdInput({
  label,
  winValue,
  tieValue,
  onWinChange,
  onTieChange,
  showTie = true,
  readOnly = false,
}: {
  label: string;
  winValue: number | null;
  tieValue: number | null;
  onWinChange: (value: number | null) => void;
  onTieChange: (value: number | null) => void;
  showTie?: boolean;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Label className="text-xs text-gray-500 w-8">Win:</Label>
          <Input
            type="number"
            min="1"
            max="25"
            value={winValue ?? ''}
            onChange={(e) => {
              const val = e.target.value ? parseInt(e.target.value, 10) : null;
              onWinChange(val);
            }}
            className={`w-16 h-8 text-center text-sm ${readOnly ? 'bg-gray-50' : ''}`}
            placeholder="—"
            readOnly={readOnly}
          />
        </div>
        {showTie && (
          <div className="flex items-center gap-1">
            <Label className="text-xs text-gray-500 w-8">Tie:</Label>
            <Input
              type="number"
              min="1"
              max="25"
              value={tieValue ?? ''}
              onChange={(e) => {
                const val = e.target.value ? parseInt(e.target.value, 10) : null;
                onTieChange(val);
              }}
              className={`w-16 h-8 text-center text-sm ${readOnly ? 'bg-gray-50' : ''}`}
              placeholder="—"
              readOnly={readOnly}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Thresholds Section
 *
 * Displays and edits games-to-win/tie thresholds.
 * Includes a collapsible options accordion showing the threshold system and chart.
 */
export function ThresholdsSection({
  leagueId,
  homeThresholds: legacyHomeThresholds,
  awayThresholds: legacyAwayThresholds,
  playerCount: legacyPlayerCount,
  editorState,
  editorActions,
  homeTeamName = 'Home',
  awayTeamName = 'Away',
}: ThresholdsSectionProps) {
  // Note: Threshold system/mode settings are now controlled by SetupOptions at MatchDataPage level
  // This section just shows the threshold values and chart preview

  // If no state hook provided, show placeholder with legacy props
  if (!editorState || !editorActions) {
    const canAutoGenerate = (legacyPlayerCount === 3) || (legacyPlayerCount === 5);

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5" />
            Thresholds
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-6">
            <div className="text-center text-gray-500">
              <p className="font-medium mb-2">Thresholds Section</p>
              <p className="text-sm mb-4">
                Auto-generate: <span className="font-mono">{canAutoGenerate ? 'Available' : 'Manual only'}</span>
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium">Home</p>
                  <p>Win: {legacyHomeThresholds?.win ?? '—'}</p>
                  <p>Tie: {legacyHomeThresholds?.tie ?? '—'}</p>
                </div>
                <div>
                  <p className="font-medium">Away</p>
                  <p>Win: {legacyAwayThresholds?.win ?? '—'}</p>
                  <p>Tie: {legacyAwayThresholds?.tie ?? '—'}</p>
                </div>
              </div>
              <p className="mt-4 text-xs text-gray-400">
                Wire editorState and editorActions props to enable editing
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { formatConfig, homeLineup, awayLineup, thresholds } = editorState;
  const { setThresholds, generateThresholds } = editorActions;

  // Determine current system based on format config from SetupOptions
  const effectiveSystem: ThresholdSystem =
    formatConfig.handicapType === 'points'
      ? 'points'
      : formatConfig.handicapType === 'percentage'
        ? 'percentage'
        : 'custom';

  // Show tie threshold only for points system
  const showTie = effectiveSystem === 'points';

  // Calculate handicap difference
  const handicapDiff = homeLineup.teamTotal - awayLineup.teamTotal;
  const handicapDiffDisplay = handicapDiff >= 0 ? `+${handicapDiff.toFixed(1)}` : handicapDiff.toFixed(1);
  const favoredTeam = handicapDiff > 0 ? homeTeamName : handicapDiff < 0 ? awayTeamName : 'Even';

  /**
   * Handle generate button click
   */
  const handleGenerate = () => {
    const homeTotal = homeLineup.teamTotal;
    const awayTotal = awayLineup.teamTotal;

    let newThresholds: Thresholds;

    if (effectiveSystem === 'points') {
      newThresholds = calculatePointsThresholds(homeTotal, awayTotal);
    } else if (effectiveSystem === 'percentage') {
      newThresholds = calculatePercentageThresholds(homeTotal, awayTotal);
    } else {
      console.warn('Cannot generate thresholds for custom system');
      return;
    }

    generateThresholds(newThresholds);
  };

  // Can only auto-generate if system is not 'custom'
  const canAutoGenerate = effectiveSystem !== 'custom';

  return (
    <div className="space-y-3">
      {/* Chart Preview Card (collapsible) */}
      <ThresholdChartPreviewCard
        leagueId={leagueId}
        currentSystem={effectiveSystem}
        handicapDiff={handicapDiff}
        lineupSize={formatConfig.lineupSize}
      />

      {/* Main Thresholds Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5" />
              Thresholds
            </div>

            {/* Generate button */}
            {canAutoGenerate && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                className="h-8"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Generate
              </Button>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Handicap difference info */}
          <div className="flex items-center justify-between text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
            <span>
              Handicap Difference: <span className="font-medium">{handicapDiffDisplay}</span>
            </span>
            <span>
              Favored: <span className="font-medium">{favoredTeam}</span>
            </span>
          </div>

          {/* Threshold inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ThresholdInput
              label={homeTeamName}
              winValue={thresholds.homeWin}
              tieValue={thresholds.homeTie}
              onWinChange={(val) => setThresholds({ homeWin: val })}
              onTieChange={(val) => setThresholds({ homeTie: val })}
              showTie={showTie}
            />
            <ThresholdInput
              label={awayTeamName}
              winValue={thresholds.awayWin}
              tieValue={thresholds.awayTie}
              onWinChange={(val) => setThresholds({ awayWin: val })}
              onTieChange={(val) => setThresholds({ awayTie: val })}
              showTie={showTie}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
