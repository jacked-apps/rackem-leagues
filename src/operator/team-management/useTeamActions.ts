/**
 * @fileoverview useTeamActions — team-side logic for the Manage Teams surface:
 * the team-editor modal state (add/edit), delete/drop (see useTeamDrop), row
 * expansion, and the default-name helper. Extracted from
 * `src/operator/TeamManagement.tsx` as part of the content decomposition.
 *
 * `confirm` is passed in (the container owns `useConfirmDialog` so it can render
 * the dialog) — the hook calls it for the delete confirmation.
 *
 * Ed's "perfect schedule" rule (2026-11-21): ADDING a team after the schedule
 * exists but before any game is played clears the schedule and sends the
 * operator to build a new one (removing does the same, in useTeamDrop).
 * GATED with the odd-league drop: production keeps the old schedule.
 */

import { useState } from 'react';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import { isProduction } from '@/config/environment';
import { clearSchedule } from '@/utils/scheduleGenerator';
import { fetchSeasonScheduleState } from './preSeasonSchedule';
import { useTeamDrop } from './useTeamDrop';
import { useInvalidateSeasonSchedule } from '@/api/hooks/useInvalidateSeasonSchedule';
import type { TeamWithQueryDetails } from '@/types/team';
import type { ConfirmOptions } from '@/hooks/useConfirmDialog';

export interface TeamActionsOptions {
  /** The season being managed (needed to rebuild its schedule after an add). */
  seasonId?: string | null;
  /** Called after the schedule was cleared (pre-season add/remove): go rebuild it. */
  onScheduleCleared?: (seasonId: string) => void;
}

export function useTeamActions(
  teams: TeamWithQueryDetails[],
  refreshTeams: () => Promise<void> | void,
  confirm: (options: ConfirmOptions) => Promise<boolean>,
  { seasonId, onScheduleCleared }: TeamActionsOptions = {},
) {
  const [showTeamEditor, setShowTeamEditor] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamWithQueryDetails | null>(null);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const { handleDeleteTeam } = useTeamDrop({ teams, refreshTeams, confirm, onScheduleCleared });
  const scheduleChanged = useInvalidateSeasonSchedule();

  const openAddTeam = () => {
    setEditingTeam(null);
    setShowTeamEditor(true);
  };

  const openEditTeam = (team: TeamWithQueryDetails) => {
    setEditingTeam(team);
    setShowTeamEditor(true);
  };

  const closeTeamEditor = () => {
    setShowTeamEditor(false);
    setEditingTeam(null);
  };

  /**
   * A NEW team was added to a season whose schedule exists but hasn't started:
   * that schedule no longer fits, so clear it and send the operator to build a
   * fresh one. (Editing a team, incl. "Fill" on the BYE, keeps the schedule:
   * Fill puts a real team into the BYE's slot, which stays perfect.)
   */
  const rebuildAfterAdd = async (id: string) => {
    try {
      const state = await fetchSeasonScheduleState(id);
      if (!state.hasSchedule || state.started) return;
      const cleared = await clearSchedule(id);
      if (!cleared.success) throw new Error(cleared.error ?? 'Failed to clear the schedule');
      await scheduleChanged(id);
      toast.success('Team added. The schedule was cleared so you can build a fresh one for the new team count.');
      onScheduleCleared?.(id);
    } catch (err) {
      logger.error('Error rebuilding schedule after adding a team', {
        error: err instanceof Error ? err.message : String(err),
      });
      toast.error('Team added, but the old schedule could not be cleared. Rebuild it from the Schedule page.');
    }
  };

  const handleTeamCreateSuccess = async () => {
    const wasAdd = editingTeam === null;
    setShowTeamEditor(false);
    setEditingTeam(null);
    await refreshTeams();
    if (wasAdd && seasonId && !isProduction) await rebuildAfterAdd(seasonId);
  };

  const toggleTeamExpansion = (teamId: string) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  /**
   * The first "Team N" not already used. Counting teams instead (count + 1)
   * collided after a drop: 6 teams left as 1-4, 6, 7 made the new one a second
   * "Team 7".
   */
  const generateDefaultTeamName = (): string => {
    const taken = new Set(teams.map((t) => t.team_name));
    let n = 1;
    while (taken.has(`Team ${n}`)) n++;
    return `Team ${n}`;
  };

  return {
    showTeamEditor,
    editingTeam,
    expandedTeams,
    openAddTeam,
    openEditTeam,
    closeTeamEditor,
    handleTeamCreateSuccess,
    handleDeleteTeam,
    toggleTeamExpansion,
    generateDefaultTeamName,
  };
}
