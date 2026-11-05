/**
 * @fileoverview Profanity onboarding modal (Unit 9).
 *
 * Shown once, the first time a member opens the Messages page, while
 * `members.profanity_onboarding_completed_at IS NULL`. NOT shown at app
 * first-load — that was too intrusive (revised 2026-05-14).
 *
 * Framing: the filter is ON by default. The modal's only job is to give
 * the user a one-time, low-friction chance to turn it OFF. It is not a
 * persistent question — every exit path records a choice so the modal
 * never reappears:
 *
 *   - "Turn filter off"  → mutation: enabled=false, completed=now()
 *   - "Keep filter on"   → mutation: enabled=true,  completed=now()
 *   - Dismiss (Escape / backdrop / X) → treated as "keep on": mutation
 *     with enabled=true, completed=now(). One-time bother, defaulted on.
 *
 * On a mutation failure the modal stays open (nothing was recorded) so
 * the user can retry — and if they navigate away, it'll simply prompt
 * again next time, which is correct since the choice wasn't saved.
 */

import { useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useMarkProfanityOnboardingComplete } from '@/api/hooks';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

interface ProfanityOnboardingModalProps {
  /** Supabase auth user id of the current member. */
  userId: string;
  /** Called once the choice is successfully persisted. Parent should stop rendering the modal. */
  onResolved: () => void;
}

export function ProfanityOnboardingModal({
  userId,
  onResolved,
}: ProfanityOnboardingModalProps) {
  const mutation = useMarkProfanityOnboardingComplete();
  const [submitting, setSubmitting] = useState(false);
  // Guards against a double-resolve: e.g. clicking a button AND the
  // resulting dialog close both trying to persist a choice.
  const resolvedRef = useRef(false);

  const resolve = async (filterEnabled: boolean) => {
    if (submitting || resolvedRef.current) return;
    setSubmitting(true);
    try {
      await mutation.mutateAsync({ userId, filterEnabled });
      resolvedRef.current = true;
      onResolved();
    } catch (err) {
      logger.error('Failed to record profanity onboarding choice', {
        error: err instanceof Error ? err.message : String(err),
      });
      toast.error('Could not save your choice. Please try again.');
      // resolvedRef stays false → modal stays open → user can retry.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        // Any dismiss path (Escape / backdrop / X) defaults the filter ON.
        if (!next) resolve(true);
      }}
    >
      <DialogContent className="sm:max-w-md" data-testid="profanity-onboarding-modal">
        <DialogHeader>
          <DialogTitle>Profanity filter</DialogTitle>
          <DialogDescription>
            A profanity filter is provided to hide profane language from your
            message content. It does not limit what you or others write — only
            how <strong>you</strong> view it. It is turned <strong>on</strong> by
            default, and you can change this anytime in Settings.
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-foreground">
          Would you like to turn the filter off to see the full content of all
          messages?
        </p>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="default"
            loadingText="none"
            disabled={submitting}
            onClick={() => resolve(false)}
            data-testid="onboarding-turn-off"
          >
            Turn filter off
          </Button>
          <Button
            variant="default"
            loadingText="none"
            disabled={submitting}
            onClick={() => resolve(true)}
            data-testid="onboarding-keep-on"
          >
            Keep filter on
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
