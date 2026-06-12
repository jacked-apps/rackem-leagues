/**
 * @fileoverview useTeamImport — the "Import from Last Season" flow for the Manage
 * Teams surface: confirm, read the previous season's teams/rosters/venues, and
 * report success. Extracted from `src/operator/TeamManagement.tsx`.
 *
 * NOTE: the import itself is still stubbed (it validates the source data + shows
 * a success toast but does not yet write the new teams) — behavior is preserved
 * faithfully from the original; the dead, result-discarding `.map()` scratch work
 * that lived inline was dropped (it had no effect).
 */

import { useState } from 'react';
import { supabase } from '@/supabaseClient';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import type { ConfirmOptions } from '@/hooks/useConfirmDialog';

export function useTeamImport(
  leagueId: string | undefined,
  previousSeasonId: string | null,
  seasonId: string | null,
  confirm: (options: ConfirmOptions) => Promise<boolean>,
) {
  const [importingTeams, setImportingTeams] = useState(false);

  const handleImportTeams = async () => {
    if (!previousSeasonId || !seasonId || !leagueId) return;

    const confirmImport = await confirm({
      title: 'Import Teams?',
      message:
        'Import teams from last season? This will copy:\n• All team names and captains\n• Home venue assignments\n• Full rosters\n• League venue assignments',
      confirmText: 'Import',
      confirmVariant: 'default',
    });
    if (!confirmImport) return;

    setImportingTeams(true);
    try {
      // Previous season's active teams (active only — don't pull bye/withdrawn).
      const { data: prevTeams, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .eq('season_id', previousSeasonId)
        .eq('status', 'active');
      if (teamsError) throw teamsError;

      // Previous rosters + league venues are validated (read + error-checked); the
      // actual copy is not yet wired (stub).
      const { error: rostersError } = await supabase
        .from('team_players')
        .select('id')
        .eq('season_id', previousSeasonId);
      if (rostersError) throw rostersError;

      const { error: leagueVenuesError } = await supabase
        .from('league_venues')
        .select('id')
        .eq('league_id', leagueId);
      if (leagueVenuesError) throw leagueVenuesError;

      // Simulate the write for now.
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast.success(`Successfully imported ${prevTeams?.length || 0} teams from last season!`);
    } catch (err) {
      logger.error('Error importing teams', {
        error: err instanceof Error ? err.message : String(err),
      });
      toast.error(err instanceof Error ? err.message : 'Failed to import teams');
    } finally {
      setImportingTeams(false);
    }
  };

  return { importingTeams, handleImportTeams };
}
