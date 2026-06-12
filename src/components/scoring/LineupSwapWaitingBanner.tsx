/**
 * @fileoverview LineupSwapWaitingBanner — initiator-side pending-swap banner.
 *
 * Shown to the scorekeeper who opened a mid-match player swap while it waits
 * for the opposing side to approve or deny. Auto-clears when the request
 * resolves — the parent simply stops rendering it once swap_position returns
 * to null (and a resolution toast fires).
 *
 * Fixed bg + fixed text colors per the dark-mode discipline: a fixed-color
 * background needs fixed-color text so it doesn't flip to white in dark mode.
 * Mirrors PrepStatusBanner's post-lock waiting state.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Hourglass } from 'lucide-react';

interface LineupSwapWaitingBannerProps {
  /** Render only when true (a swap request is pending on my lineup). */
  show: boolean;
  /** 1-based lineup position being swapped. */
  position: number;
  /** Display name of the player being swapped in. */
  newPlayerName: string;
  /** Opposing team / scorekeeper label who will approve or deny. */
  opponentLabel: string;
}

export function LineupSwapWaitingBanner({
  show,
  position,
  newPlayerName,
  opponentLabel,
}: LineupSwapWaitingBannerProps) {
  if (!show) return null;

  return (
    <Card className="border-amber-300 bg-amber-50">
      <CardContent className="flex items-center gap-3 py-3">
        <Hourglass className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
        <div className="text-sm text-amber-900">
          Lineup change pending — waiting for <strong>{opponentLabel}</strong> to
          approve swapping in <strong>{newPlayerName}</strong> at position {position}.
        </div>
      </CardContent>
    </Card>
  );
}
