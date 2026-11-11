/**
 * @fileoverview ReadOnlyBanner Component
 *
 * Renders in place of the message composer when the current user can read
 * a conversation but cannot post in it. Two reasons currently surface
 * a banner (see `useMessageComposerStatus`):
 *
 *   - `past-member`: user was on the chat once but has been removed
 *     (roster change, captain transfer, soft-delete).
 *   - `announcement-non-staff`: conversation is an announcements channel
 *     and the current user isn't org staff.
 *
 * The composer is unmounted by the parent (not just hidden by CSS) so
 * the input doesn't show up in tab order or screen-reader output.
 */

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock } from 'lucide-react';
import type { ComposerLockReason } from '@/api/hooks';

const COPY: Record<ComposerLockReason, { title: string; body: string }> = {
  'past-member': {
    title: 'Past member — read only',
    body: "You're seeing the messages from when you were on this chat. You can read history but can't post new messages.",
  },
  'announcement-non-staff': {
    title: 'Announcements channel — read only',
    body: 'Only league staff can post here. You receive announcements but can’t reply in this channel.',
  },
};

interface ReadOnlyBannerProps {
  reason: ComposerLockReason;
}

export function ReadOnlyBanner({ reason }: ReadOnlyBannerProps) {
  const copy = COPY[reason];

  return (
    <Alert
      variant="default"
      className="rounded-none border-x-0 border-b-0"
      data-testid="read-only-banner"
      data-reason={reason}
    >
      <Lock className="h-4 w-4" aria-hidden />
      <AlertDescription>
        <span className="font-medium">{copy.title}.</span> {copy.body}
      </AlertDescription>
    </Alert>
  );
}
