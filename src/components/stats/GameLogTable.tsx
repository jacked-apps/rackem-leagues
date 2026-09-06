/**
 * @fileoverview Every rack the player has played, newest first.
 *
 * Prop-driven: it renders the rows it is handed, so a filter narrows this list
 * and the summary above it from the same source.
 *
 * Result is shown as the WORD "Won" or "Lost", never as a colour alone —
 * colour-blind readers must be able to read the column, and a green/red dot
 * would carry the entire meaning otherwise.
 *
 * @see src/stats/playerGameRow.ts
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { parseLocalDate } from '@/utils/formatters';
import { endingLabel } from '@/stats/endingLabels';
import type { PlayerGameRow } from '@/stats/playerGameRow';

interface GameLogTableProps {
  rows: PlayerGameRow[];
}

/**
 * "May 1, 2026" from an ISO date.
 *
 * Parsed as a LOCAL date. `new Date('2026-05-01')` is parsed as UTC and renders
 * as April 30 for anyone west of Greenwich — an off-by-one-day on every row.
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
 * The opponent's handicap and which system it is measured in.
 *
 * The system is shown because the number alone is ambiguous: a "2" is a strong
 * player under one system and meaningless under another. Never inferred from
 * the number's size — an unknown system says so.
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Every game{rows.length > 0 ? ` (${rows.length})` : ''}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No games to show.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="whitespace-nowrap py-2 pr-4 font-medium">Date</th>
                  <th className="whitespace-nowrap py-2 pr-4 font-medium">Opponent</th>
                  <th className="whitespace-nowrap py-2 pr-4 font-medium">Handicap</th>
                  <th className="whitespace-nowrap py-2 pr-4 font-medium">Result</th>
                  <th className="whitespace-nowrap py-2 pr-4 font-medium">Ending</th>
                  <th className="whitespace-nowrap py-2 font-medium">Where</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.gameId} className="border-b last:border-0">
                    <td className="whitespace-nowrap py-2 pr-4 text-muted-foreground">
                      {formatPlayedOn(row.playedOn)}
                    </td>
                    <td className="py-2 pr-4 text-foreground">{row.opponentName}</td>
                    <td className="whitespace-nowrap py-2 pr-4 text-muted-foreground">
                      {formatHandicap(row)}
                    </td>
                    {/* The word carries the meaning, not a colour. */}
                    <td className="whitespace-nowrap py-2 pr-4 font-medium text-foreground">
                      {row.won ? 'Won' : 'Lost'}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4 text-muted-foreground">
                      {endingLabel(row.ending)}
                    </td>
                    <td className="py-2 text-muted-foreground">{formatWhere(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
