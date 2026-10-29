/**
 * @fileoverview useCaptainReupPrompt — TanStack hook.
 *
 * `useCaptainReupPrompt()` reads the current user's member id from
 * the cached member-profile query and asks `getCaptainReupPrompt`
 * which teams (if any) need a re-up answer right now. Returns the
 * list — empty means no modal should show.
 *
 * `<CaptainReupSyncer />` (components/reup/CaptainReupSyncer.tsx) is the
 * mount-once component that uses the hook + renders the modal.
 */

import { useQuery } from '@tanstack/react-query';
import { useCurrentMember } from '@/api/hooks/useCurrentMember';
import { getCaptainReupPrompt } from '@/api/queries/captainReupPrompt';

export function useCaptainReupPrompt() {
  const { data: member } = useCurrentMember();
  return useQuery({
    queryKey: ['captainReupPrompt', member?.id],
    queryFn: () => getCaptainReupPrompt(member!.id),
    enabled: !!member?.id,
    // Modal-show check — don't pound the DB. 5-minute window strikes
    // a balance between "responsive when the captain logs in fresh"
    // and "not on every navigation."
    staleTime: 5 * 60 * 1000,
  });
}
