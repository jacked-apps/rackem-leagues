/**
 * @fileoverview "Players 1 of 2" — the room's one line about who is here,
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
 * The panel does not repeat the chip's number — it shows the OTHER one. The
 * chip is this room ("Players 1 of 2", its game's occupancy); the panel is
 * the host's house, the billing limit that spans every room they own. Two
 * capacities, two questions, one each.
 *
 * The label counts everyone in THIS room, host included — the host is a
 * person in the room and their screen holds a place like anybody's.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { RoomPhone, RoomSeats } from '@/api/queries/rooms';
import { PhoneList } from './PhoneList';
import { elsewhereNote, emptySeatsLabel, playersChipLabel } from './seatCopy';

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
  const elsewhere = shared ? elsewhereNote(seats, isHost) : null;

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

        <div className="mt-1 border-t pt-2">
          {shared ? (
            <>
              {/* The chip says what THIS room holds; the house figure — the
                  host's billing limit, spanning every room they own — belongs
                  here, where someone about to invite can act on it. */}
              <p className="px-1 pb-2 text-xs text-muted-foreground">
                {emptySeatsLabel(seats.open)} in {isHost ? 'your' : "the host's"} house.
                {elsewhere ? ` ${elsewhere}` : ''}
              </p>
              <Button variant="outline" size="sm" className="w-full" onClick={act(onInvite)}>
                Invite someone
              </Button>
            </>
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
