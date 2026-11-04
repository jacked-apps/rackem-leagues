/**
 * @fileoverview The list of games in a race, drawn with the league's own game
 * row (`GameButtonRow`) so a race scores the way a league match does: breaker
 * on the left, racker on the right, tap the player who won.
 *
 * What differs from a league night is only which actions each row allows:
 *
 * - Only the ACTIVE game (the newest, unplayed one) takes a tap. Games are
 *   appended one at a time, so there is never more than one unscored row.
 * - "Vacate" sits on exactly one row — the last game with a result. A race is
 *   two people at one table, so games are undone in order, newest first. The
 *   server enforces the same rule, so a stale screen cannot talk it into
 *   anything; the row simply never offers what would be refused.
 * - "Confirm" sits on the pending game waiting on THIS viewer, so a player who
 *   waved the confirm dialog away can bring it back.
 * - A spectator sees the same rows with every button disabled.
 */

import { GameButtonRow } from '@/components/scoring/GameButtonRow';
import { isSettled, winnerSideOf, type Race, type RaceGame, type RaceSeat } from './types';

interface RaceGamesListProps {
  race: Race;
  games: RaceGame[];
  home: RaceSeat;
  away: RaceSeat;
  /** The game a result may be entered on. */
  activeGameNumber: number | null;
  /** The only game that may be vacated. */
  vacatableGameNumber: number | null;
  /** The pending game waiting on this viewer's answer, if any. */
  awaitingGameNumber?: number | null;
  /** False for a spectator: every button is disabled. */
  isPlayer: boolean;
  onScore: (gameNumber: number, winnerSeat: RaceSeat, winnerWasBreaker: boolean) => void;
  onVacate: (gameNumber: number) => void;
  /** Re-open the confirm dialog for a game waiting on this viewer. */
  onConfirm?: (gameNumber: number) => void;
  busy?: boolean;
}

export function RaceGamesList({
  race,
  games,
  home,
  away,
  activeGameNumber,
  vacatableGameNumber,
  awaitingGameNumber = null,
  isPlayer,
  onScore,
  onVacate,
  onConfirm,
  busy,
}: RaceGamesListProps) {
  if (games.length === 0) {
    return (
      <p className="py-3 text-center text-sm text-muted-foreground">
        No games yet. The race starts once someone breaks.
      </p>
    );
  }

  const played = games.filter(isSettled).length;

  return (
    <div>
      {/* Same header as the league's games list: a count, then the columns. */}
      <div className="pt-2 pb-1 text-sm font-semibold">
        Games played: <span className="text-lg">{played}</span>
      </div>
      <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-2 border-b pb-1 text-xs text-muted-foreground">
        <div className="w-5" />
        <div className="text-center">Break</div>
        <div className="text-center font-semibold">vs</div>
        <div className="text-center">Rack</div>
      </div>

      {games.map((game) => {
        const breaker = game.home_action === 'breaks' ? home : away;
        const racker = breaker.side === 'home' ? away : home;
        const winnerSide = winnerSideOf(game, race);
        const state = winnerSide === null ? 'unscored' : isSettled(game) ? 'confirmed' : 'pending';
        const n = game.game_number;
        const canScore = isPlayer && n === activeGameNumber && state === 'unscored';

        return (
          <GameButtonRow
            key={game.id}
            gameNumber={n}
            breakerName={breaker.displayName}
            breakerPlayerId={breaker.memberId}
            breakerTeamId={breaker.side}
            breakerIsHome={breaker.side === 'home'}
            rackerName={racker.displayName}
            rackerPlayerId={racker.memberId}
            rackerTeamId={racker.side}
            rackerIsHome={racker.side === 'home'}
            state={state}
            winnerPlayerId={game.winner_player_id}
            // Tapping a name only means something on the game being played.
            onPlayerClick={(_, playerId) => {
              if (!canScore) return;
              const seat = playerId === home.memberId ? home : away;
              onScore(n, seat, seat.side === breaker.side);
            }}
            onConfirmClick={
              isPlayer && onConfirm && n === awaitingGameNumber ? () => onConfirm(n) : undefined
            }
            onVacateClick={isPlayer && n === vacatableGameNumber ? () => onVacate(n) : undefined}
            disabled={!isPlayer || busy}
          />
        );
      })}
    </div>
  );
}
