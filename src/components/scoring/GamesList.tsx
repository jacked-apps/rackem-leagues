/**
 * @fileoverview Games List Component
 *
 * Displays scrollable list of all match games.
 * Format-agnostic - works for 3, 18, or 25 games automatically.
 * Shows game status (unscored, pending, confirmed) and handles user interactions.
 *
 * Display Modes:
 * - Break/Rack (default): Breaker on left, Racker on right
 * - Home/Away: Home team always on left, Away team always on right
 * User can toggle by clicking the column headers. Preference is saved to localStorage.
 *
 * ALL game data comes directly from the database (gameResults Map).
 * No calculated or "on the fly" data is displayed.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { MatchGame } from '@/types';

/** Display mode for game list columns */
type DisplayMode = 'break-rack' | 'home-away';

/** localStorage key for persisting display mode preference */
const DISPLAY_MODE_KEY = 'rackem-games-display-mode';

interface GamesListProps {
  gameResults: Map<number, MatchGame>;
  getPlayerDisplayName: (playerId: string | null) => string;
  onGameClick: (gameNumber: number, playerId: string, playerName: string, teamId: string) => void;
  onVacateClick: (gameNumber: number, currentWinnerName: string) => void;
  onVacateRequestClick?: (gameNumber: number, currentWinnerName: string) => void;
  homeTeamId: string;
  awayTeamId: string;
  totalGames: number; // 18 for 3v3, 3 for tiebreaker, 25 for 5v5
  isHomeTeam: boolean | null; // Needed to determine if user requested vacate
}

/**
 * Scrollable game list showing all games in the match
 *
 * Game states:
 * - Unscored: Clickable buttons (blue for home, orange for away)
 * - Pending: Yellow background on winner, white on loser, no trophy, no edit button
 * - Vacate Requested: Red background on winner, white on loser, "Vacate Request" button in middle
 * - Confirmed: Green background on winner, white on loser, trophy icon, "Vacate" button
 *
 * Key feature: Reads ALL data from database (gameResults Map)
 */
