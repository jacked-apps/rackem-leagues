/**
 * @fileoverview useExistingWeeks — checks if season_weeks already exist
 *
 * Used by ScheduleWizardStep to decide whether to show the ExistingScheduleChoice
 * screen (keep vs start fresh) or go straight to the schedule editor.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';

export function useExistingWeeks(seasonId: string | null | undefined) {
  return useQuery({
    queryKey: ['season_weeks', 'exists', seasonId],
    queryFn: async () => {
      if (!seasonId) return { count: 0 };
      const { count, error } = await supabase
        .from('season_weeks')
        .select('*', { count: 'exact', head: true })
        .eq('season_id', seasonId);
      if (error) throw new Error(error.message);
      return { count: count ?? 0 };
    },
    enabled: !!seasonId,
    staleTime: 0,
  });
}
