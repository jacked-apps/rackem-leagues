/**
 * @fileoverview useCaptainReupPrompt — TanStack hook + app-level
 * syncer component.
 *
 * `useCaptainReupPrompt()` reads the current user's member id from
 * the cached member-profile query and asks `getCaptainReupPrompt`
 * which teams (if any) need a re-up answer right now. Returns the
 * list — empty means no modal should show.
 *
 * `<CaptainReupSyncer />` is the mount-once component that uses the
 * hook + renders the modal. Mounted in App.tsx near
 * DocumentTitleUnreadSyncer.
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentMember } from '@/api/hooks/useCurrentMember';
import { getCaptainReupPrompt } from '@/api/queries/captainReupPrompt';
import { CaptainReupModal } from '@/components/reup/CaptainReupModal';

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

/**
 * Mount-once syncer that pops the captain re-up modal when the
 * current user has unanswered re-ups. Closes when the captain
 * resolves all of them or dismisses.
 */
export function CaptainReupSyncer(): React.ReactElement | null {
  const { data: member } = useCurrentMember();
  const { data: teams = [] } = useCaptainReupPrompt();
  const [closedByUser, setClosedByUser] = useState(false);

  if (!member?.id || teams.length === 0) return null;
  if (closedByUser) return null;

  return (
    <CaptainReupModal
      open
      onOpenChange={(open) => {
        if (!open) setClosedByUser(true);
      }}
      teams={teams}
      currentCaptainId={member.id}
    />
  );
}
