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
 *
 * Unit 18 (2026-05-17): announcement chat titles got shortened to
 * universal "League Announcements" / "Global Announcements"; the
 * actual org/league name moves into THIS banner via the optional
 * `contextName` prop. When provided, the announcement banner reads
 * "Only staff from <Org Name> can post here." instead of the generic
 * "Only league staff can post here." Past-member banner copy doesn't
 * interpolate the context — kept simple.
 */

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock } from 'lucide-react';
import type { ComposerLockReason } from '@/api/hooks';

interface ReadOnlyBannerProps {
  reason: ComposerLockReason;
  /** Org or league name to interpolate into the announcement banner copy.
   *  Ignored for `reason='past-member'`. When absent for an announcements
   *  banner, falls back to the generic "league staff" wording. */
  contextName?: string | null;
}

function copyFor(reason: ComposerLockReason, contextName?: string | null) {
  switch (reason) {
    case 'past-member':
      return {
        title: 'Past member — read only',
        body: "You're seeing the messages from when you were on this chat. You can read history but can't post new messages.",
      };
    case 'announcement-non-staff':
      return {
        title: 'Announcements channel — read only',
        body: contextName
          ? `Only staff from ${contextName} can post here. You receive announcements but can’t reply in this channel.`
          : 'Only league staff can post here. You receive announcements but can’t reply in this channel.',
      };
  }
}

export function ReadOnlyBanner({ reason, contextName }: ReadOnlyBannerProps) {
  const copy = copyFor(reason, contextName);

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
