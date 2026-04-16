/**
 * @fileoverview useSaveScheduleV2 — inserts season_weeks for a new season
 *
 * Part of the "Create New League" flow — this is INSERT ONLY. The season
 * is brand new and should have no existing weeks. If there are existing
 * weeks, something went wrong (re-running the wizard on an existing season)
 * and the DB will throw a conflict error.
 *
 * For EDITING an existing schedule mid-season, use SeasonScheduleManager.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import type { WeekEntry } from '@/types/season';

interface SaveScheduleArgs {
  seasonId: string;
  schedule: WeekEntry[];
}

/** Map UI week type to DB week type (same logic as createSeason) */
function toDbWeekType(week: WeekEntry): 'regular' | 'playoffs' | 'blackout' | 'season_end_break' {
  if (week.type === 'week-off') {
    return week.weekName === 'Season End Break' ? 'season_end_break' : 'blackout';
  }
  if (week.type === 'playoffs') return 'playoffs';
  return 'regular';
}

export function useSaveScheduleV2() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ seasonId, schedule }: SaveScheduleArgs) => {
      // Insert-only — this wizard creates new seasons, never edits existing ones
      const rows = schedule.map((week) => ({
        season_id: seasonId,
        scheduled_date: week.date,
        week_name: week.weekName,
        week_type: toDbWeekType(week),
        week_completed: false,
        notes: null,
      }));

      const { error } = await supabase.from('season_weeks').insert(rows);

      if (error) {
        throw new Error(`Failed to save schedule: ${error.message}`);
      }

      return { seasonId, weeksInserted: rows.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['season_weeks'] });
      queryClient.invalidateQueries({ queryKey: ['seasons'] });
    },
  });
}
