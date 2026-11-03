/**
 * @fileoverview The list of games in a race — what happened, and what is
 * waiting on whom.
 *
 * Showing two names nine times over would be noise, so each row leads with the
 * game number and who broke it, and names only the winner. The rows carry the
 * whole state of the race, which is why they are also the only recovery path:
 * to fix a game you reverse back to it, one game at a time.
 *
 * The Reverse button appears on exactly one row — the last game with a result.
 * That is the linear rule made visible: a race is two people at one table, so
 * games happen in order and are undone in order. The server enforces the same
 * rule, so a stale screen cannot talk it into anything.
 *
 * Status is carried by words and an icon, never by colour alone.
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Check, Clock, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isSettled, winnerSideOf, type Race, type RaceGame, type RaceSeat } from './types';

interface RaceGamesListProps {
  race: Race;
  games: RaceGame[];
  home: RaceSeat;
  away: RaceSeat;
  /** The game a result may be entered on. */
  activeGameNumber: number | null;
  /** The only game that may be reversed. */
  vacatableGameNumber: number | null;
  /** Null for a spectator, who gets no buttons at all. */
  isPlayer: boolean;
  onScore: (gameNumber: number, winnerSeat: RaceSeat, winnerWasBreaker: boolean) => void;
  onVacate: (gameNumber: number) => void;
  busy?: boolean;
}

export function RaceGamesList({
  race,
  games,
  home,
  away,
  activeGameNumber,
  vacatableGameNumber,
  isPlayer,
  onScore,
  onVacate,
  busy,
}: RaceGamesListProps) {
  if (games.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No games yet — the race starts once someone breaks.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {games.map((game) => {
        const breakerSide = game.home_action === 'breaks' ? 'home' : 'away';
        const breaker = breakerSide === 'home' ? home : away;
        const winnerSide = winnerSideOf(game, race);
        const winner = winnerSide === 'home' ? home : winnerSide === 'away' ? away : null;
        const settled = isSettled(game);
        const isActive = game.game_number === activeGameNumber;
        const canReverse = isPlayer && game.game_number === vacatableGameNumber;

        return (
          <Card key={game.id} className={cn(isActive && 'border-foreground')}>
            <CardContent className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium tabular-nums">
                    Game {game.game_number}
                  </span>
                  {settled ? (
                    <Check className="h-4 w-4 shrink-0" aria-hidden />
                  ) : winner ? (
                    <Clock className="h-4 w-4 shrink-0" aria-hidden />
                  ) : null}
                </div>
                <div className="truncate text-sm text-muted-foreground">
                  {winner ? (
                    <>
                      <span className="font-medium text-foreground">{winner.displayName}</span>
                      {settled ? ' won' : ' won — waiting to be agreed'}
                    </>
                  ) : (
                    `${breaker.displayName} breaks`
                  )}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                {canReverse ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => onVacate(game.game_number)}
                  >
                    <Undo2 className="mr-1 h-4 w-4" aria-hidden />
                    Reverse
                  </Button>
                ) : null}
                {isPlayer && isActive && !winner
                  ? [home, away].map((seat) => (
                      <Button
                        key={seat.side}
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          onScore(game.game_number, seat, seat.side === breakerSide)
                        }
                      >
                        {seat.displayName} won
                      </Button>
                    ))
                  : null}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
