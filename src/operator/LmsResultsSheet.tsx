/**
 * @fileoverview Printable "results sheet" for a completed match — the first step
 * of getting our results into CSI's FargoRate LMS.
 *
 * LMS has no bulk paste / import / API (confirmed 2026-06), so an operator must
 * hand-enter results into its per-match scoresheet. This page lays our match out
 * cleanly — every game as home player vs away player → winner — so the operator
 * reads top-to-bottom and types it in. A "Print" button (browser print) plus
 * `print:hidden` chrome makes it come out tidy on paper.
 *
 * MVP: games listed in order with full names + winner. The exact LMS round /
 * handicap-column mirroring comes after the first LO (Ben) says what's easiest.
 *
 * @see LIST_FOR_ED.md / docs — CSI LMS results-entry project
 */

import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useMatchWithLeagueSettings, useMatchGames, useTeamDetails } from '@/api/hooks';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Printer, Trophy } from 'lucide-react';

/** A match_games row, narrowed to what the sheet reads. */
interface SheetGame {
  id: string;
  game_number: number;
  home_player_id: string | null;
  away_player_id: string | null;
  winner_player_id: string | null;
  winner_value: number | null;
  loser_value: number | null;
  is_tiebreaker: boolean | null;
}

/** Build an id → "First Last" map from both teams' rosters (LMS wants full names). */
function useFullNameMap(homeData: unknown, awayData: unknown): Map<string, string> {
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const data of [homeData, awayData]) {
      const players = (data as { team_players?: Array<{ members?: { id: string; first_name: string; last_name: string } | null }> } | undefined)?.team_players;
      players?.forEach((tp) => {
        const m = tp.members;
        if (m) map.set(m.id, `${m.first_name} ${m.last_name}`.trim());
      });
    }
    return map;
  }, [homeData, awayData]);
}

export default function LmsResultsSheet() {
  const { matchId } = useParams<{ matchId: string }>();
  const matchQuery = useMatchWithLeagueSettings(matchId);
  const gamesQuery = useMatchGames(matchId);

  const match = matchQuery.data as unknown as {
    home_team_id: string;
    away_team_id: string;
    home_team?: { team_name?: string } | null;
    away_team?: { team_name?: string } | null;
    home_games_won?: number | null;
    away_games_won?: number | null;
    scheduled_date?: string | null;
  } | undefined;

  const homeTeam = useTeamDetails(match?.home_team_id ?? '');
  const awayTeam = useTeamDetails(match?.away_team_id ?? '');
  const nameOf = useFullNameMap(homeTeam.data, awayTeam.data);
  const name = (id: string | null) => (id ? nameOf.get(id) ?? '—' : '—');

  const games = useMemo(() => {
    const rows = (gamesQuery.data as unknown as SheetGame[]) ?? [];
    return rows.filter((g) => !g.is_tiebreaker).sort((a, b) => a.game_number - b.game_number);
  }, [gamesQuery.data]);

  const homeName = match?.home_team?.team_name ?? 'Home';
  const awayName = match?.away_team?.team_name ?? 'Away';

  const header = (
    <div className="print:hidden">
      <PageHeader title="LMS Results Sheet" subtitle="Print, then enter into CSI / FargoRate LMS" />
    </div>
  );

  if (matchQuery.isLoading || gamesQuery.isLoading) {
    return <div>{header}<p className="p-4 text-muted-foreground">Loading…</p></div>;
  }
  if (!match) {
    return <div>{header}<p className="p-4 text-muted-foreground">Match not found.</p></div>;
  }

  return (
    <div>
      {header}

      {/* Print action — hidden on the printed page. */}
      <div className="flex justify-end p-4 print:hidden">
        <Button onClick={() => window.print()} loadingText="none">
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </div>

      {/* The sheet itself — what prints. */}
      <div className="mx-auto max-w-2xl p-6">
        <div className="mb-4 border-b pb-3">
          <h1 className="text-xl font-bold">
            {homeName} <span className="font-normal text-muted-foreground">vs</span> {awayName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Final (games won): {match.home_games_won ?? 0} – {match.away_games_won ?? 0}
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Home — {homeName}</TableHead>
              <TableHead>Away — {awayName}</TableHead>
              <TableHead>Winner</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {games.map((g) => {
              const homeWon = !!g.winner_player_id && g.winner_player_id === g.home_player_id;
              const winnerName = g.winner_player_id ? name(g.winner_player_id) : '—';
              return (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">{g.game_number}</TableCell>
                  <TableCell className={homeWon ? 'font-semibold' : undefined}>
                    {name(g.home_player_id)}
                  </TableCell>
                  <TableCell className={g.winner_player_id && !homeWon ? 'font-semibold' : undefined}>
                    {name(g.away_player_id)}
                  </TableCell>
                  <TableCell className="font-semibold">
                    <span className="inline-flex items-center gap-1">
                      <Trophy className="h-3.5 w-3.5 text-amber-500 print:hidden" />
                      {winnerName}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
