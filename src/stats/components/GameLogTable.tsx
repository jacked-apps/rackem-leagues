/**
 * @fileoverview Every rack the player has played, newest first.
 *
 * VIRTUALISED. Only the rows near the viewport exist in the DOM; the rest are
 * represented by empty space above and below. A player five years in will have
 * thousands of games, and a real row for every one of them makes scrolling
 * stutter and the whole page feel slow — which defeats the point of loading the
 * history up front to keep filtering instant.
 *
 * Laid out with CSS grid rather than a `<table>`: virtualisation needs rows
 * positioned absolutely, which a table's own layout will not allow. ARIA table
 * roles keep it a table to screen readers, and `aria-rowcount` reports the FULL
 * count rather than the handful currently rendered.
 *
 * Result is the WORD "Won" or "Lost", never colour alone — colour-blind readers
 * must be able to read the column.
 *
 * @see src/stats/playerGameRow.ts
 */

import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { parseLocalDate } from '@/utils/formatters';
import { endingLabel } from '@/stats/endingLabels';
import type { PlayerGameRow } from '@/stats/playerGameRow';

interface GameLogTableProps {
  rows: PlayerGameRow[];
}

/** Row height in px. Fixed so the scrollbar is accurate without measuring. */
const ROW_HEIGHT = 44;

/** How many off-screen rows to keep rendered either side, to cover fast scrolls. */
const OVERSCAN = 12;

/** Tallest the list gets before it scrolls internally. */
const MAX_LIST_HEIGHT = 600;

/** Shared column track, so header and rows line up without a table. */
const COLUMNS =
  'minmax(6.5rem,0.9fr) minmax(8rem,1.2fr) minmax(6rem,0.9fr) minmax(4.5rem,0.6fr) minmax(7rem,1fr) minmax(9rem,1.3fr)';

/**
 * "May 1, 2026" from an ISO date.
 *
 * Parsed as a LOCAL date. `new Date('2026-05-01')` is parsed as UTC and renders
 * as April 30 for anyone west of Greenwich — an off-by-one day on every row.
 */
function formatPlayedOn(iso: string | null): string {
  if (!iso) return '—';
  return parseLocalDate(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * The opponent's handicap and the system it is measured in.
 *
 * The system is shown because the number alone is ambiguous — a "2" is a strong
 * player under one system and meaningless under another. Never inferred from
 * the number's size; an unknown system says so.
 */
function formatHandicap(row: PlayerGameRow): string {
  if (row.opponentHandicap === null) return '—';
  const system = row.handicapSystem ? ` (${row.handicapSystem})` : '';
  return `${row.opponentHandicap}${system}`;
}

/** Where it was played, table included when known. */
function formatWhere(row: PlayerGameRow): string {
  const parts = [row.venueName, row.tableNumber ? `Table ${row.tableNumber}` : null];
  return parts.filter(Boolean).join(' · ') || '—';
}

/**
 * The game log.
 *
 * @param rows - Games to list, already ordered newest-first by the source.
 */
export function GameLogTable({ rows }: GameLogTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  // Short lists should not sit in a half-empty scroll box.
  const listHeight = Math.min(rows.length * ROW_HEIGHT, MAX_LIST_HEIGHT);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Every game{rows.length > 0 ? ` (${rows.length})` : ''}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No games to show.</p>
        ) : (
          <div className="overflow-x-auto">
            <div
              role="table"
              aria-label="Your games"
              aria-rowcount={rows.length}
              className="min-w-[44rem]"
            >
              <div
                role="row"
                className="grid gap-x-4 border-b pb-2 text-sm font-medium text-muted-foreground"
                style={{ gridTemplateColumns: COLUMNS }}
              >
                <span role="columnheader">Date</span>
                <span role="columnheader">Opponent</span>
                <span role="columnheader">Handicap</span>
                <span role="columnheader">Result</span>
                <span role="columnheader">Ending</span>
                <span role="columnheader">Where</span>
              </div>

              <div
                ref={scrollRef}
                className="overflow-y-auto"
                style={{ height: listHeight }}
              >
                {/* Full-height spacer: the scrollbar reflects every game, not
                    just the rendered ones. */}
                <div
                  className="relative w-full"
                  style={{ height: virtualizer.getTotalSize() }}
                >
                  {virtualizer.getVirtualItems().map((item) => {
                    const row = rows[item.index];
                    return (
                      <div
                        key={row.gameId}
                        role="row"
                        aria-rowindex={item.index + 1}
                        className="absolute left-0 grid w-full items-center gap-x-4 border-b text-sm last:border-0"
                        style={{
                          gridTemplateColumns: COLUMNS,
                          height: ROW_HEIGHT,
                          transform: `translateY(${item.start}px)`,
                        }}
                      >
                        <span role="cell" className="text-muted-foreground">
                          {formatPlayedOn(row.playedOn)}
                        </span>
                        <span role="cell" className="truncate text-foreground">
                          {row.opponentName}
                        </span>
                        <span role="cell" className="text-muted-foreground">
                          {formatHandicap(row)}
                        </span>
                        {/* The word carries the meaning, not a colour. */}
                        <span role="cell" className="font-medium text-foreground">
                          {row.won ? 'Won' : 'Lost'}
                        </span>
                        <span role="cell" className="text-muted-foreground">
                          {endingLabel(row.ending)}
                        </span>
                        <span role="cell" className="truncate text-muted-foreground">
                          {formatWhere(row)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