export function GamesList({
  gameResults,
  getPlayerDisplayName,
  onGameClick,
  onVacateClick,
  onVacateRequestClick,
  homeTeamId,
  awayTeamId,
  totalGames,
  isHomeTeam,
}: GamesListProps) {
  /**
   * Display mode state - persisted to localStorage
   * - 'break-rack': Breaker on left, Racker on right (default)
   * - 'home-away': Home team on left, Away team on right
   */
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    // Initialize from localStorage or default to 'break-rack'
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(DISPLAY_MODE_KEY);
      if (saved === 'home-away') return 'home-away';
    }
    return 'break-rack';
  });

  /**
   * Toggle display mode and persist to localStorage
   */
  const toggleDisplayMode = () => {
    const newMode = displayMode === 'break-rack' ? 'home-away' : 'break-rack';
    setDisplayMode(newMode);
    localStorage.setItem(DISPLAY_MODE_KEY, newMode);
  };

  /**
   * Get completed games count
   */
  const getCompletedGamesCount = () => {
    let count = 0;
    gameResults.forEach(game => {
      if (game.confirmed_by_home && game.confirmed_by_away) {
        count++;
      }
    });
    return count;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Fixed header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-2 bg-muted">
        <div className="text-sm font-semibold mb-4">
          Games Complete: <span className="text-lg">{getCompletedGamesCount()} / {totalGames}</span>
        </div>
        {/* Column headers - clickable to toggle display mode */}
        <button
          onClick={toggleDisplayMode}
          className="w-full grid grid-cols-[auto_1fr_auto_1fr] gap-2 items-center text-xs text-muted-foreground pb-2 hover:text-foreground transition-colors cursor-pointer"
          title={`Click to switch to ${displayMode === 'break-rack' ? 'Home/Away' : 'Break/Rack'} view`}
        >
          <div></div>
          <div className="text-center">{displayMode === 'break-rack' ? 'Break' : 'Home'}</div>
          <div className="text-center font-semibold">vs</div>
          <div className="text-center">{displayMode === 'break-rack' ? 'Rack' : 'Away'}</div>
        </button>
      </div>

      {/* Scrollable game list - DYNAMIC (works for any number of games) */}
      {/* ALL game data comes from database - sorted by game_number */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="space-y-2">
          {Array.from(gameResults.values())
            .sort((a, b) => a.game_number - b.game_number)
            .map(gameResult => {
            // Read player IDs directly from database record
            const homePlayerId = gameResult.home_player_id;
            const awayPlayerId = gameResult.away_player_id;
            const homePlayerName = getPlayerDisplayName(homePlayerId);
            const awayPlayerName = getPlayerDisplayName(awayPlayerId);

            // Determine who breaks and who racks from database fields
            const breakerName = gameResult.home_action === 'breaks' ? homePlayerName : awayPlayerName;
            const breakerPlayerId = gameResult.home_action === 'breaks' ? homePlayerId : awayPlayerId;
            const breakerTeamId = gameResult.home_action === 'breaks' ? homeTeamId : awayTeamId;

            const rackerName = gameResult.home_action === 'racks' ? homePlayerName : awayPlayerName;
            const rackerPlayerId = gameResult.home_action === 'racks' ? homePlayerId : awayPlayerId;
            const rackerTeamId = gameResult.home_action === 'racks' ? homeTeamId : awayTeamId;

            const breakerIsHome = gameResult.home_action === 'breaks';
            const rackerIsHome = gameResult.home_action === 'racks';

            // Determine left/right positions based on display mode
            // In 'break-rack' mode: breaker on left, racker on right
            // In 'home-away' mode: home player on left, away player on right
            const leftName = displayMode === 'break-rack' ? breakerName : homePlayerName;
            const leftPlayerId = displayMode === 'break-rack' ? breakerPlayerId : homePlayerId;
            const leftTeamId = displayMode === 'break-rack' ? breakerTeamId : homeTeamId;
            const leftIsHome = displayMode === 'break-rack' ? breakerIsHome : true;
            // In break-rack mode, left is always breaker; in home-away mode, check if home breaks
            const leftIsBreaker = displayMode === 'break-rack' ? true : breakerIsHome;

            const rightName = displayMode === 'break-rack' ? rackerName : awayPlayerName;
            const rightPlayerId = displayMode === 'break-rack' ? rackerPlayerId : awayPlayerId;
            const rightTeamId = displayMode === 'break-rack' ? rackerTeamId : awayTeamId;
            const rightIsHome = displayMode === 'break-rack' ? rackerIsHome : false;
            // In break-rack mode, right is always racker; in home-away mode, check if away breaks
            const rightIsBreaker = displayMode === 'break-rack' ? false : !breakerIsHome;

            // Display names with ⚡ (break) or △ (rack) prefix
            const leftDisplayName = `${leftIsBreaker ? '⚡' : '△'} ${leftName}`;
            const rightDisplayName = `${rightIsBreaker ? '⚡' : '△'} ${rightName}`;

            // Check game status
            const hasWinner = gameResult.winner_player_id;
            const isConfirmed = gameResult.confirmed_by_home && gameResult.confirmed_by_away;
            const isVacateRequested = !!(gameResult as any).vacate_requested_by;
            const isPending = hasWinner && !isConfirmed && !isVacateRequested;

            // Determine left/right won status based on display mode
            const leftWon = gameResult.winner_player_id === leftPlayerId;
            const rightWon = gameResult.winner_player_id === rightPlayerId;

            // If game has a winner (pending or confirmed)
            if (hasWinner) {
              // Determine styling based on confirmation status
              const winnerClass = isConfirmed ? 'bg-green-200 font-semibold' : 'bg-yellow-100 font-semibold';
              const loserClass = 'bg-card text-muted-foreground';

              // If vacate requested, show distinctive styling
              if (isVacateRequested) {
                const vacateRequestedBy = (gameResult as any).vacate_requested_by;
                const requestedByHome = vacateRequestedBy === 'home';
                const iRequestedVacate = (isHomeTeam && requestedByHome) || (!isHomeTeam && !requestedByHome);

                return (
                  <div key={gameResult.game_number} className="grid grid-cols-[auto_1fr_auto_1fr] gap-2 items-center text-sm py-2 border-b">
                    <div className="font-semibold">{gameResult.game_number}.</div>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`w-full ${leftWon ? 'bg-red-100 font-semibold' : 'bg-card text-muted-foreground'}`}
                      disabled={iRequestedVacate}
                      onClick={() => !iRequestedVacate && leftPlayerId && onGameClick(gameResult.game_number, leftPlayerId, leftName, leftTeamId)}
                    >
                      {leftDisplayName}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`text-xs px-1 ${iRequestedVacate ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'}`}
                      disabled={iRequestedVacate}
                      onClick={() => {
                        if (!iRequestedVacate && onVacateRequestClick) {
                          onVacateRequestClick(gameResult.game_number, leftWon ? leftName : rightName);
                        }
                      }}
                    >
                      {iRequestedVacate ? 'Request Sent' : 'Vacate Request'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`w-full ${rightWon ? 'bg-red-100 font-semibold' : 'bg-card text-muted-foreground'}`}
                      disabled={iRequestedVacate}
                      onClick={() => !iRequestedVacate && rightPlayerId && onGameClick(gameResult.game_number, rightPlayerId, rightName, rightTeamId)}
                    >
                      {rightDisplayName}
                    </Button>
                  </div>
                );
              }

              // If pending, show buttons with NO trophy, NO Edit button - just colored backgrounds
              if (isPending) {
                return (
                  <div key={gameResult.game_number} className="grid grid-cols-[auto_1fr_auto_1fr] gap-2 items-center text-sm py-2 border-b">
                    <div className="font-semibold">{gameResult.game_number}.</div>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`w-full ${leftWon ? winnerClass : loserClass}`}
                      onClick={() => leftPlayerId && onGameClick(gameResult.game_number, leftPlayerId, leftName, leftTeamId)}
                    >
                      {leftDisplayName}
                    </Button>
                    <div className="text-center font-semibold text-muted-foreground">vs</div>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`w-full ${rightWon ? winnerClass : loserClass}`}
                      onClick={() => rightPlayerId && onGameClick(gameResult.game_number, rightPlayerId, rightName, rightTeamId)}
                    >
                      {rightDisplayName}
                    </Button>
                  </div>
                );
              }

              // If confirmed, show divs with trophy on winner and Vacate button in middle
              return (
                <div key={gameResult.game_number} className="grid grid-cols-[auto_1fr_auto_1fr] gap-2 items-center text-sm py-2 border-b">
                  <div className="font-semibold">{gameResult.game_number}.</div>
                  <div className={`text-center p-2 rounded ${leftWon ? winnerClass : loserClass}`}>
                    {leftWon && <span className="mr-1">🏆</span>}
                    {leftDisplayName}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs px-1"
                    onClick={() => {
                      onVacateClick(gameResult.game_number, leftWon ? leftName : rightName);
                    }}
                  >
                    Vacate
                  </Button>
                  <div className={`text-center p-2 rounded ${rightWon ? winnerClass : loserClass}`}>
                    {rightWon && <span className="mr-1">🏆</span>}
                    {rightDisplayName}
                  </div>
                </div>
              );
            }

            // Unscored game - show clickable buttons
            return (
              <div key={gameResult.game_number} className="grid grid-cols-[auto_1fr_auto_1fr] gap-2 items-center text-sm py-2 border-b">
                <div className="font-semibold">{gameResult.game_number}.</div>
                <div className="text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className={`w-full ${leftIsHome ? 'bg-blue-100 hover:bg-blue-200' : 'bg-orange-100 hover:bg-orange-200'}`}
                    onClick={() => leftPlayerId && onGameClick(gameResult.game_number, leftPlayerId, leftName, leftTeamId)}
                  >
                    {leftDisplayName}
                  </Button>
                </div>
                <div className="text-center font-semibold text-muted-foreground">vs</div>
                <div className="text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className={`w-full ${rightIsHome ? 'bg-blue-100 hover:bg-blue-200' : 'bg-orange-100 hover:bg-orange-200'}`}
                    onClick={() => rightPlayerId && onGameClick(gameResult.game_number, rightPlayerId, rightName, rightTeamId)}
                  >
                    {rightDisplayName}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
