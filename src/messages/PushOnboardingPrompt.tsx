/**
 * @fileoverview Push notification onboarding prompt (Unit 6).
 *
 * A separate, single-purpose first-run prompt (distinct from the profanity
 * modal) shown on Messages open while the member hasn't answered the push
 * question — i.e. `members.push_enabled IS NULL`.
 *
 * Three-way, unlike the profanity modal:
 *   - Turn on   → subscribe this device (push_enabled = true). Stops asking.
 *   - No thanks → push_enabled = false. Stops asking.
 *   - Not now / dismiss → leaves push_enabled NULL → asked again next time they
 *     come to Messages (the deliberate loud-nudge for v1).
 *
 * On Turn on / No thanks we persist AND invalidate the member cache so the gate
 * closes reliably; Not now only closes locally (nothing persisted). Renders
 * nothing unless the device can actually turn push on right now (capability
 * 'supported') — no point nagging an unsupported/denied browser.
 *
 * See: docs/plans/2026-08-18-001-feat-message-push-notifications-plan.md (Unit 6)
 */

import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { queryKeys } from '@/api/queryKeys';
import { usePushSubscription } from '@/api/hooks/usePushSubscription';
import { setMemberPushEnabled } from '@/api/mutations/pushSubscriptions';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

interface PushOnboardingPromptProps {
  /** Supabase auth user id — used to invalidate the member cache. */
  userId: string;
  /** members.id of the current member. */
  memberId: string;
  /** Called once the prompt is resolved (any path); parent stops rendering it. */
  onResolved: () => void;
}

export function PushOnboardingPrompt({
  userId,
  memberId,
  onResolved,
}: PushOnboardingPromptProps) {
  const queryClient = useQueryClient();
  const push = usePushSubscription({ memberId, pushEnabled: null });
  const [submitting, setSubmitting] = useState(false);
  const doneRef = useRef(false);

  // Only prompt when this device can actually turn push on right now.
  if (push.capability !== 'supported') return null;

  const invalidateMember = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.members.byUser(userId),
    });

  const finish = () => {
    doneRef.current = true;
    onResolved();
  };

  const enable = async () => {
    if (submitting || doneRef.current) return;
    setSubmitting(true);
    try {
      await push.subscribe();
      await invalidateMember();
      finish();
    } catch (err) {
      logger.error('Push onboarding: enable failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      toast.error('Could not turn on notifications. You can try again in Settings.');
    } finally {
      setSubmitting(false);
    }
  };

  const decline = async () => {
    if (submitting || doneRef.current) return;
    setSubmitting(true);
    try {
      await setMemberPushEnabled(memberId, false);
      await invalidateMember();
      finish();
    } catch (err) {
      logger.error('Push onboarding: decline failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      toast.error('Could not save that choice. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Not now (and any dismiss): leave push_enabled NULL so it asks again next time.
  const notNow = () => {
    if (doneRef.current) return;
    finish();
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) notNow();
      }}
    >
      <DialogContent className="sm:max-w-md" data-testid="push-onboarding-modal">
        <DialogHeader>
          <DialogTitle>Turn on message notifications?</DialogTitle>
          <DialogDescription>
            Get a chime on this device when someone messages you — even when the
            app is closed. You can change this anytime in Settings.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            loadingText="none"
            disabled={submitting}
            onClick={notNow}
            data-testid="push-onboarding-not-now"
          >
            Not now
          </Button>
          <Button
            variant="outline"
            loadingText="none"
            disabled={submitting}
            onClick={decline}
            data-testid="push-onboarding-no"
          >
            No thanks
          </Button>
          <Button
            variant="default"
            loadingText="none"
            disabled={submitting}
            onClick={enable}
            data-testid="push-onboarding-yes"
          >
            Turn on
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
