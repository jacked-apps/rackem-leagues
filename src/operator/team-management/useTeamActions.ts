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
import { convertTeamToBye } from '@/api/mutations/teams';
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
   * Delete or DROP a team, depending on its schedule state:
   *
   * - No matches yet → genuine hard delete (typo / pre-schedule cleanup).
   * - Schedule exists, no games played (pre-season) → repurpose the team's slot
   *   as the BYE (`convertTeamToBye`), keeping the round-robin even with NO
   *   reschedule.
   * - Schedule exists, games played (mid-season) → withdraw the team (its past
   *   results stay on the record) and replace it with a fresh BYE for every
   *   remaining match, via the atomic `drop_team_mid_season` RPC.
   *
   * The DB FK is RESTRICT, so a raw delete of a team with matches would fail —
   * the drop paths are the supported way to remove a scheduled team.
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

    // No schedule yet → genuine hard delete (typo / pre-schedule cleanup).
    if ((matchCount ?? 0) === 0) {
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
      return;
    }

    // Schedule exists → this is a "drop", not a delete. Split on whether any
    // game has been played: pre-season repurposes the slot as a bye; mid-season
    // withdraws + replaces remaining matches.
    const { count: playedCount, error: playedError } = await supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .or('winner_team_id.not.is.null,status.in.(in_progress,awaiting_verification,completed,forfeited)');

    if (playedError) {
      logger.error('Error checking played matches', { error: playedError.message });
      toast.error("Could not check the team's matches. Please try again.");
      return;
    }

    const seasonForTeam = teams.find((t) => t.id === teamId)?.season_id;
    if (!seasonForTeam) {
      toast.error('Could not determine the season for this team.');
      return;
    }

    // Mid-season (games already played) → withdraw the team (past results stay)
    // and replace it with a fresh BYE for every remaining match. One atomic RPC.
    if ((playedCount ?? 0) > 0) {
      const confirmed = await confirm({
        title: 'Drop this team mid-season?',
        message:
          'This team is withdrawn — its past results stay on the record — and a BYE replaces it for all its REMAINING matches, so its upcoming opponents get bye weeks. This cannot be undone.',
        confirmText: 'Drop Team',
        confirmVariant: 'destructive',
      });
      if (!confirmed) return;

      try {
        const { error: rpcError } = await supabase.rpc('drop_team_mid_season', {
          p_team_id: teamId,
          p_season_id: seasonForTeam,
        });
        if (rpcError) throw new Error(rpcError.message);
        await refreshTeams();
        toast.success('Team dropped — its remaining matches are now BYE weeks.');
      } catch (err) {
        logger.error('Error dropping team mid-season', {
          error: err instanceof Error ? err.message : String(err),
        });
        toast.error(err instanceof Error ? err.message : 'Failed to drop team');
      }
      return;
    }

    // Pre-season (no games played) → repurpose the team's slot as the BYE.
    const confirmed = await confirm({
      title: 'Drop this team?',
      message:
        'This team becomes the BYE: its name and roster are cleared, its players are freed, and every team scheduled against it gets a bye week that week. The schedule is NOT regenerated. This cannot be undone.',
      confirmText: 'Drop to BYE',
      confirmVariant: 'destructive',
    });
    if (!confirmed) return;

    try {
      await convertTeamToBye({ teamId, seasonId: seasonForTeam });
      await refreshTeams();
      toast.success('Team dropped — its schedule slot is now a BYE.');
    } catch (err) {
      logger.error('Error converting team to bye', {
        error: err instanceof Error ? err.message : String(err),
      });
      toast.error(err instanceof Error ? err.message : 'Failed to drop team');
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
