/**
 * @fileoverview Manual-tiebreaker LO prompt (Phase 4 Unit 4.4 of the
 * modular-league-system v2 plan).
 *
 * Surfaces when a match ends tied AND
 * `system_snapshot.tiebreaker_format = 'manual'`. The LO picks the
 * winner team and optionally records additional games/points produced
 * during whatever tiebreaker rule the league actually used (which the
 * system doesn't model — that's the point).
 *
 * The original regular-game scores are NEVER altered by this dialog.
 * The dialog only writes the match-completion fields (winner_team_id,
 * match_result) and, when the LO supplies them, additional
 * `match_games` rows flagged `is_tiebreaker = true`. Calculator dispatch
 * decides whether those rows affect points totals — `linear_above_threshold`
 * keeps regular-game totals at the tie-band 0/0 (locked invariant);
 * a future calculator could choose differently.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

export interface ManualTiebreakerSubmission {
  /** The team the LO has selected as the match winner. */
  winnerTeam: 'home' | 'away';
}

interface ManualTiebreakerDialogProps {
  open: boolean;
  /** Called when the LO closes the dialog without picking a winner. */
  onCancel: () => void;
  /** Called with the LO's selection when they confirm. */
  onSubmit: (result: ManualTiebreakerSubmission) => void | Promise<void>;
  /** Display name for the home team. */
  homeTeamName: string;
  /** Display name for the away team. */
  awayTeamName: string;
  /**
   * `true` while the parent's submit handler is in flight. Disables the
   * Confirm button and shows the loading state. Optional — defaults
   * to `false`.
   */
  isSubmitting?: boolean;
}

export function ManualTiebreakerDialog({
  open,
  onCancel,
  onSubmit,
  homeTeamName,
  awayTeamName,
  isSubmitting = false,
}: ManualTiebreakerDialogProps) {
  const [winnerTeam, setWinnerTeam] = useState<'home' | 'away' | ''>('');

  const handleConfirm = () => {
    if (winnerTeam !== 'home' && winnerTeam !== 'away') return;
    onSubmit({ winnerTeam });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manual Tiebreaker</DialogTitle>
          <DialogDescription>
            This match ended tied. Your league uses a manual tiebreaker —
            pick the team that won the tiebreaker round. The original
            game scores stand as the official scoreboard; this entry
            decides the match outcome.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Label className="text-sm font-medium">Tiebreaker winner</Label>
          <RadioGroup
            value={winnerTeam}
            onValueChange={(v) => setWinnerTeam(v as 'home' | 'away')}
            className="space-y-2"
          >
            <div className="flex items-center gap-3">
              <RadioGroupItem value="home" id="manual-tb-home" />
              <Label htmlFor="manual-tb-home" className="font-normal">
                {homeTeamName}
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <RadioGroupItem value="away" id="manual-tb-away" />
              <Label htmlFor="manual-tb-away" className="font-normal">
                {awayTeamName}
              </Label>
            </div>
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!winnerTeam || isSubmitting}
            isLoading={isSubmitting}
            loadingText="Recording..."
          >
            Confirm Winner
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
