/**
 * @fileoverview useTeamActions — team-side logic for the Manage Teams surface:
 * the team-editor modal state (add/edit), delete (gated on the team having zero
 * matches), row expansion, and the default-name helper. Extracted from
 * `src/operator/TeamManagement.tsx` as part of the content decomposition.
 *
 * `confirm` is passed in (the container owns `useConfirmDialog` so it can render
 * the dialog) — the hook calls it for the delete confirmation.
 */

import { useState } from 'react';
import { supabase } from '@/supabaseClient';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import type { TeamWithQueryDetails } from '@/types/team';
import type { ConfirmOptions } from '@/hooks/useConfirmDialog';

export function useTeamActions(
  teams: TeamWithQueryDetails[],
  refreshTeams: () => Promise<void> | void,
  confirm: (options: ConfirmOptions) => Promise<boolean>,
) {
  const [showTeamEditor, setShowTeamEditor] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamWithQueryDetails | null>(null);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

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

  const handleTeamCreateSuccess = async () => {
    setShowTeamEditor(false);
    setEditingTeam(null);
    await refreshTeams();
  };

  /**
   * Delete a team. Allowed only when the team has zero matches (typo /
   * pre-schedule cleanup). With matches present, the operator is steered to the
   * Drop workflow — the DB FK is RESTRICT, so a raw delete would fail anyway;
   * the pre-flight count gives a clean message instead of an FK error.
   */
  const handleDeleteTeam = async (teamId: string) => {
    const { count: matchCount, error: countError } = await supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);

    if (countError) {
      logger.error('Error counting team matches', { error: countError.message });
      toast.error('Could not check team matches. Please try again.');
      return;
    }

    if ((matchCount ?? 0) > 0) {
      toast.error(
        `This team has ${matchCount} match${matchCount === 1 ? '' : 'es'} and cannot be deleted. The Drop Team workflow (coming soon) is the right tool for mid-season departures.`,
      );
      return;
    }

    const confirmed = await confirm({
      title: 'Delete Team?',
      message:
        'This team has no matches yet. Deleting it will permanently remove the team and its roster. This cannot be undone.',
      confirmText: 'Delete Team',
      confirmVariant: 'destructive',
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('teams').delete().eq('id', teamId);
      if (error) throw error;
      await refreshTeams();
    } catch (err) {
      logger.error('Error deleting team', {
        error: err instanceof Error ? err.message : String(err),
      });
      toast.error(err instanceof Error ? err.message : 'Failed to delete team');
    }
  };

  const toggleTeamExpansion = (teamId: string) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  const generateDefaultTeamName = (): string => `Team ${teams.length + 1}`;

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
