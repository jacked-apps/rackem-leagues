/**
 * @fileoverview Week Editor View Component
 *
 * Self-contained component for editing all matches within a week.
 * Replaces the display view when in edit mode.
 *
 * Responsibilities:
 * - Orchestrate the edit UI (header, match rows, action buttons)
 * - Manage save/cancel/revert actions
 * - Update matches using existing useUpdateMatch mutation
 * - Show loading/error states
 *
 * Uses useWeekEditor hook for state management and swap logic.
 */

import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUpdateMatch } from '@/api/hooks';
import { queryKeys } from '@/api/queryKeys';
import { parseLocalDate } from '@/utils/formatters';
import { logger } from '@/utils/logger';
import { useWeekEditor, type MatchEditState, type TeamVenueMap } from './useWeekEditor';
import { MatchEditRow } from './MatchEditRow';
import type { TeamOption } from './TeamSelect';
import type { VenueOption } from './VenueSelect';

/**
 * Week data from the schedule
 */
interface WeekData {
  id: string;
  week_name: string;
  scheduled_date: string;
  week_type: string;
}

/**
 * Props for WeekEditorView component
 */
interface WeekEditorViewProps {
  /** Week information */
  week: WeekData;
  /** Initial match states for this week */
  initialMatches: MatchEditState[];
  /** All teams in the season (for dropdowns) */
  teams: TeamOption[];
  /** All venues for the league (for dropdowns) */
  venues: VenueOption[];
  /** Map of team ID to their home venue ID (for auto-venue updates) */
  teamHomeVenues: TeamVenueMap;
  /** Season ID (for cache invalidation) */
  seasonId: string;
  /** Whether the season has a BYE team (odd number of teams) */
  hasByeTeam: boolean;
  /** Called when user cancels (exit edit mode without saving) */
  onCancel: () => void;
  /** Called after successful save */
  onSaveSuccess: () => void;
}

/**
 * Week Editor View Component
 *
 * Full edit interface for a week's matches. Shows all matches with
 * team and venue dropdowns, plus action buttons (Revert, Cancel, Save).
 *
 * @example
 * <WeekEditorView
 *   week={weekData}
 *   initialMatches={matchEditStates}
 *   teams={seasonTeams}
 *   venues={leagueVenues}
 *   seasonId={seasonId}
 *   onCancel={() => setEditingWeekId(null)}
 *   onSaveSuccess={() => setEditingWeekId(null)}
 * />
 */
export const WeekEditorView: React.FC<WeekEditorViewProps> = ({
  week,
  initialMatches,
  teams,
  venues,
  teamHomeVenues,
  seasonId,
  hasByeTeam,
  onCancel,
  onSaveSuccess,
}) => {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use the existing useUpdateMatch mutation (without auto-invalidation - we'll do it manually)
  const updateMatchMutation = useUpdateMatch({ invalidate: false });

  // Use the week editor hook for state management
  const {
    editedMatches,
    handleTeamChange,
    handleVenueChange,
    handleVenueOverrideToggle,
    handleRevert,
    hasChanges,
    getChangedMatches,
  } = useWeekEditor({ initialMatches, teamHomeVenues });

  // Check if any matches are editable
  const hasEditableMatches = useMemo(
    () => editedMatches.some(m => m.isEditable),
    [editedMatches]
  );

  /**
   * Save all changes by updating each match individually
   * Uses the existing useUpdateMatch mutation for each changed match
   */
  const handleSave = async () => {
    const changedMatches = getChangedMatches();

    if (changedMatches.length === 0) {
      // No changes, just exit
      onSaveSuccess();
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Update each changed match using the existing mutation
      await Promise.all(
        changedMatches.map(m =>
          updateMatchMutation.mutateAsync({
            matchId: m.matchId,
            updates: {
              home_team_id: m.homeTeamId,
              away_team_id: m.awayTeamId,
              scheduled_venue_id: m.venueId,
            },
          })
        )
      );

      logger.info('Week matches updated successfully', {
        weekId: week.id,
        updatedCount: changedMatches.length,
      });

      // Invalidate schedule queries to refetch fresh data
      await queryClient.invalidateQueries({
        queryKey: queryKeys.schedules.bySeason(seasonId),
      });

      // Also invalidate match queries in case any are cached
      await queryClient.invalidateQueries({
        queryKey: queryKeys.matches.all,
      });

      onSaveSuccess();
    } catch (err) {
      logger.error('Failed to save week matches', {
        error: err instanceof Error ? err.message : String(err),
        weekId: week.id,
      });
      setError(err instanceof Error ? err.message : 'Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle cancel with unsaved changes warning
   */
  const handleCancel = () => {
    if (hasChanges) {
      // Could use a confirm dialog here, but for now just cancel
      // The parent will handle the unsaved changes warning
    }
    onCancel();
  };

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="bg-blue-100/50 rounded-t-xl -my-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">
              Edit {week.week_name}
            </CardTitle>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-600 text-white">
              EDITING
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="h-4 w-4" />
            <span>
              {parseLocalDate(week.scheduled_date).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {/* Match rows */}
        <div className="space-y-2 mb-4">
          {editedMatches.map((match) => (
            <MatchEditRow
              key={match.matchId}
              matchNumber={match.matchNumber}
              homeTeamId={match.homeTeamId}
              awayTeamId={match.awayTeamId}
              venueId={match.venueId}
              venueOverride={match.venueOverride}
              isEditable={match.isEditable}
              teams={teams}
              venues={venues}
              showByeOption={hasByeTeam}
              onHomeTeamChange={(teamId) => handleTeamChange(match.matchId, 'home', teamId)}
              onAwayTeamChange={(teamId) => handleTeamChange(match.matchId, 'away', teamId)}
              onVenueChange={(venueId) => handleVenueChange(match.matchId, venueId)}
              onVenueOverrideToggle={() => handleVenueOverrideToggle(match.matchId)}
            />
          ))}
        </div>

        {/* Info message */}
        <p className="text-sm text-gray-500 mb-4">
          Each team must appear exactly once per week. Selecting a team automatically swaps it with its current position.
        </p>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* No editable matches warning */}
        {!hasEditableMatches && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <p className="text-amber-800 text-sm">
              All matches in this week have already started or completed and cannot be edited.
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <Button
            variant="outline"
            onClick={handleRevert}
            disabled={!hasChanges || isSaving}
          >
            Revert
          </Button>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              isLoading={isSaving}
              loadingText="Saving..."
            >
              Save Changes
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
