/**
 * @fileoverview "3 here · 1 empty seat" — the room's seat picture, and the
 * door to inviting. Tapping it is HOW you invite (R12): the tap opens the QR +
 * link. With no seats left, the same tap still opens and explains that
 * another host joining opens more.
 *
 * On a free room (`shared=false`) there is nothing to invite anyone to yet,
 * so the copy says so; the host's tap offers to open the door, a guest's tap
 * does nothing. Every state is words — no colour carries meaning on its own.
 */
import { Button } from '@/components/ui/button';
import type { RoomSeats } from '@/api/queries/rooms';
import { seatLine } from './seatCopy';

interface SeatCounterProps {
  seats: RoomSeats;
  shared: boolean;
  isHost: boolean;
  /** Shared room: open the invite sheet (QR + link). */
  onInvite: () => void;
  /** Free room, host only: offer to open the door. */
  onOpenDoor: () => void;
}

export function SeatCounter({ seats, shared, isHost, onInvite, onOpenDoor }: SeatCounterProps) {
  const line = seatLine(seats, shared);

  // A guest on a free room has no action: plain text, not a dead button.
  if (!shared && !isHost) {
    return <p className="text-sm text-muted-foreground">{line}</p>;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={shared ? onInvite : onOpenDoor}
      aria-label={shared ? `${line} — tap to invite` : `${line} — tap to open the door`}
    >
      {line}
    </Button>
  );
}
