/**
 * @fileoverview Game Button Row Component
 *
 * One game as a single line: game number, breaker button, a middle slot,
 * racker button. It is the same row the league scoring page draws (see
 * `GamesList`), pulled out so other scorers — the room race today, the
 * modular scoreboard later — look and behave like league scoring instead of
 * inventing their own layout.
 *
 * States:
 * - Unscored: two clickable buttons in team colours (blue home / orange away)
 * - Pending: winner highlighted (yellow), no trophy
 * - Confirmed: winner highlighted (green) WITH a trophy
 *
 * The middle slot carries the one action the caller allows on this game:
 * "Confirm" (pending, waiting on this viewer), "Vacate" (undo it), or a plain
 * "vs" when neither applies. A caller opts in by passing the handler, so a
 * scorer with stricter rules (the race only lets the LAST game be vacated)
 * simply omits `onVacateClick` on every other row.
 *
 * Pending vs confirmed is never told by colour alone: the trophy marks a
 * confirmed winner, and the middle slot's words differ.
 */

import { Button } from '@/components/ui/button';
import { getTeamColors } from './scoreboardColors';

interface GameButtonRowProps {
  /** Game number */
  gameNumber: number;
  /** Breaker player name */
  breakerName: string;
  /** Breaker player ID */
  breakerPlayerId: string;
  /** Breaker team ID (a race passes the side) */
  breakerTeamId: string;
  /** Whether breaker is on home team */
  breakerIsHome: boolean;
  /** Racker player name */
  rackerName: string;
  /** Racker player ID */
  rackerPlayerId: string;
  /** Racker team ID (a race passes the side) */
  rackerTeamId: string;
  /** Whether racker is on home team */
  rackerIsHome: boolean;
  /** Game state: 'unscored', 'pending', or 'confirmed' */
  state: 'unscored' | 'pending' | 'confirmed';
  /** Winner player ID (if game has winner) */
  winnerPlayerId?: string | null;
  /** Handler when a player button is clicked */
  onPlayerClick: (
    gameNumber: number,
    playerId: string,
    playerName: string,
    teamId: string
  ) => void;
  /** Pending only: show "Confirm" in the middle. Omit when this viewer has nothing to confirm. */
  onConfirmClick?: (gameNumber: number) => void;
  /** Show "Vacate" in the middle. Omit on games that may not be vacated. */
  onVacateClick?: (gameNumber: number, winnerName: string) => void;
  /** Disable every button — a spectator, or an action already in flight. */
  disabled?: boolean;
}

const rowClass = 'grid grid-cols-[auto_1fr_auto_1fr] gap-2 items-center text-sm py-2 border-b';
const vs = <div className="text-center font-semibold text-muted-foreground">vs</div>;

/**
 * Game button row component for match scoring.
 *
 * @example
 * <GameButtonRow gameNumber={3} state="confirmed" ... onVacateClick={vacate} />
 */
export function GameButtonRow({
  gameNumber,
  breakerName,
  breakerPlayerId,
  breakerTeamId,
  breakerIsHome,
  rackerName,
  rackerPlayerId,
  rackerTeamId,
  rackerIsHome,
  state,
  winnerPlayerId,
  onPlayerClick,
  onConfirmClick,
  onVacateClick,
  disabled,
}: GameButtonRowProps) {
  const breakerWon = winnerPlayerId === breakerPlayerId;
  const rackerWon = winnerPlayerId === rackerPlayerId;
  const winnerName = breakerWon ? breakerName : rackerName;

  const vacateButton = onVacateClick ? (
    <Button
      variant="outline"
      size="sm"
      className="text-xs px-1"
      disabled={disabled}
      onClick={() => onVacateClick(gameNumber, winnerName)}
    >
      Vacate
    </Button>
  ) : (
    vs
  );

  // Pending state: buttons with the winner highlighted, no trophy yet.
  if (state === 'pending') {
    const winnerClass = 'bg-yellow-100 font-semibold';
    const loserClass = 'bg-card text-muted-foreground';
    const middle = onConfirmClick ? (
      <Button
        variant="outline"
        size="sm"
        className="text-xs px-1 bg-info/10 hover:bg-info/20 text-info font-semibold"
        disabled={disabled}
        onClick={() => onConfirmClick(gameNumber)}
      >
        Confirm
      </Button>
    ) : (
      vacateButton
    );

    return (
      <div className={rowClass}>
        <div className="font-semibold">{gameNumber}.</div>
        <Button
          variant="outline"
          size="sm"
          className={`w-full ${breakerWon ? winnerClass : loserClass}`}
          disabled={disabled}
          onClick={() => onPlayerClick(gameNumber, breakerPlayerId, breakerName, breakerTeamId)}
        >
          {breakerName}
        </Button>
        {middle}
        <Button
          variant="outline"
          size="sm"
          className={`w-full ${rackerWon ? winnerClass : loserClass}`}
          disabled={disabled}
          onClick={() => onPlayerClick(gameNumber, rackerPlayerId, rackerName, rackerTeamId)}
        >
          {rackerName}
        </Button>
      </div>
    );
  }

  // Confirmed state: plain cells, trophy on the winner, Vacate if allowed.
  if (state === 'confirmed') {
    const winnerClass = 'bg-green-200 font-semibold';
    const loserClass = 'bg-card text-muted-foreground';

    return (
      <div className={rowClass}>
        <div className="font-semibold">{gameNumber}.</div>
        <div className={`text-center p-2 rounded ${breakerWon ? winnerClass : loserClass}`}>
          {breakerWon && <span className="mr-1">🏆</span>}
          {breakerName}
        </div>
        {vacateButton}
        <div className={`text-center p-2 rounded ${rackerWon ? winnerClass : loserClass}`}>
          {rackerWon && <span className="mr-1">🏆</span>}
          {rackerName}
        </div>
      </div>
    );
  }

  // Unscored state: buttons in team colours — tap the player who won.
  const breakerColors = getTeamColors(breakerIsHome);
  const rackerColors = getTeamColors(rackerIsHome);

  return (
    <div className={rowClass}>
      <div className="font-semibold">{gameNumber}.</div>
      <Button
        variant="outline"
        size="sm"
        className={`w-full ${breakerColors.bg} ${breakerColors.bgHover}`}
        disabled={disabled}
        onClick={() => onPlayerClick(gameNumber, breakerPlayerId, breakerName, breakerTeamId)}
      >
        {breakerName}
      </Button>
      {vs}
      <Button
        variant="outline"
        size="sm"
        className={`w-full ${rackerColors.bg} ${rackerColors.bgHover}`}
        disabled={disabled}
        onClick={() => onPlayerClick(gameNumber, rackerPlayerId, rackerName, rackerTeamId)}
      >
        {rackerName}
      </Button>
    </div>
  );
}
