/**
 * @fileoverview CaptainReupSyncer — app-level, mount-once component that pops
 * the captain re-up modal. Mounted in App.tsx near DocumentTitleUnreadSyncer.
 */

import React, { useState } from 'react';
import { useCurrentMember } from '@/api/hooks/useCurrentMember';
import { useCaptainReupPrompt } from '@/hooks/useCaptainReupPrompt';
import { CaptainReupModal } from './CaptainReupModal';

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
