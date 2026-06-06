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
import { useParams, useNavigate } from 'react-router-dom';
import { useMatchWithLeagueSettings, useMatchGames, useTeamDetails } from '@/api/hooks';
import { useSeasonSchedule } from '@/hooks/useSeasonSchedule';
import { isMatchEligibleForReview } from '@/utils/match/manualScoringEligibility';
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
import { Printer, ChevronLeft, ChevronRight } from 'lucide-react';

/** A match_games row, narrowed to what the sheet reads. */
interface SheetGame {
  id: string;
  game_number: number;
  home_player_id: string | null;
  away_player_id: string | null;
  home_position: number | null;
  away_position: number | null;
  winner_player_id: string | null;
  winner_value: number | null;
  loser_value: number | null;
  is_tiebreaker: boolean | null;
}

/** A round of games (one per home position), as LMS lays them out. */
interface RoundGroup {
  round: number;
  games: SheetGame[];
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
  const { leagueId, matchId } = useParams<{ leagueId: string; matchId: string }>();
  const navigate = useNavigate();
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
    season_id?: string | null;
    season_week_id?: string | null;
  } | undefined;

  // Sibling matches in the same WEEK (with results) — so the LO can blow through
  // a whole night's entry: finish one → arrow to the next without leaving.
  const { schedule } = useSeasonSchedule(match?.season_id ?? undefined, leagueId);
  const weekMatches = useMemo(() => {
    const week = schedule.find((w) => w.week.id === match?.season_week_id);
    if (!week) return [];
    return week.matches
      .filter(isMatchEligibleForReview)
      .sort((a, b) => (a.match_number ?? 0) - (b.match_number ?? 0));
  }, [schedule, match?.season_week_id]);
  const currentIndex = weekMatches.findIndex((m) => m.id === matchId);
  const prevMatch = currentIndex > 0 ? weekMatches[currentIndex - 1] : null;
  const nextMatch =
    currentIndex >= 0 && currentIndex < weekMatches.length - 1
      ? weekMatches[currentIndex + 1]
      : null;
  const goTo = (id: string) => navigate(`/league/${leagueId}/match/${id}/lms-sheet`);

  const homeTeam = useTeamDetails(match?.home_team_id ?? '');
  const awayTeam = useTeamDetails(match?.away_team_id ?? '');
  const nameOf = useFullNameMap(homeTeam.data, awayTeam.data);
  const name = (id: string | null) => (id ? nameOf.get(id) ?? '—' : '—');

  // Group games into rounds the way LMS lays them out: lineupSize games per
  // round (one per home position), ordered by position. game_number is generated
  // round-by-round, so round = ceil(game_number / lineupSize).
  const rounds = useMemo<RoundGroup[]>(() => {
    const regular = ((gamesQuery.data as unknown as SheetGame[]) ?? []).filter(
      (g) => !g.is_tiebreaker
    );
    if (regular.length === 0) return [];
    const lineupSize = Math.max(1, ...regular.map((g) => g.home_position ?? 1));
    const byRound = new Map<number, SheetGame[]>();
    for (const g of regular) {
      const round = Math.ceil(g.game_number / lineupSize);
      (byRound.get(round) ?? byRound.set(round, []).get(round)!).push(g);
    }
    return [...byRound.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([round, gs]) => ({
        round,
        games: gs.sort((a, b) => (a.home_position ?? 0) - (b.home_position ?? 0)),
      }));
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

      {/* Match navigation + print — hidden on the printed page. Arrow between the
          week's matches so the LO can enter a whole night without leaving. */}
      <div className="flex items-center justify-between gap-2 p-4 print:hidden">
        <Button
          variant="outline"
          onClick={() => prevMatch && goTo(prevMatch.id)}
          disabled={!prevMatch}
          loadingText="none"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Prev
        </Button>
        <span className="text-sm text-muted-foreground">
          {currentIndex >= 0 && weekMatches.length > 0
            ? `Match ${currentIndex + 1} of ${weekMatches.length}`
            : ''}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => nextMatch && goTo(nextMatch.id)}
            disabled={!nextMatch}
            loadingText="none"
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
          <Button onClick={() => window.print()} loadingText="none">
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
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

        {rounds.map(({ round, games }) => (
          <div key={round} className="mb-5">
            <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Round {round}
            </h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{homeName}</TableHead>
                  <TableHead className="w-14 text-center">Score</TableHead>
                  <TableHead className="w-14 text-center">Score</TableHead>
                  <TableHead className="text-right">{awayName}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {games.map((g) => {
                  const homeWon =
                    !!g.winner_player_id && g.winner_player_id === g.home_player_id;
                  const decided = !!g.winner_player_id;
                  const homeScore = homeWon ? g.winner_value ?? 1 : g.loser_value ?? 0;
                  const awayScore = homeWon ? g.loser_value ?? 0 : g.winner_value ?? 1;
                  return (
                    <TableRow key={g.id}>
                      <TableCell className={homeWon ? 'font-semibold' : undefined}>
                        {name(g.home_player_id)}
                      </TableCell>
                      <TableCell className={`text-center ${homeWon ? 'font-bold' : ''}`}>
                        {decided ? homeScore : '—'}
                      </TableCell>
                      <TableCell
                        className={`text-center ${decided && !homeWon ? 'font-bold' : ''}`}
                      >
                        {decided ? awayScore : '—'}
                      </TableCell>
                      <TableCell
                        className={`text-right ${decided && !homeWon ? 'font-semibold' : ''}`}
                      >
                        {name(g.away_player_id)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ))}
      </div>
    </div>
  );
}
