/**
 * @fileoverview Dispute-detail modal (many-eyes Layer-2 / Amendment G).
 *
 * Opened from the persistent dispute banner (Amendment F). Shows the
 * conflicting initiator entries for one disputed game side-by-side so players
 * can see what each person said and talk it out at the table.
 *
 * No "Re-score" action lives in this modal by design — re-scoring goes through
 * the normal player-tap flow in the games list (consistent with the
 * brainstorm's "Re-score should just be a re-score, nothing special"). The
 * modal's value is INFORMATION: see the conflicting entries, then close and
 * re-enter.
 *
 * Renders nothing when `dispute` is null (controlled-open pattern via Radix).
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { GameDispute, DisputeInitiation } from '@/utils/match/deriveDisputes';
import type { ResultLike } from '@/utils/match/deriveDissents';

// ── Copy (deferrable to Ed) ────────────────────────────────────────────────
const TITLE = (n: number) => `Game ${n}: scoring dispute`;
const DESCRIPTION =
  'This game was not recorded because it was submitted with the conflicting details listed below. Please rescore the game with the correct information.';

export interface DisputeDetailModalProps {
  /** The dispute to show, or null when closed. */
  dispute: GameDispute | null;
  /** Controlled open-change handler (Radix Dialog pattern). */
  onOpenChange: (open: boolean) => void;
  /** Resolve a member id → display name (player nickname or "Unknown"). */
  getPlayerDisplayName: (id: string | null) => string;
}

/**
 * Render one initiator's full entry in a readable card. Highlights the
 * fields a viewer would compare: winner, extras (only the truthy ones —
 * defaults don't need to be shown), and per-game points (when present).
 */
function InitiationCard({
  init,
  getPlayerDisplayName,
}: {
  init: DisputeInitiation;
  getPlayerDisplayName: (id: string | null) => string;
}) {
  const name = getPlayerDisplayName(init.confirmer_id);
  const sideLabel = init.side === 'home' ? 'Home' : 'Away';
  return (
    <div className="rounded-md border p-3 text-sm">
      <div className="font-medium">
        {name} <span className="text-muted-foreground">({sideLabel})</span>
      </div>
      <dl className="mt-2 space-y-1">
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Winner:</dt>
          <dd>{getPlayerDisplayName(init.snapshot.winner_player_id)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Achievements:</dt>
          <dd>{formatExtras(init.snapshot) || <em className="text-muted-foreground">none</em>}</dd>
        </div>
        {(init.snapshot.winner_value != null || init.snapshot.loser_value != null) && (
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Points:</dt>
            <dd>
              W: {init.snapshot.winner_value ?? '—'}
              {'  '}L: {init.snapshot.loser_value ?? '—'}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

/**
 * Build a comma-separated list of the truthy boolean extras. Empty string
 * when none — the consumer renders an italic placeholder for that case.
 */
function formatExtras(r: ResultLike): string {
  const parts: string[] = [];
  if (r.break_and_run) parts.push('Break & Run');
  if (r.golden_break) parts.push('Golden Break');
  if (r.break_fouled) parts.push('Break Fouled');
  if (r.runout) parts.push('Runout');
  if (r.win_by_forfeit) parts.push('Forfeit');
  return parts.join(', ');
}

export function DisputeDetailModal({
  dispute,
  onOpenChange,
  getPlayerDisplayName,
}: DisputeDetailModalProps) {
  const open = dispute !== null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {dispute && (
          <>
            <DialogHeader>
              <DialogTitle>{TITLE(dispute.game_number)}</DialogTitle>
              <DialogDescription>{DESCRIPTION}</DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              {dispute.initiations.map((init, i) => (
                <InitiationCard
                  key={`${init.confirmer_id}-${i}`}
                  init={init}
                  getPlayerDisplayName={getPlayerDisplayName}
                />
              ))}
            </div>
            {/* Close is handled by the shadcn Dialog's built-in X icon, ESC,
                and outside-click — no redundant footer button. */}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
