/**
 * @fileoverview The race scoreboard: two players, what each has won, and what
 * each of them needs.
 *
 * Both targets are shown, always, even when they are the same number. In a
 * handicapped race they differ — one player is racing to 7 while the other
 * races to 4 — and a scoreboard that showed a single target would be quietly
 * wrong for one of them. Showing both makes the equal case obvious and the
 * unequal case correct, at the cost of one extra word.
 *
 * Nothing here signals by colour alone: the leader is marked with weight and a
 * word, so it reads the same to someone who cannot separate the hues.
 */

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { RaceSeat, RaceSide } from './types';

interface RaceScoreboardProps {
  home: RaceSeat;
  away: RaceSeat;
  homeWon: number;
  awayWon: number;
  /** The viewer's side, so their own row can be marked. Null for a spectator. */
  mySide: RaceSide | null;
  /** Set once someone has reached their target. */
  winnerSide: RaceSide | null;
}

function SeatRow({
  seat,
  won,
  isMe,
  hasWon,
}: {
  seat: RaceSeat;
  won: number;
  isMe: boolean;
  hasWon: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <div className="min-w-0">
        <div className={cn('truncate text-lg font-semibold', hasWon && 'underline')}>
          {seat.displayName}
        </div>
        <div className="text-xs text-muted-foreground">
          {isMe ? 'You' : null}
          {isMe && hasWon ? ' · ' : null}
          {hasWon ? 'Won the race' : null}
        </div>
      </div>
      <div className="flex items-baseline gap-1 tabular-nums">
        <span className="text-3xl font-bold">{won}</span>
        <span className="text-sm text-muted-foreground">of {seat.goal}</span>
      </div>
    </div>
  );
}

export function RaceScoreboard({
  home,
  away,
  homeWon,
  awayWon,
  mySide,
  winnerSide,
}: RaceScoreboardProps) {
  return (
    <Card>
      <CardContent className="divide-y py-2">
        <SeatRow
          seat={home}
          won={homeWon}
          isMe={mySide === 'home'}
          hasWon={winnerSide === 'home'}
        />
        <SeatRow
          seat={away}
          won={awayWon}
          isMe={mySide === 'away'}
          hasWon={winnerSide === 'away'}
        />
      </CardContent>
    </Card>
  );
}
