/**
 * @fileoverview Replace-picker dialog for the approve surface.
 *
 * Opened when the approver chooses "Replace" on a join request. Lists the
 * team's unclaimed placeholders (each flagged when it carries a match record),
 * and requires a second confirm tap before the irreversible merge fires —
 * spelling out exactly which placeholder will be linked. Available whenever the
 * team has placeholders; if none, it says so and points at Add.
 *
 * See docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md (Unit 5).
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useTeamPlaceholders } from '@/api/hooks/useTeamPlaceholders';
import type { ClaimablePlaceholder } from '@/api/queries/teamJoin';

interface PlaceholderPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  /** The joiner being linked, for the confirm copy. */
  requesterName: string;
  /** Whether a merge is currently in flight (disables the confirm). */
  isPending: boolean;
  /** Fires the merge for the chosen placeholder. */
  onConfirm: (placeholderId: string) => void;
}

export const PlaceholderPicker: React.FC<PlaceholderPickerProps> = ({
  open,
  onOpenChange,
  teamId,
  requesterName,
  isPending,
  onConfirm,
}) => {
  const { data: placeholders, isLoading } = useTeamPlaceholders(open ? teamId : undefined);
  const [selected, setSelected] = useState<ClaimablePlaceholder | null>(null);

  // Reset the selection whenever the dialog re-opens.
  const handleOpenChange = (next: boolean) => {
    if (!next) setSelected(null);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {selected ? 'Confirm the link' : `Link ${requesterName} to a player`}
          </DialogTitle>
          <DialogDescription>
            {selected
              ? `Link ${requesterName} to ${selected.display_name}${selected.has_stats ? ' (has match record)' : ''}. This transfers that player's spot and record and can't be easily undone.`
              : 'Pick the existing player this is. Their spot and any match record transfer to the new account.'}
          </DialogDescription>
        </DialogHeader>

        {!selected && (
          <div className="space-y-2 py-2">
            {isLoading && <p className="text-sm text-muted-foreground">Loading players…</p>}
            {!isLoading && (placeholders?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">
                No unclaimed players on this team — use Add for a brand-new player.
              </p>
            )}
            {placeholders?.map((p) => (
              <Button
                key={p.member_id}
                variant="outline"
                className="w-full justify-between"
                onClick={() => setSelected(p)}
              >
                <span>{p.display_name}</span>
                {p.has_stats && (
                  <span className="text-xs text-muted-foreground">has record</span>
                )}
              </Button>
            ))}
          </div>
        )}

        {selected && (
          <DialogFooter className="gap-2">
            <Button variant="outline" loadingText="none" onClick={() => setSelected(null)}>
              Back
            </Button>
            <Button
              loadingText="Linking…"
              isLoading={isPending}
              disabled={isPending}
              onClick={() => onConfirm(selected.member_id)}
            >
              Link &amp; approve
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
