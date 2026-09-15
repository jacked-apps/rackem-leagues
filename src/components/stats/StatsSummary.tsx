/**
 * @fileoverview The numbers at the top of My Stats.
 *
 * Prop-driven and dumb: it renders the summary it is given. When a filter is
 * applied the caller passes a summary of the filtered games, so "my record on
 * table 2" genuinely recounts rather than just hiding rows below.
 *
 * @see src/stats/summarizeGames.ts
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { endingLabel } from '@/stats/endingLabels';
import type { GameSummary } from '@/stats/summarizeGames';

interface StatsSummaryProps {
  summary: GameSummary;
}

/** One headline number with its label. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/**
 * Summary block: the record, then how those games ended.
 *
 * @param summary - Counts for the games currently in view.
 */
export function StatsSummary({ summary }: StatsSummaryProps) {
  const winRate =
    summary.winRate === null ? '—' : `${Math.round(summary.winRate * 100)}%`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Record</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Games played" value={String(summary.played)} />
          <Stat label="Won" value={String(summary.won)} />
          <Stat label="Lost" value={String(summary.lost)} />
          <Stat label="Win rate" value={winRate} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How those games ended</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.endings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing to break down yet.
            </p>
          ) : (
            // Two columns, because the same ending means opposite things
            // depending on which side of it you were. A player who loses often
            // to break &amp; runs is a different player from one who never
            // meets them, and only this split shows it.
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 font-medium">Ending</th>
                    <th className="py-2 text-right font-medium">Won with</th>
                    <th className="py-2 text-right font-medium">Lost to</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.endings.map((row) => (
                    <tr key={row.ending} className="border-b last:border-0">
                      <td className="py-2 text-foreground">
                        {endingLabel(row.ending)}
                      </td>
                      <td className="py-2 text-right text-foreground">{row.won}</td>
                      <td className="py-2 text-right text-foreground">{row.lost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Across your career</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <Stat label="Teams played on" value={String(summary.teamsPlayedOn)} />
          <Stat label="Opponents faced" value={String(summary.opponentsFaced)} />
          <Stat label="Venues played" value={String(summary.venuesPlayed)} />
        </CardContent>
      </Card>
    </div>
  );
}
