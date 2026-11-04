/**
 * @fileoverview Game Button Row Component
 *
 * One game as a single line: game number, left player, a middle slot, right
 * player. It is the same row the league scoring page draws (see `GamesList`),
 * pulled out so other scorers — the room race today, the modular scoreboard
 * later — look and behave like league scoring instead of inventing a layout.
 *
 * Which player sits on which side is the caller's choice, exactly as in the
 * league list: `leftIsBreaker` true puts breaker left / racker right ("Break /
 * Rack"); false keeps the HOME player left whoever breaks ("Home / Away", or a
 * race's "Player 1 / Player 2"). Either way the breaker's button carries the
 * small "B" badge, so the button itself says who breaks.
 *
 * States:
 * - Unscored: two clickable buttons in team colours (blue home / orange away)
 * - Pending: winner highlighted (yellow), no trophy
 * - Confirmed: winner highlighted (green) WITH a trophy
 *
 * The middle slot carries the one action the caller allows on this game:
 * "Confirm" (pending, waiting on this viewer), "Vacate" (undo it), or a plain
 * "vs". A caller opts in by passing the handler, so a scorer with stricter
 * rules (the race lets only the LAST game be vacated) omits it elsewhere.
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
  /**
   * True (default): breaker left, racker right. False: home player left, away
   * player right, whoever breaks. Mirrors the league list's display mode.
   */
  leftIsBreaker?: boolean;
  /** Game state: 'unscored', 'pending', or 'confirmed' */
  state: 'unscored' | 'pending' | 'confirmed';
  /** Winner player ID (if game has winner) */
  winnerPlayerId?: string | null;
  /** Handler when a player button is clicked */
  onPlayerClick: (gameNumber: number, playerId: string, playerName: string, teamId: string) => void;
  /** Pending only: show "Confirm" in the middle. Omit when this viewer has nothing to confirm. */
  onConfirmClick?: (gameNumber: number) => void;
  /** Show "Vacate" in the middle. Omit on games that may not be vacated. */
  onVacateClick?: (gameNumber: number, winnerName: string) => void;
  /** Disable every button — a spectator, or an action already in flight. */
  disabled?: boolean;
}

/** One player's place in the row, whichever side it lands on. */
interface Slot {
  name: string;
  id: string;
  teamId: string;
  isHome: boolean;
  isBreaker: boolean;
}

/**
 * Fixed widths for the game number and the middle slot, so the two player
 * buttons are the same size on every row whatever sits between them ("vs",
 * "Vacate", "Confirm") and whether the game is 9 or 10. An `auto` column would
 * size each row to its own content, and the buttons would shift row to row.
 * Exported so a list's column-heading row can line up with its rows.
 */
export const GAME_ROW_GRID = 'grid grid-cols-[1.75rem_1fr_4.5rem_1fr] gap-2 items-center';

const rowClass = `${GAME_ROW_GRID} text-sm py-2 border-b`;
const vs = <div className="text-center font-semibold text-muted-foreground">vs</div>;

/**
 * The name, with the league's "B" badge in front when this player breaks.
 * bg-foreground / text-background flips with the theme, so the badge stays
 * high-contrast in light and dark without fixed colours.
 */
function SlotName({ slot, trophy }: { slot: Slot; trophy?: boolean }) {
  return (
    <span className="relative flex w-full items-center justify-center">
      {slot.isBreaker && (
        <span
          className="absolute left-0 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-foreground text-xs font-bold leading-none text-background"
          aria-label="Breaks"
        >
          B
        </span>
      )}
      {trophy && <span className="mr-1">🏆</span>}
      {slot.name}
    </span>
  );
}

/**
 * Game button row component for match scoring.
 *
 * @example
 * <GameButtonRow gameNumber={3} state="confirmed" leftIsBreaker={false} ... />
 */
export function GameButtonRow(props: GameButtonRowProps) {
  const { gameNumber, state, winnerPlayerId, onPlayerClick, onConfirmClick, onVacateClick, disabled } =
    props;
  const breaker: Slot = {
    name: props.breakerName,
    id: props.breakerPlayerId,
    teamId: props.breakerTeamId,
    isHome: props.breakerIsHome,
    isBreaker: true,
  };
  const racker: Slot = {
    name: props.rackerName,
    id: props.rackerPlayerId,
    teamId: props.rackerTeamId,
    isHome: props.rackerIsHome,
    isBreaker: false,
  };
  // Break/Rack: breaker always left. Home/Away: whoever is home goes left.
  const leftIsBreaker = props.leftIsBreaker ?? true;
  const [left, right] = leftIsBreaker || breaker.isHome ? [breaker, racker] : [racker, breaker];
  const won = (s: Slot) => winnerPlayerId === s.id;
  const winnerName = won(breaker) ? breaker.name : racker.name;
  const click = (s: Slot) => () => onPlayerClick(gameNumber, s.id, s.name, s.teamId);

  const vacateButton = onVacateClick ? (
    <Button
      variant="outline"
      size="sm"
      className="w-full text-xs px-1"
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
    const cls = (s: Slot) =>
      `w-full ${won(s) ? 'bg-yellow-100 font-semibold' : 'bg-card text-muted-foreground'}`;
    const middle = onConfirmClick ? (
      <Button
        variant="outline"
        size="sm"
        className="w-full text-xs px-1 bg-info/10 hover:bg-info/20 text-info font-semibold"
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
        <Button variant="outline" size="sm" className={cls(left)} disabled={disabled} onClick={click(left)}>
          <SlotName slot={left} />
        </Button>
        {middle}
        <Button variant="outline" size="sm" className={cls(right)} disabled={disabled} onClick={click(right)}>
          <SlotName slot={right} />
        </Button>
      </div>
    );
  }

  // Confirmed state: plain cells, trophy on the winner, Vacate if allowed.
  if (state === 'confirmed') {
    const cell = (s: Slot) => (
      <div
        className={`text-center p-2 rounded ${won(s) ? 'bg-green-200 font-semibold' : 'bg-card text-muted-foreground'}`}
      >
        <SlotName slot={s} trophy={won(s)} />
      </div>
    );
    return (
      <div className={rowClass}>
        <div className="font-semibold">{gameNumber}.</div>
        {cell(left)}
        {vacateButton}
        {cell(right)}
      </div>
    );
  }

  // Unscored state: buttons in team colours — tap the player who won.
  const cls = (s: Slot) => {
    const c = getTeamColors(s.isHome);
    return `w-full ${c.bg} ${c.bgHover}`;
  };
  return (
    <div className={rowClass}>
      <div className="font-semibold">{gameNumber}.</div>
      <Button variant="outline" size="sm" className={cls(left)} disabled={disabled} onClick={click(left)}>
        <SlotName slot={left} />
      </Button>
      {vs}
      <Button variant="outline" size="sm" className={cls(right)} disabled={disabled} onClick={click(right)}>
        <SlotName slot={right} />
      </Button>
    </div>
  );
}
