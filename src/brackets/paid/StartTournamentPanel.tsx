/**
 * @fileoverview The Start control for a paid tournament's setup screen (Unit C3).
 *
 * Presentational — the page owns the data and the actual start. Two jobs:
 *
 *  1. Say plainly who is about to be in the bracket, since the official list is
 *     what gets seeded and everything else is discarded.
 *  2. Show what is being charged, itemised on demand — the price is on the
 *     button, and the breakdown is there for whoever wonders what it covers.
 *
 * The "sweep in whoever is waiting" choice does NOT live here — it belongs with
 * the waiting list it describes (see HopperView). This card only reports the
 * consequence of that choice in its player count, and the page warns before
 * starting if people are still waiting and the choice is off.
 */

import { Button } from '@/components/ui/button';
import { ChargeBreakdownPanel } from './ChargeBreakdownPanel';

interface StartTournamentPanelProps {
  officialCount: number;
  waitingCount: number;
  /** Whether the waiting list will be swept in — set over on the waiting list. */
  includeWaiting: boolean;
  onStart: () => void;
  starting: boolean;
  /** e.g. "$5" when premium features are being charged at start; null if free. */
  priceLabel: string | null;
  /** `brackets.premium_features`, for the itemised breakdown. */
  featureKeys?: readonly string[];
}

export function StartTournamentPanel({
  officialCount,
  waitingCount,
  includeWaiting,
  onStart,
  starting,
  priceLabel,
  featureKeys = [],
}: StartTournamentPanelProps) {
  // What the bracket will actually be built from, live as the checkbox flips.
  const total = officialCount + (includeWaiting ? waitingCount : 0);
  const canStart = total >= 2;

  return (
    <div className="space-y-3 rounded-md border p-3">
      <ChargeBreakdownPanel featureKeys={featureKeys} />

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
