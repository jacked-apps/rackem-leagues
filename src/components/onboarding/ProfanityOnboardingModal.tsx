/**
 * @fileoverview Profanity onboarding modal (Unit 9).
 *
 * Shown once per member at app first-load post-auth, while
 * `members.profanity_onboarding_completed_at IS NULL`. Asks the user
 * whether they want the profanity filter on; persists their choice.
 *
 * Three actions, all visually equal weight (no nudge toward either
 * yes/no per findings doc):
 *
 *   - "Yes, filter profanity"      → mutation: enabled=true,  completed=now()
 *   - "No, show me everything"     → mutation: enabled=false, completed=now()
 *   - "Decide later"               → close only; column stays NULL so the
 *                                    modal reappears on next app load.
 *
 * Escape / backdrop click / X button are all treated as "Decide later"
 * (no DB write).
 */

import { useState } from 'react';
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
  /** Controlled open state. */
  open: boolean;
  /** Called when the modal wants to close (any path — explicit choice or dismiss). */
  onOpenChange: (open: boolean) => void;
  /** Supabase auth user id of the current member. */
  userId: string;
}

export function ProfanityOnboardingModal({
  open,
  onOpenChange,
  userId,
}: ProfanityOnboardingModalProps) {
  const mutation = useMarkProfanityOnboardingComplete();
  // Disable both choice buttons while a write is in flight so a
  // double-click can't double-fire the mutation.
  const [submitting, setSubmitting] = useState(false);

  const recordChoice = async (filterEnabled: boolean) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await mutation.mutateAsync({ userId, filterEnabled });
      onOpenChange(false);
    } catch (err) {
      logger.error('Failed to record profanity onboarding choice', {
        error: err instanceof Error ? err.message : String(err),
      });
      toast.error('Could not save your choice. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="profanity-onboarding-modal">
        <DialogHeader>
          <DialogTitle>Profanity filter</DialogTitle>
          <DialogDescription>
            Filter profanity in messages? This only changes what{' '}
            <strong>you</strong> see — it never changes what others can send.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="default"
            loadingText="none"
            disabled={submitting}
            onClick={() => recordChoice(false)}
            data-testid="onboarding-no"
          >
            No, show me everything
          </Button>
          <Button
            variant="default"
            loadingText="none"
            disabled={submitting}
            onClick={() => recordChoice(true)}
            data-testid="onboarding-yes"
          >
            Yes, filter profanity
          </Button>
        </DialogFooter>

        <div className="flex justify-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
            data-testid="onboarding-later"
          >
            Decide later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
