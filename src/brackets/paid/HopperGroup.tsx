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
 * COLOUR IS NEVER THE ONLY DIFFERENCE. Ed is colour blind, and teal and blue are
 * adjacent hues that several kinds of colour blindness cannot separate at all —
 * an earlier version distinguished the rooms by hue alone and was, to him, three
 * identical grey boxes. The free tier's match states already solved this with
 * dashed/dotted/solid/filled rather than colour; this follows the same rule.
 *
 * So each room differs on THREE independent channels:
 *   - border weight and style: 2px solid, 1px solid, dashed
 *   - tint STRENGTH: a lightness ramp that survives being seen in greyscale
 *   - hue, last — a bonus for those who see it, never the carrier
 *
 * The hues themselves are identity, not judgement: `primary` for the tournament
 * (the brand accent, "this is the main thing") and `info` for waiting.
 * Green-for-in and amber-for-waiting were rejected because they read as
 * good-versus-bad, and waiting is simply where everyone starts.
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
  // Strongest on every channel: 2px border, deepest tint. The room that decides
  // the bracket.
  in: {
    box: 'border-2 border-primary/50 bg-primary/[0.07]',
    header: 'bg-primary/25 text-primary',
  },
  // Middle of the ramp: 1px border, lighter tint.
  waiting: {
    box: 'border-info/40 bg-info/[0.04]',
    header: 'bg-info/15 text-info',
  },
  // Faintest, and DASHED — the one cue that reads at any vision. A shelf to
  // draw from, not part of this tournament.
  aside: {
    box: 'border-dashed border-border bg-muted/20',
    header: 'bg-muted/60 text-muted-foreground',
  },
};

interface HopperGroupProps {
  title: string;
  count: number;
  /** What the organizer sees when the room is empty — say what fills it. */
  empty: string;
  tone: RoomTone;
  /** A setting belonging to THIS room, shown above its players. */
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function HopperGroup({
  title,
  count,
  empty,
  tone,
  action,
  children,
}: HopperGroupProps) {
  const style = ROOM[tone];

  return (
    <section className={cn('overflow-hidden rounded-lg border', style.box)}>
      {/* The room's name reads at least as loudly as the players inside it —
          a header smaller than its own contents looks like a caption. */}
      <header
        className={cn(
          'flex items-center justify-between gap-2 border-b px-3 py-2',
          style.header
        )}
      >
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-sm font-semibold tabular-nums">{count}</span>
      </header>

      {/* Settings for this room sit with it, not adrift below the lists. */}
      {action && <div className="border-b bg-background/40 px-3 py-2">{action}</div>}

      {count === 0 ? (
        // Enough height to read as an empty room rather than a stray line —
        // roughly two players' worth.
        <p className="flex min-h-[4.5rem] items-center px-3 py-3 text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className="divide-y">{children}</ul>
      )}
    </section>
  );
}
