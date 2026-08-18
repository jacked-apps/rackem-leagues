/**
 * @fileoverview DuesRosterList — renders the per-player rows of the league
 * dues roster. Each row is a PlayerNameLink (so an operator can mark dues paid
 * straight from the list via its popover) plus a dues-status pill.
 *
 * Status is conveyed by ICON + TEXT, never color alone, so it's readable
 * without relying on the green/amber/grey tint (accessibility). Colors use
 * semantic theme tokens so they hold up in dark mode.
 */

import { CheckCircle2, AlertTriangle, MinusCircle } from 'lucide-react';
import { PlayerNameLink } from '@/components/PlayerNameLink';
import { getDuesYearStatus, type DuesYearStatusKind } from '@/utils/membershipUtils';
import type { DuesRosterPlayer } from '@/api/queries/duesRoster';

/** Icon + text-color token for each dues bucket. */
const STATUS_STYLE: Record<
  DuesYearStatusKind,
  { readonly icon: typeof CheckCircle2; readonly className: string }
> = {
  paid: { icon: CheckCircle2, className: 'text-success' },
  expired: { icon: AlertTriangle, className: 'text-warning' },
  never: { icon: MinusCircle, className: 'text-muted-foreground' },
};

interface DuesRosterListProps {
  readonly players: readonly DuesRosterPlayer[];
}

/** Rows of players with a dues-status pill on the right. */
export function DuesRosterList({ players }: DuesRosterListProps) {
  return (
    <ul className="divide-y divide-border">
      {players.map((player) => {
        const status = getDuesYearStatus(player.membership_paid_date);
        const { icon: Icon, className } = STATUS_STYLE[status.kind];
        return (
          <li key={player.id} className="flex items-center justify-between gap-3 py-2.5">
            <PlayerNameLink
              playerId={player.id}
              playerName={`${player.first_name} ${player.last_name}`}
            />
            <span className={`inline-flex shrink-0 items-center gap-1.5 text-sm font-medium ${className}`}>
              <Icon className="h-4 w-4" aria-hidden="true" />
              {status.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
