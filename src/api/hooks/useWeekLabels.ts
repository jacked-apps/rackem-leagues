/**
 * @fileoverview Week-label hook for single-match feeds.
 *
 * Some surfaces render a week label next to one match at a time (live/spectate
 * feeds, makeup lists) and therefore can't derive "Week N" from a single row —
 * the number is a week's POSITION among its season's regular weeks, which needs
 * the season's full week list.
 *
 * This hook takes the season ids present in such a feed, fetches every week for
 * those seasons in one query, and returns a weekId → derived-label map. The
 * label is computed per season (positions never cross season boundaries), so a
 * cross-league feed spanning multiple seasons is handled correctly.
 *
 * @see utils/scheduleDisplayUtils.ts - deriveWeekLabelsBySeason (the pure core)
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { deriveWeekLabelsBySeason } from '@/utils/scheduleDisplayUtils';

/**
 * Build a weekId → display-label map for every week in the given seasons.
 *
 * @param seasonIds - Season ids appearing in the feed (duplicates/nullish ok)
 * @returns Map of week id → label ("Week 5", "Playoffs", a blackout's label)
 *
 * @example
 * const weekLabels = useWeekLabelsForSeasons(matches.map(m => m.season_id));
 * const label = weekLabels.get(match.season_week?.id) ?? '';
 */
export function useWeekLabelsForSeasons(
  seasonIds: (string | null | undefined)[],
): Map<string, string> {
  // Stable, de-duplicated key so the query doesn't refetch on array identity churn.
  const ids = useMemo(
    () => Array.from(new Set(seasonIds.filter((id): id is string => !!id))).sort(),
    [seasonIds],
  );

  const { data: weeks = [] } = useQuery({
    queryKey: ['week-labels', 'seasons', ids],
    enabled: ids.length > 0,
    staleTime: 10 * 60 * 1000, // weeks rarely change mid-session
    queryFn: async () => {
      const { data, error } = await supabase
        .from('season_weeks')
        .select('id, season_id, week_type, scheduled_date, week_name, notes')
        .in('season_id', ids);
      if (error) throw error;
      return data ?? [];
    },
  });

  return useMemo(() => deriveWeekLabelsBySeason(weeks), [weeks]);
}
