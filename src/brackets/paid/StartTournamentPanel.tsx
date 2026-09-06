/**
 * @fileoverview The Start control for a paid tournament's setup screen (Unit C3).
 *
 * Presentational — the page owns the data and the actual start. Two jobs:
 *
 *  1. Say plainly who is about to be in the bracket, since the official list is
 *     what gets seeded and everything else is discarded.
 *  2. Offer the waiting room as one tap. In practice the waiting room is people
 *     standing in the room wanting to play, so making the organizer admit twenty
 *     of them one at a time is busywork — but the checkbox is OFF by default and
 *     names its count, because a QR code on a flyer also collects the curious,
 *     and once a tournament starts its bracket can't be un-started.
 */

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface StartTournamentPanelProps {
  officialCount: number;
  waitingCount: number;
  includeWaiting: boolean;
  onIncludeWaitingChange: (include: boolean) => void;
  onStart: () => void;
  starting: boolean;
  /** e.g. "$5" when premium features are being charged at start; null if free. */
  priceLabel: string | null;
}

export function StartTournamentPanel({
  officialCount,
  waitingCount,
  includeWaiting,
  onIncludeWaitingChange,
  onStart,
  starting,
  priceLabel,
}: StartTournamentPanelProps) {
  // What the bracket will actually be built from, live as the checkbox flips.
  const total = officialCount + (includeWaiting ? waitingCount : 0);
  const canStart = total >= 2;

  return (
    <div className="space-y-3 rounded-md border p-3">
      {waitingCount > 0 && (
        <div className="flex items-start gap-3">
          <Checkbox
            id="include-waiting"
            checked={includeWaiting}
            disabled={starting}
            onCheckedChange={(c) => onIncludeWaitingChange(c === true)}
          />
          <Label htmlFor="include-waiting" className="cursor-pointer font-normal">
            Also add the {waitingCount} still waiting, as unpaid
          </Label>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        {canStart
          ? `Starting with ${total} ${total === 1 ? 'player' : 'players'}.`
          : 'Add at least 2 players before starting.'}
      </p>

      <Button
        type="button"
        className="w-full"
        loadingText="Starting…"
        isLoading={starting}
        disabled={!canStart}
        onClick={onStart}
      >
        {priceLabel ? `Start & pay ${priceLabel}` : 'Start tournament'}
      </Button>
    </div>
  );
}
