/**
 * @fileoverview PrepStatusBanner — named waiting/info state banner.
 *
 * Shows when my lineup has a double-duty placeholder. Two states:
 *   - Pre-lock: explains what WILL happen after I lock ("a request will be
 *     sent to {opponent} to pick the double-duty player").
 *   - Post-lock: tells me what we're actually waiting on ("waiting for
 *     {opponent} to pick your substitute").
 *
 * Hidden while OpponentSubstituteModal is open so we don't stack two
 * sub-resolution affordances on the same screen.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Hourglass, Info } from 'lucide-react';

interface PrepStatusBannerProps {
  /** Show the banner only when true. Parent composes this from blockedReason. */
  show: boolean;
  /** Whether my lineup is locked. Determines pre-lock vs post-lock messaging. */
  locked: boolean;
  /** Opposing captain / team name for the message. */
  opponentLabel: string;
}

export function PrepStatusBanner({ show, locked, opponentLabel }: PrepStatusBannerProps) {
  if (!show) return null;

  if (!locked) {
    // Pre-lock: explain the upcoming flow so the captain knows nothing is
    // waiting on the opponent yet — once they lock, the opponent will be
    // pinged to pick the double-duty player.
    return (
      <Card className="border-blue-300 bg-blue-50">
        <CardContent className="flex items-center gap-3 py-3">
          <Info className="h-5 w-5 shrink-0 text-blue-700" aria-hidden />
          <div className="text-sm text-blue-900">
            You picked Double Duty for one of your slots. After you lock your
            lineup, a request will be sent to <strong>{opponentLabel}</strong> to
            choose which of your players plays in two positions.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Post-lock: we're actually waiting on opponent action now.
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
