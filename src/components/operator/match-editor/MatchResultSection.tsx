/**
 * @fileoverview Match Result Section Component
 *
 * Displays and allows editing of final match results.
 * Shows winner determination based on game wins and thresholds.
 *
 * Features:
 * - Game wins summary for each team
 * - Winner display based on thresholds
 * - Manual winner override via dropdown
 * - Points inputs for each team
 * - Recalculate button to recompute from games
 *
 * This component integrates with useMatchEditorState for state management.
 *
 * @example
 * <MatchResultSection
 *   editorState={state}
 *   editorActions={actions}
 *   homeTeamName="Ball Busters"
 *   awayTeamName="Chalk & Awe"
 * />
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trophy, RefreshCw } from 'lucide-react';
import type {
  MatchEditorState,
  MatchResult,
  MatchResultState,
} from './useMatchEditorState';

interface MatchResultSectionProps {
  /** Home team display name */
  homeTeamName?: string;
  /** Away team display name */
  awayTeamName?: string;
  /** Games won by home team (legacy prop) */
  homeGamesWon?: number | null;
  /** Games won by away team (legacy prop) */
  awayGamesWon?: number | null;
  /** Points earned by home team (legacy prop) */
  homePointsEarned?: number | null;
  /** Points earned by away team (legacy prop) */
  awayPointsEarned?: number | null;
  /** Current match result (legacy prop) */
  matchResult?: MatchResult;
  /** Callback when any value changes (legacy prop) */
  onChange?: () => void;
  /** Current editor state (from useMatchEditorState) */
  editorState?: MatchEditorState;
  /** Editor actions (from useMatchEditorState) */
  editorActions?: {
    setResult: (result: Partial<MatchResultState>) => void;
    calculateResult: () => void;
  };
}

/**
 * Match Result Section
 *
 * Displays final match results with game wins, winner determination, and points.
 * Integrates with useMatchEditorState for state management.
 */
export function MatchResultSection({
  homeTeamName = 'Home',
  awayTeamName = 'Away',
  homeGamesWon: legacyHomeGamesWon,
  awayGamesWon: legacyAwayGamesWon,
  homePointsEarned: legacyHomePoints,
  awayPointsEarned: legacyAwayPoints,
  matchResult: legacyMatchResult,
  editorState,
  editorActions,
}: MatchResultSectionProps) {
  // If no state hook provided, show placeholder with legacy props
  if (!editorState || !editorActions) {
    const getResultDisplay = () => {
      switch (legacyMatchResult) {
        case 'home_win':
          return `${homeTeamName} Wins`;
        case 'away_win':
          return `${awayTeamName} Wins`;
        case 'tie':
          return 'Tie';
        default:
          return 'Not determined';
      }
    };

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="h-5 w-5" />
            Match Result
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-6">
            <div className="text-center text-gray-500">
              <p className="font-medium mb-4">Match Result Section</p>

              {/* Current values display */}
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <p className="font-medium">{homeTeamName}</p>
                  <p>Games: {legacyHomeGamesWon ?? '—'}</p>
                  <p>Points: {legacyHomePoints ?? '—'}</p>
                </div>
                <div>
                  <p className="font-medium">{awayTeamName}</p>
                  <p>Games: {legacyAwayGamesWon ?? '—'}</p>
                  <p>Points: {legacyAwayPoints ?? '—'}</p>
                </div>
              </div>

              <p className="font-medium text-gray-700">
                Result: {getResultDisplay()}
              </p>

              <p className="mt-4 text-xs text-gray-400">
                Wire editorState and editorActions props to enable editing
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { result, thresholds, games } = editorState;
  const { setResult, calculateResult } = editorActions;

  /**
   * Get result display text
   */
  const getResultDisplay = () => {
    switch (result.winner) {
      case 'home_win':
        return `${homeTeamName} Wins`;
      case 'away_win':
        return `${awayTeamName} Wins`;
      case 'tie':
        return 'Tie';
      default:
        return 'Not determined';
    }
  };

  /**
   * Get result status styling
   */
  const getResultStyle = () => {
    switch (result.winner) {
      case 'home_win':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'away_win':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'tie':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  /**
   * Check if all games are scored
   */
  const allGamesScored = games.length > 0 && games.every(g => g.winnerTeamId !== null);

  /**
   * Check if thresholds are set
   */
  const hasThresholds = thresholds.homeWin !== null && thresholds.awayWin !== null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg">
            <Trophy className="h-5 w-5" />
            Match Result
          </div>

          {/* Recalculate button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={calculateResult}
            disabled={!allGamesScored || !hasThresholds}
            className="h-8"
            title={
              !allGamesScored
                ? 'Score all games first'
                : !hasThresholds
                  ? 'Set thresholds first'
                  : 'Recalculate result from games'
            }
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Recalculate
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Game wins summary */}
        <div className="grid grid-cols-2 gap-4">
          {/* Home team wins */}
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">{homeTeamName}</p>
            <p className="text-3xl font-bold text-blue-600">{result.homeGamesWon}</p>
            <p className="text-xs text-gray-400 mt-1">
              {thresholds.homeWin !== null ? `Need ${thresholds.homeWin} to win` : 'Threshold not set'}
            </p>
          </div>

          {/* Away team wins */}
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">{awayTeamName}</p>
            <p className="text-3xl font-bold text-red-600">{result.awayGamesWon}</p>
            <p className="text-xs text-gray-400 mt-1">
              {thresholds.awayWin !== null ? `Need ${thresholds.awayWin} to win` : 'Threshold not set'}
            </p>
          </div>
        </div>

        {/* Winner display */}
        <div className={`text-center py-3 rounded-lg border ${getResultStyle()}`}>
          <p className="font-semibold">{getResultDisplay()}</p>
        </div>

        {/* Manual override section */}
        <div className="space-y-3 pt-2 border-t border-gray-200">
          <p className="text-sm text-gray-500">Manual Override (if needed)</p>

          <div className="grid grid-cols-3 gap-4">
            {/* Winner override */}
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Winner</Label>
              <Select
                value={result.winner || 'none'}
                onValueChange={(value) => {
                  setResult({
                    winner: value === 'none' ? null : value as MatchResult,
                  });
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select winner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not determined</SelectItem>
                  <SelectItem value="home_win">{homeTeamName} Wins</SelectItem>
                  <SelectItem value="away_win">{awayTeamName} Wins</SelectItem>
                  <SelectItem value="tie">Tie</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Home points */}
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">{homeTeamName} Points</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={result.homePoints ?? ''}
                onChange={(e) => {
                  const val = e.target.value ? parseFloat(e.target.value) : null;
                  setResult({ homePoints: val });
                }}
                className="h-9"
                placeholder="—"
              />
            </div>

            {/* Away points */}
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">{awayTeamName} Points</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={result.awayPoints ?? ''}
                onChange={(e) => {
                  const val = e.target.value ? parseFloat(e.target.value) : null;
                  setResult({ awayPoints: val });
                }}
                className="h-9"
                placeholder="—"
              />
            </div>
          </div>
        </div>

        {/* Warnings/status messages */}
        {!allGamesScored && games.length > 0 && (
          <div className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            {games.length - games.filter(g => g.winnerTeamId).length} game(s) still need scoring.
          </div>
        )}

        {!hasThresholds && (
          <div className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            Set thresholds to enable automatic winner calculation.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
