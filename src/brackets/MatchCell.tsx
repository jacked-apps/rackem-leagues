/**
 * @fileoverview One match cell in the bracket tree (Unit 5).
 *
 * Renders the two slots (home/away) of a match. A filled slot shows its name;
 * an empty slot shows "—" (TBD, waiting on a feeder). In organizer mode a ready
 * match's slots are tappable to record the winner. A decided match reads as
 * done — the winner is bold, the loser is dimmed — and (organizer mode) shows a
 * small "Reopen" control to undo a mis-tap.
 */

import { RotateCcw } from 'lucide-react';
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
  /** Called to undo a decided match (organizer mode). */
  onReopen?: (matchId: string) => void;
}

export function MatchCell({ match, readOnly, onPick, onReopen }: MatchCellProps) {
  const isComplete = match.status === 'complete';

  return (
    <Card className="w-44 shrink-0 divide-y gap-0 p-0 text-sm">
      <SlotRow
        slot={match.home}
        pickable={!readOnly && isSlotPickable(match, 'home')}
        dimmed={isComplete && !match.home.isWinner}
        onPick={() => pick('home')}
      />
      <SlotRow
        slot={match.away}
        pickable={!readOnly && isSlotPickable(match, 'away')}
        dimmed={isComplete && !match.away.isWinner}
        onPick={() => pick('away')}
      />
      {!readOnly && isComplete && onReopen && (
        <button
          type="button"
          onClick={() => onReopen(match.id)}
          className="flex w-full items-center justify-center gap-1 px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" />
          Reopen
        </button>
      )}
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
  dimmed,
  onPick,
}: {
  slot: SlotView;
  pickable: boolean;
  dimmed: boolean;
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
      <span
        className={cn(
          'truncate',
          (slot.name === null || dimmed) && 'text-muted-foreground'
        )}
      >
        {label}
      </span>
    </div>
  );
}
