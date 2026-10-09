/**
 * @fileoverview "Players 2 · 1 open" — the room's one line about who is here,
 * and the panel behind it.
 *
 * Replaces the old pair (a seat-counter button plus an always-open list),
 * which said the same thing twice and ate half a phone screen before the
 * game even started. Now: a small chip that is always visible, and a tap
 * drops the list over the page — a Popover rather than an inline expand, so
 * nothing reflows under the thumb that tapped it.
 *
 * The panel is also where the host drops someone (R12's invite lives here
 * too, so every "who is in this room" action is in one place):
 *   - every screen, with its `you / host / away` words
 *   - host only: an × per row to remove that screen
 *   - the invite action, or on a free room the host's "open the door"
 *
 * The panel does NOT repeat the seat count: it is already on the chip the
 * user just tapped (Ed, 2026-10-09 — "I don't need to see 3 seats open 2x").
 *
 * Numbers, precisely: `Players N` is THIS room's present screens — what a
 * person at the table counts. "· N open" is the HOST'S house (seats span
 * every room they own, Unit 8), so it is the number that decides whether the
 * next person can get in. Two different things, which is exactly why the
 * label is not "2/4" — with a second room open that would read as two free
 * seats when there might be one.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { RoomPhone, RoomSeats } from '@/api/queries/rooms';
import { PhoneList } from './PhoneList';
import { playersChipLabel } from './seatCopy';

interface PlayersChipProps {
  seats: RoomSeats;
  phones: RoomPhone[];
  shared: boolean;
  isHost: boolean;
  myPhoneId?: string;
  /** Shared room: open the invite sheet (QR + link). */
  onInvite: () => void;
  /** Free room, host only: offer to open the door. */
  onOpenDoor: () => void;
  /** Host only: drop a screen. Undefined for guests. */
  onRemove?: (phone: RoomPhone) => void;
}

export function PlayersChip({
  seats,
  phones,
  shared,
  isHost,
  myPhoneId,
  onInvite,
  onOpenDoor,
  onRemove,
}: PlayersChipProps) {
  const [open, setOpen] = useState(false);
  const label = playersChipLabel(seats, shared);

  /** Close the panel before the sheet/dialog it opens takes over. */
  const act = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs font-normal"
          aria-label={`${label} — tap for the list`}
        >
          {label}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-56 p-2">
        <PhoneList phones={phones} myPhoneId={myPhoneId} onRemove={isHost ? onRemove : undefined} />

        {/* The seat count is already in the chip the user just tapped — saying
            it again here was the same number twice on one screen. */}
        <div className="mt-1 border-t pt-2">
          {shared ? (
            <Button variant="outline" size="sm" className="w-full" onClick={act(onInvite)}>
              Invite someone
            </Button>
          ) : (
            <>
              <p className="px-1 text-xs text-muted-foreground">Private — one screen only.</p>
              {isHost && (
                <Button variant="outline" size="sm" className="mt-2 w-full" onClick={act(onOpenDoor)}>
                  Open to others
                </Button>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
