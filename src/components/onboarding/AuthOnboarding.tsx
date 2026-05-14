/**
 * @fileoverview Top-level mount for post-auth onboarding prompts.
 *
 * Currently surfaces only the Unit 9 profanity-filter modal, but
 * structured so additional one-time onboarding prompts (push permission
 * ask, etc.) can be added here without touching `App.tsx` again.
 *
 * Mount rules for the profanity modal:
 *   - Wait for both auth (`useUser`) AND the current-member query to
 *     resolve before deciding whether to render. Returning null during
 *     loading prevents a flash-of-modal for returning users whose
 *     `profanity_onboarding_completed_at` is already set.
 *   - Render iff the member exists AND that column is NULL AND the user
 *     hasn't dismissed it in this session.
 *   - Dismissal (Decide later / Escape / backdrop / X) is per-session;
 *     the modal returns on next app load until the user explicitly
 *     picks Yes or No.
 *   - Yes / No invalidates the current-member cache, which flips
 *     `profanity_onboarding_completed_at` to a timestamp and unmounts
 *     this modal on the next render.
 */

import { useState } from 'react';
import { useUser } from '@/context/useUser';
import { useCurrentMember } from '@/api/hooks';
import { ProfanityOnboardingModal } from './ProfanityOnboardingModal';

export function AuthOnboarding() {
  const { user, loading: authLoading } = useUser();
  const { data: member, isLoading: memberLoading } = useCurrentMember();
  const [dismissedThisSession, setDismissedThisSession] = useState(false);

  if (authLoading || memberLoading) return null;
  if (!user || !member) return null;
  if (member.profanity_onboarding_completed_at) return null;
  if (dismissedThisSession) return null;

  return (
    <ProfanityOnboardingModal
      open
      userId={user.id}
      onOpenChange={(open) => {
        if (!open) setDismissedThisSession(true);
      }}
    />
  );
}
