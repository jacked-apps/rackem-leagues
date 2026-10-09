/**
 * @fileoverview Who's here — one line per SCREEN in the room.
 *
 * A member on a phone and a tablet is two lines with the same name; that is
 * honest, because each screen holds a seat. "Present" comes from the server
 * (`is_present`, computed against its own clock) so this list and the seat
 * count never disagree. Away screens stay listed until the host drops them
 * or the room dies — they have given their seat back but they are still
 * someone the host may want to see.
 *
 * Every state is a word: "host", "you", "away". Nothing is colour-only.
 *
 * Rendered inside `PlayersChip`'s panel, which is the only place it appears —
 * the room page itself shows just the chip.
 */
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RoomPhone } from '@/api/queries/rooms';

interface PhoneListProps {
  phones: RoomPhone[];
  /** This device's phone id, so the list can say "you". */
  myPhoneId?: string;
  /**
   * Host only: drop this screen from the room. Omitted for guests, and never
   * offered for the viewer's own row (leaving is navigating away, not a
   * removal — the server refuses it too).
   */
  onRemove?: (phone: RoomPhone) => void;
}

export function PhoneList({ phones, myPhoneId, onRemove }: PhoneListProps) {
  if (phones.length === 0) {
    return <p className="px-1 py-1 text-sm text-muted-foreground">Nobody here yet.</p>;
  }

  return (
    <ul className="divide-y text-sm">
      {phones.map((p) => {
        const tags = [
          p.id === myPhoneId && 'you',
          p.is_host && 'host',
          !p.is_present && 'away',
        ].filter(Boolean) as string[];

        return (
          <li key={p.id} className="flex items-center justify-between gap-2 py-1">
            <span className={p.is_present ? 'truncate' : 'truncate text-muted-foreground'}>
              {p.display_name}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {tags.length > 0 && (
                <span className="text-xs text-muted-foreground">{tags.join(' · ')}</span>
              )}
              {onRemove && p.id !== myPhoneId && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  aria-label={`Remove ${p.display_name} from the room`}
                  onClick={() => onRemove(p)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
