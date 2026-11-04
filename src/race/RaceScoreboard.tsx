/**
 * @fileoverview The race scoreboard: two players side by side, what each has
 * won out of what each needs.
 *
 * It wears the league scoreboard's clothes on purpose — the same blue home /
 * orange away cards from `scoreboardColors`, the name-and-side header line,
 * the big `won/goal` figure labelled "Wins" — so a player moving between a
 * league night and a race sees one app, not two. It is a stand-in: when the
 * modular scoreboard is rebuilt, the race gets that instead, and keeping this
 * one close to the league look makes the swap a small step.
 *
 * Both targets are always shown, even when equal. In a handicapped race one
 * player races to 7 while the other races to 4, and a single target would be
 * quietly wrong for one of them.
 *
 * Nothing signals by colour alone: each card says Home or Away (and You), and
 * the winner gets a trophy and the words "Won the race".
 */

import { Card } from '@/components/ui/card';
import { getTeamColors } from '@/components/scoring/scoreboardColors';
import type { RaceSeat, RaceSide } from './types';

interface RaceScoreboardProps {
  home: RaceSeat;
  away: RaceSeat;
  homeWon: number;
  awayWon: number;
  /** The viewer's side, so their own card can be marked. Null for a spectator. */
  mySide: RaceSide | null;
  /** Set once someone has reached their target. */
  winnerSide: RaceSide | null;
}

/** One player's card — mirrors the league scoreboard's TeamCard, minus lineups. */
function SeatCard({ seat, won, isMe, hasWon }: { seat: RaceSeat; won: number; isMe: boolean; hasWon: boolean }) {
  const colors = getTeamColors(seat.side === 'home');
  return (
    <Card className={`${colors.border} ${colors.bg} gap-0 p-0`}>
      <div className="p-2 text-sm">
        <div
          className={`flex items-center justify-center gap-1 border-b py-1 text-base font-bold ${colors.borderDark} ${colors.headerText}`}
        >
          <span className="truncate">{seat.displayName}</span>
          <span className="text-xs font-normal opacity-70">·</span>
          <span className="text-xs font-normal opacity-70">
            {seat.side === 'home' ? 'Home' : 'Away'}
            {isMe ? ' (You)' : ''}
          </span>
        </div>
        <div className="flex flex-col items-center pt-2">
          <span className={`text-3xl font-bold tabular-nums ${colors.accentText}`}>
            {won}/{seat.goal}
          </span>
          <span className="text-[10px] text-muted-foreground">Wins</span>
        </div>
        {hasWon ? (
          <div className={`pt-1 text-center text-xs font-semibold ${colors.headerText}`}>
            🏆 Won the race
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export function RaceScoreboard({ home, away, homeWon, awayWon, mySide, winnerSide }: RaceScoreboardProps) {
  return (
    <div className="rounded-md border bg-card p-2 shadow-sm">
      <div className="grid grid-cols-2 gap-2">
        <SeatCard seat={home} won={homeWon} isMe={mySide === 'home'} hasWon={winnerSide === 'home'} />
        <SeatCard seat={away} won={awayWon} isMe={mySide === 'away'} hasWon={winnerSide === 'away'} />
      </div>
    </div>
  );
}
