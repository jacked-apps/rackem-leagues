/**
 * @fileoverview The list of games in a race, drawn with the league's own game
 * row (`GameButtonRow`) so a race scores the way a league match does: breaker
 * on the left, racker on the right, tap the player who won.
 *
 * What differs from a league night is only which actions each row allows:
 *
 * - Columns default to Player 1 left / Player 2 right; the "B" badge on a
 *   button says who breaks. Tapping the headings flips to Break / Rack, as in
 *   the league list.
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

import { Button } from '@/components/ui/button';
import { GameButtonRow } from '@/components/scoring/GameButtonRow';
import { useGameDisplayMode } from '@/hooks/useGameDisplayMode';
import { isSettled, winnerSideOf, type Race, type RaceGame, type RaceSeat } from './types';

/** The race's own column preference, separate from league scoring's. */
const RACE_DISPLAY_MODE = { storageKey: 'rackem-race-display-mode', defaultMode: 'home-away' } as const;

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
  // A race starts on Player 1 left / Player 2 right (the "B" badge says who
  // breaks); its own key, so the league list keeps its own preference.
  const { displayMode, toggleDisplayMode } = useGameDisplayMode(RACE_DISPLAY_MODE);

  if (games.length === 0) {
    return (
      <p className="py-3 text-center text-sm text-muted-foreground">
        No games yet. The race starts once someone breaks.
      </p>
    );
  }

  const played = games.filter(isSettled).length;
  const byBreak = displayMode === 'break-rack';

  return (
    <div>
      {/* Same header as the league's games list: a count, then the columns.
          Tapping the column headings flips the layout, as in the league. */}
      <div className="pt-2 pb-1 text-sm font-semibold">
        Games played: <span className="text-lg">{played}</span>
      </div>
      <Button
        type="button"
        variant="ghost"
        onClick={toggleDisplayMode}
        className="grid h-auto w-full grid-cols-[auto_1fr_auto_1fr] gap-2 rounded-none border-b px-0 pb-1 pt-0 text-xs font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
        aria-label={byBreak ? 'Show Player 1 on the left' : 'Show the breaker on the left'}
      >
        <span className="w-5" />
        <span className="text-center">{byBreak ? 'Break' : 'Player 1'}</span>
        <span className="text-center font-semibold">vs</span>
        <span className="text-center">{byBreak ? 'Rack' : 'Player 2'}</span>
      </Button>

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
            leftIsBreaker={byBreak}
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
