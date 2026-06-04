/**
 * @fileoverview Review/correct surface for an already-scored match (LO v2).
 *
 * View-first read of a finished match: for each regular game it shows the
 * matchup, the recorded winner, any achievements (only when present), and the
 * per-game confirmer line (official confirmers + "+N others" peek). This is the
 * "look before you override" tool for dispute adjudication.
 *
 * Unit 6 ships the read view. The per-game Vacate/undo/re-score correction flow +
 * the reopen → re-finalize lifecycle land in Unit 7 (this component is the host
 * those affordances mount into).
 *
 * @see docs/plans/2026-06-04-001-feat-lo-match-review-correction-plan.md — Unit 6
 */

import { useMemo } from 'react';
import { useMatchGames, useTeamDetails } from '@/api/hooks';
import { useGameConfirmations } from '@/api/hooks/useGameConfirmations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buildConfirmerAudit } from '@/utils/match/confirmerAudit';
import { regularGames } from './entryHelpers';
import {
  achievementChips,
  buildNameTeamMap,
  confirmationsForGame,
  type ConfirmationRow,
  type ReviewGame,
} from './reviewHelpers';
import { ConfirmerLine } from './ConfirmerLine';

export interface ReviewPhaseProps {
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  /** The operator viewing — excluded from every game's "+N others". */
  loMemberId: string;
}

export function ReviewPhase(props: ReviewPhaseProps) {
  const { matchId, homeTeamId, awayTeamId, homeTeamName, awayTeamName, loMemberId } = props;

  const gamesQuery = useMatchGames(matchId);
  const confirmationsQuery = useGameConfirmations(matchId);
  const homeTeam = useTeamDetails(homeTeamId);
  const awayTeam = useTeamDetails(awayTeamId);

  const nameTeamMap = useMemo(
    () =>
      buildNameTeamMap(
        { data: homeTeam.data, teamName: homeTeamName },
        { data: awayTeam.data, teamName: awayTeamName }
      ),
    [homeTeam.data, awayTeam.data, homeTeamName, awayTeamName]
  );

  const games = useMemo(
    () => regularGames((gamesQuery.data as unknown as ReviewGame[]) ?? []) as ReviewGame[],
    [gamesQuery.data]
  );
  const confirmations = useMemo(
    () => (confirmationsQuery.data as unknown as ConfirmationRow[]) ?? [],
    [confirmationsQuery.data]
  );

  const nameOf = (id: string | null) => (id ? nameTeamMap.get(id)?.name ?? 'Player' : 'Player');

  if (gamesQuery.isLoading) {
    return <p className="p-4 text-muted-foreground">Loading match…</p>;
  }

  return (
    <div className="space-y-3 p-4">
      {games.map((game) => {
        const audit = buildConfirmerAudit(
          game,
          confirmationsForGame(confirmations, game.id),
          nameTeamMap,
          loMemberId
        );
        const chips = achievementChips(game);
        const winnerName = game.winner_player_id ? nameOf(game.winner_player_id) : null;

        return (
          <Card key={game.id}>
            <CardHeader className="py-2">
              <CardTitle className="flex items-center gap-2 text-sm font-normal">
                <Badge variant="secondary">Game {game.game_number}</Badge>
                <span>
                  {nameOf(game.home_player_id)} vs {nameOf(game.away_player_id)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-3">
              <div className="font-semibold">
                {winnerName ? `🏆 ${winnerName}` : 'No result recorded'}
              </div>

              {chips.length > 0 && (
                <div className="flex flex-wrap gap-1" data-testid="achievements">
                  {chips.map((c) => (
                    <Badge key={c} variant="outline">
                      {c}
                    </Badge>
                  ))}
                </div>
              )}

              <ConfirmerLine
                audit={audit}
                homeTeamName={homeTeamName}
                awayTeamName={awayTeamName}
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
