/**
 * @fileoverview Persistent dispute banner (many-eyes Layer-2 / Amendment F).
 *
 * Loud, unmissable surface for games that auto-cleared because two initiators
 * disagreed (Amendment D). One row per disputed game; tapping a row opens the
 * dispute-detail modal (Amendment G) — when no `onDisputeClick` is passed,
 * the rows render as inert text (Amendment F can land without G).
 *
 * Renders nothing when there are zero disputes so it doesn't leave any
 * residual chrome in the normal scoring case. Color is the shadcn `Alert`
 * destructive variant — disputes are HIGH integrity risk and need to be
 * visible without being missed; auto-clear by itself isn't enough.
 *
 * Wording for the row text lives in the constants at the top of the file for
 * easy iteration; the component's shape doesn't change with copy tweaks.
 */

import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { GameDispute } from '@/utils/match/deriveDisputes';

// ── Copy (deferrable to Ed) ────────────────────────────────────────────────
// Banner is a loud category header — the count is implicit in the list of
// rows below, and the modal opened by tapping a row carries the full
// explanation (so no description line here, to avoid duplication).
const TITLE = 'SCORING DISPUTE!';
const ROW_PREFIX = 'Game';

export interface DisputeBannerProps {
  /** Output of `deriveDisputes` — one entry per game currently in dispute. */
  disputes: GameDispute[];
  /**
   * Optional click handler. When provided, each dispute row becomes a tappable
   * button (Amendment G wires this to open the detail modal). When omitted,
   * rows render as inert text so Amendment F is usable on its own.
   */
  onDisputeClick?: (gameId: string) => void;
}

export function DisputeBanner({ disputes, onDisputeClick }: DisputeBannerProps) {
  if (disputes.length === 0) return null;

  return (
    <Alert variant="destructive">
      <AlertTitle>{TITLE}</AlertTitle>
      <AlertDescription>
        <ul className="space-y-1">
          {disputes.map((d) => (
            <li key={d.game_id}>
              {onDisputeClick ? (
                <Button
                  variant="link"
                  className="h-auto px-0 py-0 text-destructive underline"
                  onClick={() => onDisputeClick(d.game_id)}
                >
                  {ROW_PREFIX} {d.game_number} — tap to see conflicting entries
                </Button>
              ) : (
                <span>
                  {ROW_PREFIX} {d.game_number} — needs resolution
                </span>
              )}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
