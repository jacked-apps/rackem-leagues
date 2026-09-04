/**
 * @fileoverview One match cell in the bracket tree (Unit 5).
 *
 * Renders the two slots (home/away) of a match. A filled slot shows its name;
 * an empty slot shows "—" (TBD, waiting on a feeder). The winner is bolded. In
 * organizer mode a ready match's slots are tappable to record the winner.
 */

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { MatchView, SlotView } from './bracketViewModel';
import { isSlotPickable } from './bracketViewModel';
import type { MatchSlot } from '@/types/bracket';

interface MatchCellProps {
  match: MatchView;
  readOnly: boolean;
  /** Called with the picked participant id when a slot is tapped. */
  onPick?: (matchId: string, participantId: string) => void;
}

export function MatchCell({ match, readOnly, onPick }: MatchCellProps) {
  return (
    <Card className="w-44 shrink-0 divide-y p-0 text-sm">
      <SlotRow
        slot={match.home}
        pickable={!readOnly && isSlotPickable(match, 'home')}
        onPick={() => pick('home')}
      />
      <SlotRow
        slot={match.away}
        pickable={!readOnly && isSlotPickable(match, 'away')}
        onPick={() => pick('away')}
      />
    </Card>
  );

  function pick(which: MatchSlot) {
    const s = which === 'home' ? match.home : match.away;
    if (s.participantId && onPick) onPick(match.id, s.participantId);
  }
}

function SlotRow({
  slot,
  pickable,
  onPick,
}: {
  slot: SlotView;
  pickable: boolean;
  onPick: () => void;
}) {
  const label = slot.name ?? '—';
  const base = 'flex items-center px-3 py-2';

  if (pickable) {
    return (
      <button
        type="button"
        onClick={onPick}
        className={cn(base, 'w-full text-left hover:bg-accent')}
      >
        <span className="truncate">{label}</span>
      </button>
    );
  }

  return (
    <div className={cn(base, slot.isWinner && 'font-semibold')}>
      <span className={cn('truncate', slot.name === null && 'text-muted-foreground')}>
        {label}
      </span>
    </div>
  );
}
