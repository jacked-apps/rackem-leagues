/**
 * @fileoverview Game Button Row Component
 *
 * Displays a single game row with breaker vs racker buttons.
 * Handles three states: unscored, pending confirmation, and confirmed.
 *
 * States:
 * - Unscored: Two clickable buttons with team colors (blue/orange)
 * - Pending: Two buttons with winner highlighted (yellow/white)
 * - Confirmed: Divs with trophy for winner, Vacate button in middle
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
  /** Breaker team ID */
  breakerTeamId: string;
  /** Whether breaker is on home team */
  breakerIsHome: boolean;
  /** Racker player name */
  rackerName: string;
  /** Racker player ID */
  rackerPlayerId: string;
  /** Racker team ID */
  rackerTeamId: string;
  /** Whether racker is on home team */
  rackerIsHome: boolean;
  /** Game state: 'unscored', 'pending', or 'confirmed' */
  state: 'unscored' | 'pending' | 'confirmed';
  /** Winner player ID (if game has winner) */
  winnerPlayerId?: string | null;
  /** Handler when player button is clicked */
  onPlayerClick: (
    gameNumber: number,
    playerId: string,
    playerName: string,
    teamId: string
  ) => void;
  /** Handler when vacate button is clicked */
  onVacateClick?: (gameNumber: number, winnerName: string) => void;
}

/**
 * Game button row component for match scoring
 *
 * Displays breaker vs racker with appropriate styling based on game state.
 * Handles clicks for scoring and vacating games.
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
  onVacateClick,
}: GameButtonRowProps) {
  const breakerWon = winnerPlayerId === breakerPlayerId;
  const rackerWon = winnerPlayerId === rackerPlayerId;

  // Pending state: Buttons with winner highlighted
  if (state === 'pending') {
    const winnerClass = 'bg-yellow-100 font-semibold';
    const loserClass = 'bg-card text-muted-foreground';

    return (
      <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-2 items-center text-sm py-2 border-b">
        <div className="font-semibold">{gameNumber}.</div>
        <Button
          variant="outline"
          size="sm"
          className={`w-full ${breakerWon ? winnerClass : loserClass}`}
          onClick={() =>
            onPlayerClick(gameNumber, breakerPlayerId, breakerName, breakerTeamId)
          }
        >
          {breakerName}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs px-1 bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold"
          onClick={() =>
            onPlayerClick(gameNumber, breakerWon ? breakerPlayerId : rackerPlayerId, breakerWon ? breakerName : rackerName, breakerWon ? breakerTeamId : rackerTeamId)
          }
        >
          Confirm
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={`w-full ${rackerWon ? winnerClass : loserClass}`}
          onClick={() =>
            onPlayerClick(gameNumber, rackerPlayerId, rackerName, rackerTeamId)
          }
        >
          {rackerName}
        </Button>
      </div>
    );
  }

  // Confirmed state: Divs with trophy and Vacate button
  if (state === 'confirmed') {
    const winnerClass = 'bg-green-200 font-semibold';
    const loserClass = 'bg-card text-muted-foreground';

    return (
      <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-2 items-center text-sm py-2 border-b">
        <div className="font-semibold">{gameNumber}.</div>
        <div
          className={`text-center p-2 rounded ${
            breakerWon ? winnerClass : loserClass
          }`}
        >
          {breakerWon && <span className="mr-1">🏆</span>}
          {breakerName}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs px-1"
          onClick={() => {
            if (onVacateClick) {
              onVacateClick(gameNumber, breakerWon ? breakerName : rackerName);
            }
          }}
        >
          Vacate
        </Button>
        <div
          className={`text-center p-2 rounded ${
            rackerWon ? winnerClass : loserClass
          }`}
        >
          {rackerWon && <span className="mr-1">🏆</span>}
          {rackerName}
        </div>
      </div>
    );
  }

  // Unscored state: Buttons with team colors
  const breakerColors = getTeamColors(breakerIsHome);
  const rackerColors = getTeamColors(rackerIsHome);

  return (
    <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-2 items-center text-sm py-2 border-b">
      <div className="font-semibold">{gameNumber}.</div>
      <div className="text-center">
        <Button
          variant="outline"
          size="sm"
          className={`w-full ${breakerColors.bg} ${breakerColors.bgHover}`}
          onClick={() =>
            onPlayerClick(gameNumber, breakerPlayerId, breakerName, breakerTeamId)
          }
        >
          {breakerName}
        </Button>
      </div>
      <div className="text-center font-semibold text-muted-foreground">vs</div>
      <div className="text-center">
        <Button
          variant="outline"
          size="sm"
          className={`w-full ${rackerColors.bg} ${rackerColors.bgHover}`}
          onClick={() =>
            onPlayerClick(gameNumber, rackerPlayerId, rackerName, rackerTeamId)
          }
        >
          {rackerName}
        </Button>
      </div>
    </div>
  );
}
