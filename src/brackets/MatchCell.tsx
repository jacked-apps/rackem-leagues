/**
 * @fileoverview One match cell in the bracket tree (Unit 5).
 *
 * Renders the two slots (home/away) of a match with a thick, color-coded outer
 * border that reads the state at a glance:
 *   - pending  → dashed grey   (waiting on players; a feeder isn't done)
 *   - on deck  → amber         (ready, not yet started)
 *   - playing  → blue accent   (organizer marked it being played now)
 *   - complete → green         (finished)
 * The winner is bold, the loser dimmed. In organizer mode a ready match's slots
 * are tappable to record the winner, a footer toggles playing/on-deck, and a
 * decided match shows "Reset" to undo a mis-tap.
 */

import { Play, RotateCcw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { MatchView, SlotView } from './bracketViewModel';
import { isSlotPickable } from './bracketViewModel';
import { MATCH_STATE_STYLE, matchStateKey } from './matchStateStyles';
import type { MatchSlot } from '@/types/bracket';

interface MatchCellProps {
  match: MatchView;
  readOnly: boolean;
  /** Called with the picked participant id when a slot is tapped. */
  onPick?: (matchId: string, participantId: string) => void;
  /** Toggle a ready match's "playing now" flag. */
  onToggleInProgress?: (matchId: string, inProgress: boolean) => void;
  /** Undo a decided match (organizer mode). */
  onReopen?: (matchId: string) => void;
}

export function MatchCell({
  match,
  readOnly,
  onPick,
  onToggleInProgress,
  onReopen,
}: MatchCellProps) {
  const isReady = match.status === 'ready';
  const isComplete = match.status === 'complete';

  return (
    <Card
      className={cn(
        'w-44 shrink-0 divide-y gap-0 p-0 text-sm',
        MATCH_STATE_STYLE[matchStateKey(match)]
      )}
    >
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

      {!readOnly && isReady && onToggleInProgress && (
        <FooterButton
          onClick={() => onToggleInProgress(match.id, !match.inProgress)}
          className={match.inProgress ? 'text-primary' : ''}
        >
          <Play className="h-3 w-3" />
          {match.inProgress ? 'Playing' : 'Start'}
        </FooterButton>
      )}

      {!readOnly && isComplete && onReopen && (
        <FooterButton onClick={() => onReopen(match.id)}>
          <RotateCcw className="h-3 w-3" />
          Reset
        </FooterButton>
      )}
    </Card>
  );

  function pick(which: MatchSlot) {
    const s = which === 'home' ? match.home : match.away;
    if (s.participantId && onPick) onPick(match.id, s.participantId);
  }
}

/** Small ghost action row at the bottom of a cell. */
function FooterButton({
  onClick,
  className,
  children,
}: {
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-center gap-1 px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground',
        className
      )}
    >
      {children}
    </button>
  );
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
