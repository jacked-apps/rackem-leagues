/**
 * @fileoverview One "room" on the hopper screen (Phase C, Unit C3).
 *
 * Each group is a distinct enclosed box rather than a heading over a list. They
 * used to be three headed sections stacked together, which read as ONE long
 * list — misleading, because being in the tournament and being in the waiting
 * room are entirely different states, and the rows look identical.
 *
 * So each is drawn as a room you can be in: its own border, its own ground, and
 * a header bar carrying the name and the count.
 *
 * The tints are NEUTRAL layers rather than status colours. Green-for-in /
 * amber-for-waiting would read as good-versus-bad, when waiting is simply where
 * everyone starts. Weight carries the meaning instead: the tournament has the
 * heavy border, the waiting room is tinted and recessed, and past players — not
 * part of this tournament at all — is dashed, reading as a shelf not a room.
 *
 * PROMINENCE COMES FROM THE BORDER, NOT THE BACKGROUND, because these rooms sit
 * INSIDE a card and `--card` is identical to `--background` in the light theme.
 * A "raised" room would have been invisible in light mode and only looked right
 * in dark. Every tint below is `muted`-based, which differs from the card ground
 * in both themes.
 */

import { cn } from '@/lib/utils';

/** How prominent a room is, which follows from how committed its players are. */
export type RoomTone = 'in' | 'waiting' | 'aside';

const ROOM: Record<RoomTone, { box: string; header: string }> = {
  // The destination. Heaviest border and the strongest header — this is the
  // room that decides the bracket.
  in: { box: 'border-2 border-foreground/25', header: 'bg-muted' },
  // Tinted and recessed: players are here, but not in the tournament yet.
  waiting: { box: 'border-border bg-muted/40', header: 'bg-muted/70' },
  // Dashed: a shelf to draw from, not part of this tournament.
  aside: { box: 'border-dashed border-border', header: 'bg-muted/30' },
};

interface HopperGroupProps {
  title: string;
  count: number;
  /** What the organizer sees when the room is empty — say what fills it. */
  empty: string;
  tone: RoomTone;
  children: React.ReactNode;
}

export function HopperGroup({ title, count, empty, tone, children }: HopperGroupProps) {
  const style = ROOM[tone];

  return (
    <section className={cn('overflow-hidden rounded-lg border', style.box)}>
      <header
        className={cn(
          'flex items-baseline justify-between gap-2 border-b px-3 py-1.5',
          style.header
        )}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wide">{title}</h3>
        <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
      </header>

      {count === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y">{children}</ul>
      )}
    </section>
  );
}
