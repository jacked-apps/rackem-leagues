/**
 * @fileoverview ChangeSeasonLengthDialog
 *
 * A focused two-step dialog for changing a season's regular-season length: set the new
 * number of weeks (NumberStepper, 10–52), review the add/remove impact, then confirm —
 * which calls `applySeasonLengthChange`. Lengthen appends weeks (matchups continue the
 * rotation); shorten trims the tail and is refused if a removed week was already played.
 *
 * Kept self-contained (not the heavy creation-wizard infra) — it's a small, low-stakes,
 * early-season correction. The entry button on the Manage Schedule page gates it on the
 * week-5 lock.
 *
 * @see docs/plans/2026-06-11-002-feat-change-season-length-plan.md — Unit 4
 */
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { NumberStepper } from '@/components/wizard/NumberStepper';
import { parseLocalDate } from '@/utils/formatters';
import {
  classifyLengthChange,
  MIN_SEASON_LENGTH,
  MAX_SEASON_LENGTH,
} from '@/utils/seasonLengthEdit';
import { applySeasonLengthChange } from '@/utils/applySeasonLengthChange';

/** Minimal week shape the dialog needs to preview a shorten's removed weeks. */
export interface DialogWeek {
  weekName: string;
  date: string;
  weekType: string;
}

interface ChangeSeasonLengthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seasonId: string;
  currentLength: number;
  /** The season's weeks (used to list the specific weeks a shorten removes). */
  weeks: DialogWeek[];
  /** Called after a successful change so the page can reload the fresh schedule. */
  onApplied: () => void;
}

const fmt = (iso: string) =>
  parseLocalDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function ChangeSeasonLengthDialog({
  open,
  onOpenChange,
  seasonId,
  currentLength,
  weeks,
  onApplied,
}: ChangeSeasonLengthDialogProps) {
  const [step, setStep] = useState<'set' | 'review'>('set');
  const [target, setTarget] = useState(currentLength);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset to a clean state whenever the dialog opens.
  const handleOpenChange = (next: boolean) => {
    if (next) {
      setStep('set');
      setTarget(currentLength);
      setError(null);
    }
    onOpenChange(next);
  };

  const cls = classifyLengthChange(currentLength, target);

  // The specific regular weeks a shorten would remove (the tail, by date).
  const removedWeeks =
    cls.kind === 'shorten'
      ? weeks
          .filter((w) => w.weekType === 'regular')
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(currentLength - cls.delta)
      : [];

  const handleConfirm = async () => {
    setProcessing(true);
    setError(null);
    const result = await applySeasonLengthChange(seasonId, target);
    setProcessing(false);
    if (result.success) {
      toast.success(
        `Season is now ${target} weeks${result.newEndDate ? `, ending ${fmt(result.newEndDate)}` : ''}.`,
      );
      onApplied();
      onOpenChange(false);
    } else {
      setError(result.error ?? 'Could not change the season length. Please try again.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {step === 'set' ? (
          <>
            <DialogHeader>
              <DialogTitle>Change season length</DialogTitle>
              <DialogDescription>
                This season is currently {currentLength} weeks. Choose the new number of
                regular-play weeks.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <NumberStepper
                label="Weeks of regular play"
                value={target}
                onChange={setTarget}
                min={MIN_SEASON_LENGTH}
                max={MAX_SEASON_LENGTH}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} loadingText="none">
                Cancel
              </Button>
              <Button
                onClick={() => setStep('review')}
                disabled={cls.kind === 'noop'}
                loadingText="none"
              >
                Review
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Review the change</DialogTitle>
              <DialogDescription>
                {currentLength} → {target} weeks.
              </DialogDescription>
            </DialogHeader>

            <div className="py-2 text-sm text-foreground space-y-3">
              {cls.kind === 'lengthen' && (
                <p>
                  Adds {cls.delta} week{cls.delta > 1 ? 's' : ''} to the end (weeks{' '}
                  {currentLength + 1}–{target}) with their matchups, and pushes your
                  season-end break and playoffs out {cls.delta} week{cls.delta > 1 ? 's' : ''}.
                </p>
              )}
              {cls.kind === 'shorten' && (
                <div className="space-y-2">
                  <p>
                    Removes the last {cls.delta} week{cls.delta > 1 ? 's' : ''} and their
                    matchups, and pulls your break/playoffs in {cls.delta} week
                    {cls.delta > 1 ? 's' : ''}:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground">
                    {removedWeeks.map((w) => (
                      <li key={w.date}>
                        {w.weekName} — {fmt(w.date)}
                      </li>
                    ))}
                  </ul>
                  <p className="text-muted-foreground">
                    (A week that's already been played can't be removed.)
                  </p>
                </div>
              )}

              {error && <p className="text-destructive font-medium">{error}</p>}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setStep('set');
                  setError(null);
                }}
                disabled={processing}
                loadingText="none"
              >
                Back
              </Button>
              <Button onClick={handleConfirm} isLoading={processing} loadingText="Applying...">
                Confirm
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
