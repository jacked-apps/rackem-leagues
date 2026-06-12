/**
 * @fileoverview SubResolutionBanner — opponent-DD info / "choose" affordance.
 *
 * Two states based on the opponent's lock status:
 *   - Pre-lock (opponent picked Double Duty but hasn't locked yet):
 *       informational only, no action available — handicaps may still
 *       change before they lock, so picking now is unsafe.
 *   - Post-lock (opponent locked with a DD placeholder, modal was dismissed):
 *       actionable "Choose" button re-opens the OpponentSubstituteModal.
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Info, UserPlus } from 'lucide-react';

interface SubResolutionBannerProps {
  /** Show the banner only when true. Parent composes from modal state + opponent DD. */
  show: boolean;
  /** Whether the opposing lineup is locked. Determines info-only vs actionable. */
  opponentLocked: boolean;
  /** Opposing team name for the message. */
  opponentTeamLabel: string;
  /** Reopens the OpponentSubstituteModal. Only invoked in the post-lock state. */
  onChoose: () => void;
}

export function SubResolutionBanner({
  show,
  opponentLocked,
  opponentTeamLabel,
  onChoose,
}: SubResolutionBannerProps) {
  if (!show) return null;

  if (!opponentLocked) {
    // Opponent picked DD but hasn't locked their lineup yet. Don't let me
    // pick — their player handicaps could still change before lock. Just
    // tell me what's happening.
    return (
      <Card className="border-info/40 bg-info/10">
        <CardContent className="flex items-center gap-3 py-3">
          <Info className="h-5 w-5 shrink-0 text-info" aria-hidden />
          <div className="text-sm text-foreground">
            <strong>{opponentTeamLabel}</strong> picked Double Duty for one of
            their slots. Once they lock their lineup, you'll be asked to pick
            which of their players plays in two positions.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Opponent is locked with DD; modal was dismissed. Re-open it.
  return (
    <Card className="border-info/40 bg-info/10">
      <CardContent className="flex items-center justify-between gap-3 py-3">
        <div className="flex items-center gap-3">
          <UserPlus className="h-5 w-5 shrink-0 text-info" aria-hidden />
          <div className="text-sm text-foreground">
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
