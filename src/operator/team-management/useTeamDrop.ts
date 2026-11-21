/**
 * @fileoverview useTeamDrop: the Manage Teams trash-can action. Deletes or
 * DROPS a team depending on where the season is:
 *
 * - The team has no matches → plain delete (typo / pre-schedule cleanup).
 * - No game played yet in the season → remove the team AND the schedule, then
 *   send the operator to build a fresh one (Ed's "perfect schedule" rule).
 * - Games played, season has a BYE (odd count) → re-pair the remaining weeks
 *   (dropTeamOddLeague). Team withdrawn, history kept.
 * - Games played, no BYE (even count) → drop_team_mid_season (a new BYE takes
 *   the team's remaining matches). Team withdrawn, history kept.
 *
 * GATED (docs/list/2026-11-21-gated-odd-league-drop.md): production keeps the
 * old behavior (pre-season: the team becomes the BYE via convertTeamToBye;
 * mid-season: drop_team_mid_season, which refuses an odd league). On un-gate,
 * delete `dropLegacy` and convertTeamToBye's last caller goes with it.
 */

import { supabase } from '@/supabaseClient';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import { convertTeamToBye } from '@/api/mutations/teams';
import { isProduction } from '@/config/environment';
import { useInvalidateSeasonSchedule } from '@/api/hooks/useInvalidateSeasonSchedule';
import { dropTeamOddLeague, fetchSeasonByeTeamId } from './dropTeamOddLeague';
import { fetchSeasonScheduleState, removeTeamAndClearSchedule } from './preSeasonSchedule';
import type { TeamWithQueryDetails } from '@/types/team';
import type { ConfirmOptions } from '@/hooks/useConfirmDialog';

export interface UseTeamDropArgs {
  teams: TeamWithQueryDetails[];
  refreshTeams: () => Promise<void> | void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Called after a pre-season removal cleared the schedule (go rebuild it). */
  onScheduleCleared?: (seasonId: string) => void;
}

const destructive = (title: string, message: string, confirmText: string): ConfirmOptions =>
  ({ title, message, confirmText, confirmVariant: 'destructive' });

const MID_SEASON_DROP = 'This team is withdrawn and its past results stay on the record. ';

export function useTeamDrop({ teams, refreshTeams, confirm, onScheduleCleared }: UseTeamDropArgs) {
  const scheduleChanged = useInvalidateSeasonSchedule();

  /**
   * Confirm, run, refresh, toast. Returns true when the action succeeded.
   * `seasonId` set = the action changed that season's schedule, so the cache
   * is told (otherwise other pages keep showing the old schedule).
   */
  const run = async (options: ConfirmOptions, action: () => Promise<unknown>, success: string, seasonId?: string): Promise<boolean> => {
    if (!(await confirm(options))) return false;
    try {
      await action();
      if (seasonId) await scheduleChanged(seasonId);
      await refreshTeams();
      toast.success(success);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Error removing team', { error: message });
      toast.error(message || 'Failed to remove team');
      return false;
    }
  };

  const midSeasonRpc = (teamId: string, seasonId: string) => async () => {
    const { error } = await supabase.rpc('drop_team_mid_season', { p_team_id: teamId, p_season_id: seasonId });
    if (error) throw new Error(error.message);
  };

  /** Staging rules (see file header). */
  const dropGated = async (teamId: string, seasonId: string) => {
    const state = await fetchSeasonScheduleState(seasonId);
    if (!state.started) {
      const done = await run(
        destructive('Remove this team and rebuild the schedule?',
          'No games have been played yet, so this team will be removed and the schedule deleted. You will then build a fresh schedule for the remaining teams. This cannot be undone.',
          'Remove & Rebuild'),
        () => removeTeamAndClearSchedule(teamId, seasonId),
        'Team removed. Build the new schedule next.', seasonId);
      if (done) onScheduleCleared?.(seasonId);
      return;
    }
    const byeTeamId = await fetchSeasonByeTeamId(seasonId);
    if (byeTeamId) {
      await run(
        destructive('Drop this team?', MID_SEASON_DROP +
          "For each remaining week, the team that was due to play it gets a new opponent (usually the team that had the bye that week), so nobody gets a bye from this. Played weeks don't change. This cannot be undone.",
          'Drop Team'),
        () => dropTeamOddLeague(teamId, seasonId, byeTeamId),
        'Team dropped. The remaining schedule has been re-paired.', seasonId);
      return;
    }
    await run(
      destructive('Drop this team mid-season?', MID_SEASON_DROP +
        'A BYE replaces it for all its remaining matches, so its upcoming opponents get bye weeks. This cannot be undone.',
        'Drop Team'),
      midSeasonRpc(teamId, seasonId),
      'Team dropped. Its remaining matches are now BYE weeks.', seasonId);
  };

  /** Production rules, unchanged until the gate is lifted. */
  const dropLegacy = async (teamId: string, seasonId: string) => {
    const { count, error } = await supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .or('winner_team_id.not.is.null,status.in.(in_progress,awaiting_verification,completed,forfeited)');
    if (error) throw new Error(error.message);
    if ((count ?? 0) > 0) {
      await run(
        destructive('Drop this team mid-season?', MID_SEASON_DROP +
          'A BYE replaces it for all its REMAINING matches, so its upcoming opponents get bye weeks. This cannot be undone.',
          'Drop Team'),
        midSeasonRpc(teamId, seasonId),
        'Team dropped. Its remaining matches are now BYE weeks.', seasonId);
      return;
    }
    await run(
      destructive('Drop this team?',
        'This team becomes the BYE: its name and roster are cleared, its players are freed, and every team scheduled against it gets a bye week that week. The schedule is NOT regenerated. This cannot be undone.',
        'Drop to BYE'),
      () => convertTeamToBye({ teamId, seasonId }),
      'Team dropped. Its schedule slot is now a BYE.', seasonId);
  };

  const handleDeleteTeam = async (teamId: string) => {
    try {
      const { count, error } = await supabase
        .from('matches')
        .select('id', { count: 'exact', head: true })
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);
      if (error) throw new Error(error.message);

      // No schedule for this team → a genuine delete.
      if ((count ?? 0) === 0) {
        await run(
          destructive('Delete Team?',
            'This team has no matches yet. Deleting it will permanently remove the team and its roster. This cannot be undone.',
            'Delete Team'),
          async () => {
            const { error: deleteError } = await supabase.from('teams').delete().eq('id', teamId);
            if (deleteError) throw new Error(deleteError.message);
          },
          'Team deleted.');
        return;
      }

      const seasonId = teams.find((t) => t.id === teamId)?.season_id;
      if (!seasonId) {
        toast.error('Could not determine the season for this team.');
        return;
      }
      await (isProduction ? dropLegacy : dropGated)(teamId, seasonId);
    } catch (err) {
      logger.error('Error checking team schedule', { error: err instanceof Error ? err.message : String(err) });
      toast.error("Could not check the team's schedule. Please try again.");
    }
  };

  return { handleDeleteTeam };
}
