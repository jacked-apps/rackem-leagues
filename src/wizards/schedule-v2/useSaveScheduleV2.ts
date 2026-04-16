/**
 * @fileoverview useSaveScheduleV2 — saves season_weeks for a season in the wizard
 *
 * Part of the "Create New League" flow. The flow can be resumed mid-schedule
 * (user refreshes or leaves and comes back), so this is a REPLACE operation:
 * clears any existing weeks for the season, then inserts the new ones.
 *
 * Editing schedules AFTER matches are played happens in SeasonScheduleManager
 * which uses a different, additive approach.
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
      // Clear any existing weeks for this season (handles resume)
      const { error: delErr } = await supabase
        .from('season_weeks')
        .delete()
        .eq('season_id', seasonId);
      if (delErr) throw new Error(`Failed to clear existing weeks: ${delErr.message}`);

      const rows = schedule.map((week) => ({
        season_id: seasonId,
        scheduled_date: week.date,
        week_name: week.weekName,
        week_type: toDbWeekType(week),
        week_completed: false,
        notes: null,
      }));

      const { error } = await supabase.from('season_weeks').insert(rows);
      if (error) throw new Error(`Failed to save schedule: ${error.message}`);

      return { seasonId, weeksInserted: rows.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['season_weeks'] });
      queryClient.invalidateQueries({ queryKey: ['seasons'] });
    },
  });
}
