/**
 * @fileoverview Mutation hook for the "entered into LMS" marker on a match.
 *
 * CSI / FargoRate LMS has no bulk import, so an operator hand-types each
 * finished match into the LMS website. They work it as a backlog — a few weeks
 * at a sitting — so `matches.lms_entered_at` records which ones are already
 * done and the operator picks up where they left off.
 *
 * The marker is league-shared, not per-user: two operators on the same league
 * see one checkmark, which is the point — it stops them double-entering.
 *
 * **Why this writes the cache instead of only invalidating it:** the operator's
 * actual rhythm is tick-the-box → immediately hit Next (or back out to the
 * picker). A plain invalidate leaves a refetch in flight during that navigation,
 * so the next screen paints from the stale cached row and the checkmark looks
 * lost until a manual refresh. Writing the new value into every cache that
 * holds this match makes the change survive the navigation regardless of when
 * the refetch lands.
 *
 * @see supabase/migrations/20260904154852_matches_lms_entered_at.sql
 */

import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { queryKeys } from '../queryKeys';

/** Parameters for {@link useSetMatchLmsEntered}. */
export interface SetMatchLmsEnteredParams {
  matchId: string;
  /** true → stamp now (entered); false → clear back to NULL (not entered). */
  entered: boolean;
  /**
   * Season the match belongs to. Lets us patch (and later refresh) the season
   * schedule cache that the match picker reads.
   */
  seasonId?: string;
}

/** A cached object that may be the match we're patching. */
type MaybeMatch = { id?: string; lms_entered_at?: string | null } | null | undefined;

/**
 * Patch `lms_entered_at` into every cached shape that can hold this match:
 * the single-match detail queries and the nested season-schedule lists
 * (`WeekSchedule[]`, i.e. `{ week, matches }`).
 *
 * Uses `setQueriesData` with the *base* match key so it also catches the
 * variants hung off `matches.detail` (lineup, games, league-settings), any of
 * which may be the object a given screen renders from.
 */
function patchMatchInCaches(
  queryClient: QueryClient,
  matchId: string,
  value: string | null,
  seasonId?: string
) {
  const applyToMatch = <T extends MaybeMatch>(match: T): T =>
    match && match.id === matchId ? { ...match, lms_entered_at: value } : match;

  // Single-match caches (detail + its sub-keys).
  queryClient.setQueriesData<MaybeMatch>(
    { queryKey: queryKeys.matches.detail(matchId) },
    (old) => applyToMatch(old)
  );

  // Season schedule: WeekSchedule[] — each week carries a matches array.
  if (seasonId) {
    queryClient.setQueriesData<Array<{ matches?: MaybeMatch[] }>>(
      { queryKey: queryKeys.schedules.bySeason(seasonId) },
      (old) =>
        Array.isArray(old)
          ? old.map((week) => ({
              ...week,
              matches: week?.matches?.map(applyToMatch),
            }))
          : old
    );
  }
}

/**
 * Set (or clear) the LMS-entered marker on a single match.
 *
 * Optimistic: the checkbox flips immediately and the value is written into the
 * picker + sheet caches, so navigating away right after clicking still shows
 * the new state. Rolls back if the write fails.
 *
 * @returns TanStack Query mutation; call `mutate`/`mutateAsync` with
 *          {@link SetMatchLmsEnteredParams}.
 *
 * @example
 * const setEntered = useSetMatchLmsEntered();
 * setEntered.mutate({ matchId, entered: true, seasonId });
 */
export function useSetMatchLmsEntered() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ matchId, entered }: SetMatchLmsEnteredParams) => {
      const { error } = await supabase
        .from('matches')
        .update({ lms_entered_at: entered ? new Date().toISOString() : null })
        .eq('id', matchId);

      if (error) {
        throw new Error(`Failed to update LMS-entered status: ${error.message}`);
      }
    },

    onMutate: async ({ matchId, entered, seasonId }) => {
      // Stop in-flight refetches from landing on top of the optimistic value.
      await queryClient.cancelQueries({ queryKey: queryKeys.matches.detail(matchId) });
      if (seasonId) {
        await queryClient.cancelQueries({ queryKey: queryKeys.schedules.bySeason(seasonId) });
      }

      const previous = [
        ...queryClient.getQueriesData({ queryKey: queryKeys.matches.detail(matchId) }),
        ...(seasonId
          ? queryClient.getQueriesData({ queryKey: queryKeys.schedules.bySeason(seasonId) })
          : []),
      ];

      patchMatchInCaches(
        queryClient,
        matchId,
        entered ? new Date().toISOString() : null,
        seasonId
      );

      return { previous };
    },

    onError: (_err, _vars, context) => {
      // Put every touched cache back exactly as it was.
      context?.previous?.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },

    onSettled: (_data, _err, { matchId, seasonId }) => {
      // Reconcile with the server once the dust settles. The optimistic value
      // is already painted, so this refetch never causes a visible flicker.
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.detail(matchId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.all });
      if (seasonId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.schedules.bySeason(seasonId) });
      }
    },
  });
}
