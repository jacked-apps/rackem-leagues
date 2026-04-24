/**
 * @fileoverview PrepStatusBanner — named waiting state banner.
 *
 * Shown when my lineup is locked with a double-duty placeholder that the
 * OPPOSING captain needs to resolve. Non-blocking (stays above the roster,
 * doesn't dim the page). Hidden while OpponentSubstituteModal is open so
 * we don't stack two "sub resolution" affordances on the same screen.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Hourglass } from 'lucide-react';

interface PrepStatusBannerProps {
  /** Show the banner only when true. Parent composes this from blockedReason. */
  show: boolean;
  /** Opposing captain / team name for the message. */
  opponentLabel: string;
}

export function PrepStatusBanner({ show, opponentLabel }: PrepStatusBannerProps) {
  if (!show) return null;

  return (
    <Card className="border-amber-300 bg-amber-50">
      <CardContent className="flex items-center gap-3 py-3">
        <Hourglass className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
        <div className="text-sm text-amber-900">
          Waiting for <strong>{opponentLabel}</strong> to pick your double-duty player.
        </div>
      </CardContent>
    </Card>
  );
}
