/**
 * @fileoverview Who's here — one line per DEVICE in the room.
 *
 * A member on a phone and a tablet is two lines with the same name; that is
 * honest, because each device holds a seat. "Present" comes from the server
 * (`is_present`, computed against its own clock) so this list and the seat
 * count never disagree. Absent devices stay listed until the sweep or the
 * host closes the room — they still hold a seat.
 *
 * Every state is a word: "host", "you", "away". Nothing is colour-only.
 */
import type { RoomPhone } from '@/api/queries/rooms';

interface PhoneListProps {
  phones: RoomPhone[];
  /** This device's phone id, so the list can say "you". */
  myPhoneId?: string;
}

export function PhoneList({ phones, myPhoneId }: PhoneListProps) {
  if (phones.length === 0) {
    return <p className="text-sm text-muted-foreground">Nobody here yet.</p>;
  }

  return (
    <ul className="divide-y rounded-md border text-sm">
      {phones.map((p) => {
        const tags = [
          p.id === myPhoneId && 'you',
          p.is_host && 'host',
          !p.is_present && 'away',
        ].filter(Boolean) as string[];

        return (
          <li key={p.id} className="flex items-center justify-between px-3 py-2">
            <span className={p.is_present ? '' : 'text-muted-foreground'}>{p.display_name}</span>
            {tags.length > 0 && (
              <span className="text-xs text-muted-foreground">{tags.join(' · ')}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
