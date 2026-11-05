/**
 * @fileoverview The invite: a QR to hold up across the table, and the same
 * link to copy for someone across the bar. Opens from the seat counter (R12).
 *
 * The QR encodes `/rooms/join/<token>` — a member route. A scanner who is not
 * signed in is walked through login/register and dropped back on the join
 * page by `ProtectedRoute`; that IS the funnel, and it is why the copy says
 * "sign in" rather than "type a name."
 *
 * The QR is black-on-white regardless of theme: a themed code in dark mode
 * is a dark square on a dark sheet and does not scan.
 *
 * With no open seats the sheet still opens, but the QR gives way to the
 * explanation. Seats are the HOST'S, across every room they own (the house
 * model) — so the full-house copy says where the seats went and how one comes
 * back. Showing a code nobody can use would just produce a "full" screen on
 * the other phone.
 */
import { QRCodeSVG } from 'qrcode.react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { CopyLinkButton } from '@/rules/CopyLinkButton';
import type { RoomSeats } from '@/api/queries/rooms';
import { roomJoinUrl } from './roomJoinUrl';
import { emptySeatsLabel } from './seatCopy';

interface InviteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  joinToken: string;
  seats: RoomSeats;
}

export function InviteSheet({ open, onOpenChange, joinToken, seats }: InviteSheetProps) {
  const url = roomJoinUrl(joinToken);
  const full = seats.open <= 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{full ? 'No seats open' : 'Invite to this room'}</SheetTitle>
          <SheetDescription>
            {full
              ? `All ${seats.seats} of the host's seats are taken, across every room they have open — their own screens included. A seat comes back when a screen closes.`
              : `${emptySeatsLabel(seats.open)}. Scan the code or send the link — they sign in and they're in.`}
          </SheetDescription>
        </SheetHeader>

        {!full && (
          <div className="mt-4 flex flex-col items-center gap-4">
            <div className="rounded-lg bg-white p-3">
              <QRCodeSVG
                value={url}
                size={224}
                level="M"
                fgColor="#000000"
                bgColor="#ffffff"
                className="h-auto w-56"
              />
            </div>
            <p className="break-all text-center font-mono text-xs text-muted-foreground">{url}</p>
            <CopyLinkButton url={url} ariaLabel="Copy the join link" />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
