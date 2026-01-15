/**
 * @fileoverview Match Navigation Bar Component
 *
 * Displays numbered pills for quick navigation between matches in the same week.
 * Allows operators to quickly switch between matches without returning to the list.
 *
 * Features:
 * - Shows all matches in the current week as numbered pills [1][2][3][4]
 * - Highlights current match with filled background
 * - Tooltip on hover shows team names
 * - Click navigates to selected match (with unsaved warning if applicable)
 *
 * @example
 * <MatchNavigationBar
 *   seasonWeekId={match.season_week_id}
 *   currentMatchId={matchId}
 *   leagueId={leagueId}
 *   seasonId={seasonId}
 *   hasUnsavedChanges={isDirty}
 *   onNavigate={(matchId) => navigate(`/league/${leagueId}/season/${seasonId}/match/${matchId}`)}
 * />
 */

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useWeekMatches } from '@/api/hooks/useMatches';

interface MatchNavigationBarProps {
  /** Season week ID to fetch sibling matches */
  seasonWeekId: string;
  /** Current match ID to highlight */
  currentMatchId: string;
  /** League ID for navigation route */
  leagueId: string;
  /** Season ID for navigation route */
  seasonId: string;
  /** Whether there are unsaved changes (shows warning before navigating) */
  hasUnsavedChanges?: boolean;
  /** Optional callback before navigation - return false to cancel */
  onBeforeNavigate?: () => Promise<boolean> | boolean;
}

/**
 * Match Navigation Bar
 *
 * Renders a row of numbered pills representing matches in the same week.
 * Current match is visually highlighted. Clicking a different match navigates to it.
 */
export function MatchNavigationBar({
  seasonWeekId,
  currentMatchId,
  leagueId,
  seasonId,
  hasUnsavedChanges = false,
  onBeforeNavigate,
}: MatchNavigationBarProps) {
  const navigate = useNavigate();

  // Fetch sibling matches in the same week
  const { data: weekMatches = [], isLoading } = useWeekMatches(seasonWeekId);

  /**
   * Handle click on a match pill
   * Shows unsaved warning if applicable, then navigates
   */
  const handleMatchClick = async (matchId: string) => {
    // Don't do anything if clicking current match
    if (matchId === currentMatchId) return;

    // Check for unsaved changes
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to navigate away?'
      );
      if (!confirmed) return;
    }

    // Optional callback before navigation
    if (onBeforeNavigate) {
      const shouldContinue = await onBeforeNavigate();
      if (!shouldContinue) return;
    }

    // Navigate to selected match
    navigate(`/league/${leagueId}/season/${seasonId}/match/${matchId}`);
  };

  // Loading state - show placeholder pills
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3">
        <span className="text-sm text-gray-500">Week Matches:</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="w-8 h-8 rounded-md bg-gray-200 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  // No matches found (shouldn't happen normally)
  if (weekMatches.length === 0) {
    return null;
  }

  // Only one match - no navigation needed
  if (weekMatches.length === 1) {
    return (
      <div className="flex items-center gap-2 py-3">
        <span className="text-sm text-gray-500">Week Match:</span>
        <span className="text-sm font-medium">1 of 1</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 py-3">
      <span className="text-sm text-gray-500">Week Matches:</span>
      <div className="flex gap-1">
        {weekMatches.map((match, index) => {
          const matchNumber = index + 1;
          const isCurrentMatch = match.id === currentMatchId;

          // Build title for accessibility
          const homeTeam = match.home_team?.team_name || 'Home';
          const awayTeam = match.away_team?.team_name || 'Away';
          const titleText = `${homeTeam} vs ${awayTeam}`;

          return (
            <Button
              key={match.id}
              variant={isCurrentMatch ? 'secondary' : 'outline'}
              size="sm"
              className={`w-8 h-8 p-0 ${
                isCurrentMatch
                  ? 'bg-primary text-primary-foreground cursor-default'
                  : 'hover:bg-gray-100'
              }`}
              onClick={() => handleMatchClick(match.id)}
              disabled={isCurrentMatch}
              title={titleText}
            >
              {matchNumber}
            </Button>
          );
        })}
      </div>
      <span className="text-sm text-gray-400 ml-2">
        ({weekMatches.findIndex((m) => m.id === currentMatchId) + 1} of {weekMatches.length})
      </span>
    </div>
  );
}
