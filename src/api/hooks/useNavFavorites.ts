/**
 * @fileoverview useNavFavorites — the member's starred menu entries.
 *
 * Reads `members.nav_favorites` off the cached member record and saves
 * changes back to it, so favorites follow the player between devices.
 *
 * Optimistic: the star flips the moment it's tapped (the cached member is
 * updated first), and flips back with a toast if the save fails. Without that
 * a tap would wait on the network before the row moved, which feels broken on
 * a bar's wifi.
 *
 * NULL in the column means "never customised" = no favorites today.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useUser } from '@/context/useUser';
import type { Member } from '@/types';
import { useCurrentMember } from './useCurrentMember';
import { queryKeys } from '../queryKeys';
import { updateNavFavorites } from '../mutations/members';

/**
 * @returns `favoriteIds` (the saved list, `[]` when none) and
 *   `toggleFavorite(id)` (star ↔ un-star one entry).
 * @example
 * const { favoriteIds, toggleFavorite } = useNavFavorites();
 * toggleFavorite('rules'); // Rules jumps into Favorites right away
 */
export function useNavFavorites() {
  const { user } = useUser();
  const { data: member } = useCurrentMember();
  const queryClient = useQueryClient();
  const memberKey = queryKeys.members.byUser(user?.id ?? '');
  const favoriteIds = member?.nav_favorites ?? [];

  const mutation = useMutation({
    mutationFn: (next: string[]) => updateNavFavorites(member!.id, next),
    onMutate: async (next) => {
      // Stop an in-flight refetch from overwriting the optimistic value.
      await queryClient.cancelQueries({ queryKey: memberKey });
      const previous = queryClient.getQueryData<Member>(memberKey);
      if (previous) queryClient.setQueryData<Member>(memberKey, { ...previous, nav_favorites: next });
      return { previous };
    },
    onError: (_error, _next, context) => {
      if (context?.previous) queryClient.setQueryData(memberKey, context.previous);
      toast.error("Couldn't save your favorites. Please try again.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: memberKey }),
  });

  const toggleFavorite = (id: string) => {
    if (!member) return;
    const next = favoriteIds.includes(id)
      ? favoriteIds.filter((f) => f !== id)
      : [...favoriteIds, id];
    mutation.mutate(next);
  };

  return { favoriteIds, toggleFavorite };
}
