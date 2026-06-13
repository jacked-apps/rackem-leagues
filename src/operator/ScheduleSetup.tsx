/**
 * @fileoverview Schedule Setup Component
 *
 * Allows league operators to assign schedule positions to teams and generate
 * the full season schedule. Supports random shuffle or manual position assignment.
 */

import React, { useState } from 'react';
import { supabase } from '@/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InfoButton } from '@/components/InfoButton';
import { Shuffle, Lock } from 'lucide-react';
import { assignRandomPositions, generateSchedule, clearSchedule } from '@/utils/scheduleGenerator';
import { hasMatchupTable } from '@/utils/matchupTables';
import { createByeTeam } from '@/api/mutations/teams';
import type { TeamWithQueryDetails } from '@/types/team';
import { logger } from '@/utils/logger';

interface ScheduleSetupProps {
  /** Season ID to generate schedule for */
  seasonId: string;
  /** Teams in the league */
  teams: TeamWithQueryDetails[];
  /** Called when schedule is successfully generated */
  onSuccess: () => void;
  /** Called to cancel setup */
  onCancel: () => void;
}

interface TeamPosition {
  id: string;
  team_name: string;
  home_venue_id: string | null;
  schedule_position: number;
}

/**
 * ScheduleSetup Component
 *
 * Two-step process:
 * 1. Assign positions to teams (random shuffle or manual)
 * 2. Generate schedule based on positions
 *
 * Automatically adds a BYE team if team count is odd.
 */
