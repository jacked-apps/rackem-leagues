/**
 * @fileoverview "Are you sure?" dialog for vacating a scored game (LO match
 * review). Vacating clears the recorded result so the operator can re-score —
 * there's no Deny path, so this confirm is the guard. Carries an OPTIONAL
 * operator reason (≤255 chars, client-capped) that's baked into the vacate
 * marker in the audit log.
 *
 * @see docs/plans/2026-06-04-001-feat-lo-match-review-correction-plan.md — Unit 7
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const REASON_MAX = 255;

export interface VacateConfirmDialogProps {
  open: boolean;
  gameNumber: number | null;
  /** Called with the optional trimmed reason (null if blank) when confirmed. */
  onConfirm: (reason: string | null) => void;
  onCancel: () => void;
  /** True while the vacate mutation is in flight. */
  isBusy?: boolean;
}

export function VacateConfirmDialog({
  open,
  gameNumber,
  onConfirm,
  onCancel,
  isBusy = false,
}: VacateConfirmDialogProps) {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    const trimmed = reason.trim();
    onConfirm(trimmed.length > 0 ? trimmed : null);
    setReason('');
  };

  const handleCancel = () => {
    setReason('');
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? handleCancel() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vacate game {gameNumber ?? ''}?</DialogTitle>
          <DialogDescription>
            This clears the recorded result so you can re-score it. There's no undo
            once you re-score — you can Undo right after vacating, though.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="vacate-reason">Reason (optional)</Label>
          <Textarea
            id="vacate-reason"
            data-testid="vacate-reason"
            value={reason}
            maxLength={REASON_MAX}
            placeholder="e.g. Player reported game 6 was scored to the wrong team."
            onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
          />
          <p className="text-right text-xs text-muted-foreground">
            {reason.length}/{REASON_MAX}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} loadingText="none">
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            isLoading={isBusy}
            loadingText="Vacating…"
            data-testid="vacate-confirm"
          >
            Vacate game
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
