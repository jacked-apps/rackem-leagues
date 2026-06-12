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

import { Button } from '@/components/ui/button';
import type { MatchGame } from '@/types';
import type { DisplayMode } from '@/hooks/useGameDisplayMode';

interface GamesListProps {
  gameResults: Map<number, MatchGame>;
  getPlayerDisplayName: (playerId: string | null) => string;
  onGameClick: (gameNumber: number, playerId: string, playerName: string, teamId: string) => void;
  onVacateClick: (gameNumber: number, currentWinnerName: string) => void;
  /**
   * Column ordering, lifted to the parent (ScoreMatch) so both this list's
   * header bar AND the scoring settings gear can drive it in sync. See
   * useGameDisplayMode.
   */
  displayMode: DisplayMode;
  /** Flip the column ordering (header bar click → same action as the gear). */
  onToggleDisplayMode: () => void;
  /**
   * Optional peek-on-confirmed-game handler (many-eyes Unit 6). When provided,
   * the player-name areas in a fully-confirmed game row become tappable —
   * tapping opens the peek/confirm dialog. NOT overloading `onGameClick`
   * (which is the scoring-shaped contract for the pending state) so the
   * pending-state tests + behavior stay untouched.
   */
  onPeekClick?: (gameNumber: number) => void;
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
  onPeekClick,
  onVacateRequestClick,
  homeTeamId,
  awayTeamId,
  totalGames,
  isHomeTeam,
  displayMode,
  onToggleDisplayMode,
}: GamesListProps) {
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
          onClick={onToggleDisplayMode}
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

            // Break indicator: small filled "B" badge before the breaker's
            // name; no marker on the racker. Uses bg-foreground / text-background
            // for an automatic dark/light mode flip (dark chip / light text in
            // light mode; light chip / dark text in dark mode — always
            // high-contrast, no fixed colors to maintain). Tied to the same
            // home_action source as the rest of the row, so it tracks whatever
            // the Pairings Generator computed at lineup-lock.
            const breakBadge = (
              <span
                className="absolute left-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-foreground text-background text-xs font-bold leading-none"
                aria-label="Breaks"
              >
                B
              </span>
            );
            const leftDisplayName = (
              <span className="relative flex items-center justify-center w-full">
                {leftIsBreaker && breakBadge}
                {leftName}
              </span>
            );
            const rightDisplayName = (
              <span className="relative flex items-center justify-center w-full">
                {rightIsBreaker && breakBadge}
                {rightName}
              </span>
            );

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
                      className={`text-xs px-1 ${iRequestedVacate ? 'bg-warning/10 border-warning/40 text-warning' : 'bg-destructive/10 border-destructive/40 text-destructive hover:bg-destructive/20'}`}
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

              // If confirmed, show divs with trophy on winner and Vacate button in middle.
              // Unit 6: when onPeekClick is provided, the player-name areas become
              // tappable buttons that open the peek/confirm dialog. The Vacate
              // button stays as the deliberate destructive action — separate concern.
              const handlePeek = onPeekClick
                ? () => onPeekClick(gameResult.game_number)
                : undefined;
              return (
                <div key={gameResult.game_number} className="grid grid-cols-[auto_1fr_auto_1fr] gap-2 items-center text-sm py-2 border-b">
                  <div className="font-semibold">{gameResult.game_number}.</div>
                  <button
                    type="button"
                    disabled={!handlePeek}
                    onClick={handlePeek}
                    className={`text-center p-2 rounded ${leftWon ? winnerClass : loserClass} ${handlePeek ? 'transition hover:opacity-80 cursor-pointer' : 'cursor-default'}`}
                  >
                    {leftWon && <span className="mr-1">🏆</span>}
                    {leftDisplayName}
                  </button>
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
                  <button
                    type="button"
                    disabled={!handlePeek}
                    onClick={handlePeek}
                    className={`text-center p-2 rounded ${rightWon ? winnerClass : loserClass} ${handlePeek ? 'transition hover:opacity-80 cursor-pointer' : 'cursor-default'}`}
                  >
                    {rightWon && <span className="mr-1">🏆</span>}
                    {rightDisplayName}
                  </button>
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