export const ScheduleSetup: React.FC<ScheduleSetupProps> = ({
  seasonId,
  teams,
  onSuccess,
  onCancel,
}) => {
  const needsByeTeam = teams.length % 2 !== 0;
  const effectiveTeamCount = needsByeTeam ? teams.length + 1 : teams.length;
  const hasTable = hasMatchupTable(effectiveTeamCount);

  // Initialize with sequential positions
  const [teamPositions, setTeamPositions] = useState<TeamPosition[]>(() => {
    const positions = teams.map((team, index) => ({
      id: team.id,
      team_name: team.team_name,
      home_venue_id: team.home_venue_id,
      schedule_position: index + 1,
    }));

    // Add a BYE placeholder if team count is odd. The 'BYE' string id is a
    // sentinel during the position-assignment phase only — when the operator
    // clicks Generate, performScheduleGeneration() replaces it with a real
    // bye team row's UUID via createByeTeam(). The schedule generator then
    // writes that real UUID into matches.home_team_id / away_team_id.
    if (needsByeTeam) {
      positions.push({
        id: 'BYE',
        team_name: 'BYE',
        home_venue_id: null,
        schedule_position: teams.length + 1,
      });
    }

    return positions;
  });

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExistingScheduleModal, setShowExistingScheduleModal] = useState(false);
  const [existingMatchCount, setExistingMatchCount] = useState(0);
  const [positionsLocked, setPositionsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [shuffling, setShuffling] = useState(false);

  /**
   * Check if any matches have been played (completed, in_progress, or forfeited)
   * If yes, lock team positions to prevent schedule corruption
   */
  React.useEffect(() => {
    const checkMatchesPlayed = async () => {
      try {
        const { count, error } = await supabase
          .from('matches')
          .select('*', { count: 'exact', head: true })
          .eq('season_id', seasonId)
          .in('status', ['completed', 'in_progress', 'forfeited']);

        if (error) throw error;

        if (count && count > 0) {
          setPositionsLocked(true);
        }
      } catch (err) {
        logger.error('Error checking match status', { error: err instanceof Error ? err.message : String(err) });
      } finally {
        setLoading(false);
      }
    };

    checkMatchesPlayed();
  }, [seasonId]);

  /**
   * Randomly shuffle team positions with visual animation
   */
  const handleShuffle = async () => {
    setShuffling(true);
    setError(null);

    // Show shuffling animation for 800ms
    await new Promise(resolve => setTimeout(resolve, 800));

    const shuffled = assignRandomPositions(teamPositions);
    setTeamPositions(shuffled);
    setShuffling(false);
  };

  /**
   * Update a team's position manually
   */
  const handlePositionChange = (teamId: string, newPosition: number) => {
    // Validate position
    if (newPosition < 1 || newPosition > effectiveTeamCount) {
      return;
    }

    setTeamPositions((prev) => {
      const updated = [...prev];
      const teamIndex = updated.findIndex((t) => t.id === teamId);
      const oldPosition = updated[teamIndex].schedule_position;

      // Swap positions with team at new position
      const swapIndex = updated.findIndex(
        (t) => t.schedule_position === newPosition
      );

      if (swapIndex !== -1) {
        updated[swapIndex].schedule_position = oldPosition;
      }

      updated[teamIndex].schedule_position = newPosition;

      // Sort by position
      return updated.sort((a, b) => a.schedule_position - b.schedule_position);
    });

    setError(null);
  };

  /**
   * Check if schedule already exists before generating
   */
  const handleGenerateSchedule = async () => {
    if (!hasTable) {
      setError(`No matchup table available for ${effectiveTeamCount} teams`);
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      // Check if schedule already exists
      const { count: existingMatches, error: countError } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('season_id', seasonId);

      if (countError) {
        setError(`Error checking for existing schedule: ${countError.message}`);
        setGenerating(false);
        return;
      }

      if (existingMatches && existingMatches > 0) {
        // Schedule exists - show modal
        setExistingMatchCount(existingMatches);
        setShowExistingScheduleModal(true);
        setGenerating(false);
        return;
      }

      // No existing schedule - generate normally
      await performScheduleGeneration();
    } catch (err) {
      logger.error('Error generating schedule', { error: err instanceof Error ? err.message : String(err) });
      setError(err instanceof Error ? err.message : 'Failed to generate schedule');
      setGenerating(false);
    }
  };

  /**
   * Actually perform the schedule generation.
   *
   * If a BYE placeholder is in teamPositions (odd team count), this first
   * INSERTs a real bye team row and swaps the placeholder's id for the
   * real UUID. The schedule generator then writes real team UUIDs into
   * matches.home_team_id / away_team_id — no NULL team_ids.
   */
  const performScheduleGeneration = async () => {
    setGenerating(true);
    setError(null);

    try {
      let teamsForGeneration = teamPositions;
      const byePlaceholder = teamPositions.find(t => t.id === 'BYE');

      if (byePlaceholder) {
        // Look up league_id and roster_size for the bye row from the season's
        // first real team (all real teams in a season share the same league
        // and roster size). The placeholder is at the end of the array, so
        // find() returns the first non-BYE row.
        const realTeam = teams.find(t => t.id !== 'BYE');
        if (!realTeam) {
          setError('Cannot generate schedule: no real teams found');
          return;
        }

        const byeTeam = await createByeTeam({
          seasonId,
          leagueId: realTeam.league_id,
          rosterSize: realTeam.roster_size,
        });

        // Swap the placeholder's id for the real bye team's UUID; keep
        // schedule_position so the matchup table still places it correctly.
        teamsForGeneration = teamPositions.map(t =>
          t.id === 'BYE' ? { ...t, id: byeTeam.id } : t
        );
      }

      const result = await generateSchedule({
        seasonId,
        teams: teamsForGeneration,
        skipExistingCheck: true, // Skip the check since we already did it
      });

      if (!result.success) {
        setError(result.error || 'Failed to generate schedule');
        return;
      }

      onSuccess();
    } catch (err) {
      logger.error('Error generating schedule', { error: err instanceof Error ? err.message : String(err) });
      setError(err instanceof Error ? err.message : 'Failed to generate schedule');
    } finally {
      setGenerating(false);
    }
  };

  /**
   * Delete existing schedule and create new one
   */
  const handleReplaceSchedule = async () => {
    setShowExistingScheduleModal(false);
    setGenerating(true);
    setError(null);

    try {
      // Clear existing schedule
      const clearResult = await clearSchedule(seasonId);

      if (!clearResult.success) {
        setError(clearResult.error || 'Failed to clear existing schedule');
        setGenerating(false);
        return;
      }

      // Generate new schedule
      await performScheduleGeneration();
    } catch (err) {
      logger.error('Error replacing schedule', { error: err instanceof Error ? err.message : String(err) });
      setError(err instanceof Error ? err.message : 'Failed to replace schedule');
      setGenerating(false);
    }
  };

  /**
   * Keep existing schedule and navigate away
   */
  const handleKeepSchedule = () => {
    setShowExistingScheduleModal(false);
    onSuccess();
  };

  if (loading) {
    return (
      <div className="bg-card rounded-xl shadow-sm p-6">
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (positionsLocked) {
    return (
      <div className="bg-card rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Team Positions Locked
        </h2>
        <div className="bg-warning/10 border border-warning/40 rounded-lg p-4 mb-4">
          <p className="text-warning font-medium mb-2">
            ⚠️ Team positions cannot be changed
          </p>
          <p className="text-warning text-sm">
            Team schedule positions are locked because matches have already been played. Changing positions would corrupt the entire season schedule and matchups.
          </p>
        </div>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  if (!hasTable) {
    return (
      <div className="bg-card rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Schedule Generation Not Available
        </h2>
        <div className="bg-warning/10 border border-warning/40 rounded-lg p-4 mb-4">
          <p className="text-warning text-sm">
            No matchup table is available for {effectiveTeamCount} teams.
            Schedule generation requires a pre-defined round-robin matchup table.
          </p>
        </div>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-sm p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Assign Team Schedule Positions
        </h2>
        <p className="text-sm text-muted-foreground mb-3">
          Assign each team a position number (1-{effectiveTeamCount}). These positions
          determine matchups throughout the season.
        </p>
        <InfoButton
          title="How Schedule Positions Work"
          label="Learn More"
        >
          <p className="mb-2">
            Schedule positions determine which teams play each other each week based on
            pre-calculated round-robin matchup tables.
          </p>
          <p className="mb-2">
            <strong>Random Assignment:</strong> Use "Shuffle" to randomly assign positions.
            This ensures no bias in matchups.
          </p>
          <p>
            <strong>Manual Assignment:</strong> Enter position numbers manually if you want
            specific teams in certain positions (e.g., keeping rivalries apart early in season).
          </p>
        </InfoButton>
      </div>

      {/* Shuffle Button */}
      <div className="mb-4">
        <Button
          variant="outline"
          onClick={handleShuffle}
          disabled={generating || shuffling}
        >
          <Shuffle className={`h-4 w-4 mr-2 ${shuffling ? 'animate-spin' : ''}`} />
          {shuffling ? 'Shuffling...' : 'Shuffle Teams'}
        </Button>
      </div>

      {/* Team Position List */}
      <div className="mb-6 space-y-2">
        {teamPositions.map((team) => (
          <div
            key={team.id}
            className="flex items-center gap-3 p-3 border border-border rounded-lg"
          >
            <div className="w-20">
              <Label className="text-xs text-muted-foreground">Position</Label>
              <Input
                type="number"
                min={1}
                max={effectiveTeamCount}
                value={team.schedule_position}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handlePositionChange(team.id, parseInt(e.target.value))
                }
                disabled={generating || shuffling || team.id === 'BYE'}
                className="text-center font-mono"
              />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">
                {team.team_name}
                {team.id === 'BYE' && (
                  <span className="ml-2 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                    Auto-added for odd team count
                  </span>
                )}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/40 rounded-lg p-4 mb-4">
          <p className="text-destructive text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <Button variant="outline" onClick={onCancel} disabled={generating} loadingText="none">
          Cancel
        </Button>
        <Button
          onClick={handleGenerateSchedule}
          disabled={generating}
          size="lg"
          loadingText="Generating Schedule..."
        >
          <Lock className="h-4 w-4 mr-2" />
          {generating ? 'Generating Schedule...' : 'Lock Positions & Generate Schedule'}
        </Button>
      </div>

      {/* Existing Schedule Modal */}
      {showExistingScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-foreground mb-3">
              Schedule Already Exists
            </h3>
            <p className="text-foreground mb-4">
              A schedule with {existingMatchCount} matches already exists for this season.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Would you like to keep the existing schedule or create a new one? Creating a new schedule will delete all existing matches.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleKeepSchedule}
                className="flex-1"
                loadingText="none"
              >
                Keep Existing
              </Button>
              <Button
                onClick={handleReplaceSchedule}
                className="flex-1"
                loadingText="Creating..."
              >
                Create New
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
