/**
 * @fileoverview SubResolutionBanner — "canceled-modal" re-open affordance.
 *
 * Shown when the opposing team's locked lineup has an unresolved double-duty
 * placeholder AND the captain closed the OpponentSubstituteModal without
 * picking. Reopens the modal on tap.
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UserPlus } from 'lucide-react';

interface SubResolutionBannerProps {
  /** Show the banner only when true. Parent composes from modal state + opponent DD. */
  show: boolean;
  /** Opposing team name for the message. */
  opponentTeamLabel: string;
  /** Reopens the OpponentSubstituteModal. */
  onChoose: () => void;
}

export function SubResolutionBanner({
  show,
  opponentTeamLabel,
  onChoose,
}: SubResolutionBannerProps) {
  if (!show) return null;

  return (
    <Card className="border-blue-300 bg-blue-50">
      <CardContent className="flex items-center justify-between gap-3 py-3">
        <div className="flex items-center gap-3">
          <UserPlus className="h-5 w-5 shrink-0 text-blue-700" aria-hidden />
          <div className="text-sm text-blue-900">
            <strong>{opponentTeamLabel}</strong> needs a double-duty player picked.
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={onChoose}>
          Choose
        </Button>
      </CardContent>
    </Card>
  );
}
