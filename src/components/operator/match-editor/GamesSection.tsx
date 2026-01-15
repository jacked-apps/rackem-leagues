/**
 * @fileoverview Games Section Component
 *
 * The core section for entering and editing game results.
 * Supports multiple game creation modes and full editing of all game fields.
 *
 * Game Creation Modes:
 * - Single Round Robin: Each player plays each opponent once (lineupSize² games)
 * - Double Round Robin: Each player plays each opponent twice (lineupSize² × 2 games)
 * - Custom: Add blank games manually
 *
 * Game Row Features:
 * - Player dropdowns for both home and away
 * - Radio buttons for winner selection
 * - 3-way toggle for B&R/Golden Break
 * - Delete button to remove games
 *
 * This component integrates with useMatchEditorState for state management.
 *
 * @example
 * <GamesSection
 *   editorState={state}
 *   editorActions={actions}
 *   homeTeamName="Ball Busters"
 *   awayTeamName="Chalk & Awe"
 * />
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Gamepad2, Plus, Trash2, RefreshCw } from 'lucide-react';
import type {
  MatchEditorState,
  Game,
  LineupPlayer,
} from './useMatchEditorState';

interface GamesSectionProps {
  /** Match ID for game records (legacy prop) */
  matchId?: string;
  /** Array of existing game records (legacy prop) */
  games?: any[];
  /** Home team lineup for player selection (legacy prop) */
  homeLineup?: any | null;
  /** Away team lineup for player selection (legacy prop) */
  awayLineup?: any | null;
  /** Home team ID (legacy prop) */
  homeTeamId?: string;
  /** Away team ID (legacy prop) */
  awayTeamId?: string;
  /** Callback when any value changes (legacy prop) */
  onChange?: () => void;
  /** Current editor state (from useMatchEditorState) */
  editorState?: MatchEditorState;
  /** Editor actions (from useMatchEditorState) */
  editorActions?: {
    addGames: (games: Game[]) => void;
    updateGame: (gameId: string, updates: Partial<Game>) => void;
    setGameWinner: (gameId: string, winnerPlayerId: string | null, winnerTeamId: string | null) => void;
    removeGame: (gameId: string) => void;
    clearAllGames: () => void;
  };
  /** Home team name for display */
  homeTeamName?: string;
  /** Away team name for display */
  awayTeamName?: string;
}

/**
 * Generate unique ID for new games
 */
function generateGameId(): string {
  return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate single round robin pairings (each home player plays each away player once)
 *
 * @param homePlayers - Home team lineup players
 * @param awayPlayers - Away team lineup players
 * @returns Array of games with alternating break order
 */
function generateSingleRRGames(
  homePlayers: LineupPlayer[],
  awayPlayers: LineupPlayer[]
): Game[] {
  const games: Game[] = [];
  let gameNumber = 1;

  // Each home player plays each away player once
  for (const homePlayer of homePlayers) {
    for (const awayPlayer of awayPlayers) {
      games.push({
        id: generateGameId(),
        gameNumber,
        homePlayerId: homePlayer.playerId,
        homePlayerName: homePlayer.playerName,
        awayPlayerId: awayPlayer.playerId,
        awayPlayerName: awayPlayer.playerName,
        winnerPlayerId: null,
        winnerTeamId: null,
        breakAndRun: false,
        goldenBreak: false,
        breakerTeam: gameNumber % 2 === 1 ? 'home' : 'away', // Alternate who breaks
      });
      gameNumber++;
    }
  }

  return games;
}

/**
 * Generate double round robin pairings (each home player plays each away player twice)
 *
 * @param homePlayers - Home team lineup players
 * @param awayPlayers - Away team lineup players
 * @returns Array of games with standard break order
 */
function generateDoubleRRGames(
  homePlayers: LineupPlayer[],
  awayPlayers: LineupPlayer[]
): Game[] {
  const games: Game[] = [];
  let gameNumber = 1;

  // First round - each home player plays each away player
  for (const homePlayer of homePlayers) {
    for (const awayPlayer of awayPlayers) {
      games.push({
        id: generateGameId(),
        gameNumber,
        homePlayerId: homePlayer.playerId,
        homePlayerName: homePlayer.playerName,
        awayPlayerId: awayPlayer.playerId,
        awayPlayerName: awayPlayer.playerName,
        winnerPlayerId: null,
        winnerTeamId: null,
        breakAndRun: false,
        goldenBreak: false,
        breakerTeam: 'home', // Home breaks in first round
      });
      gameNumber++;
    }
  }

  // Second round - same pairings, away team breaks
  for (const homePlayer of homePlayers) {
    for (const awayPlayer of awayPlayers) {
      games.push({
        id: generateGameId(),
        gameNumber,
        homePlayerId: homePlayer.playerId,
        homePlayerName: homePlayer.playerName,
        awayPlayerId: awayPlayer.playerId,
        awayPlayerName: awayPlayer.playerName,
        winnerPlayerId: null,
        winnerTeamId: null,
        breakAndRun: false,
        goldenBreak: false,
        breakerTeam: 'away', // Away breaks in second round
      });
      gameNumber++;
    }
  }

  return games;
}

/**
 * Create a single blank game
 */
function createBlankGame(gameNumber: number): Game {
  return {
    id: generateGameId(),
    gameNumber,
    homePlayerId: null,
    homePlayerName: '',
    awayPlayerId: null,
    awayPlayerName: '',
    winnerPlayerId: null,
    winnerTeamId: null,
    breakAndRun: false,
    goldenBreak: false,
    breakerTeam: 'home',
  };
}

/**
 * Single game row component
 *
 * Displays:
 * - Game number
 * - Home player dropdown
 * - Winner radio buttons (home/away/none)
 * - Away player dropdown
 * - B&R/GB toggle
 * - Delete button
 */
function GameRow({
  game,
  homePlayers,
  awayPlayers,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  onUpdate,
  onSetWinner,
  onRemove,
}: {
  game: Game;
  homePlayers: LineupPlayer[];
  awayPlayers: LineupPlayer[];
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  onUpdate: (updates: Partial<Game>) => void;
  onSetWinner: (winnerPlayerId: string | null, winnerTeamId: string | null) => void;
  onRemove: () => void;
}) {
  // Determine if home or away won
  const homeWon = game.winnerTeamId === homeTeamId;
  const awayWon = game.winnerTeamId === awayTeamId;

  return (
    <div className="flex items-center gap-2 py-2 border-b border-gray-100 last:border-b-0">
      {/* Game number */}
      <span className="w-8 text-center text-sm text-gray-400 font-medium">
        {game.gameNumber}.
      </span>

      {/* Home player dropdown */}
      <Select
        value={game.homePlayerId || 'none'}
        onValueChange={(value) => {
          if (value === 'none') {
            onUpdate({ homePlayerId: null, homePlayerName: '' });
          } else {
            const player = homePlayers.find(p => p.playerId === value);
            onUpdate({
              homePlayerId: value,
              homePlayerName: player?.playerName || '',
            });
          }
        }}
      >
        <SelectTrigger className="w-32 h-8 text-sm">
          <SelectValue placeholder="Home player" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">-- Select --</SelectItem>
          {homePlayers.map((player) => (
            <SelectItem
              key={player.playerId || player.position}
              value={player.playerId || `pos_${player.position}`}
              disabled={!player.playerId}
            >
              {player.playerName || `Position ${player.position}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Winner selection - three radio buttons styled as buttons */}
      <div className="flex items-center gap-1 px-2">
        {/* Home wins button */}
        <Button
          type="button"
          variant={homeWon ? 'secondary' : 'outline'}
          size="sm"
          className={`h-7 px-2 text-xs ${
            homeWon ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-gray-600'
          }`}
          onClick={() => {
            if (game.homePlayerId) {
              onSetWinner(game.homePlayerId, homeTeamId);
            }
          }}
          disabled={!game.homePlayerId}
          title={`${homeTeamName} wins`}
        >
          H
        </Button>

        {/* Clear winner button */}
        <Button
          type="button"
          variant={!game.winnerTeamId ? 'secondary' : 'outline'}
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => onSetWinner(null, null)}
          title="No winner"
        >
          —
        </Button>

        {/* Away wins button */}
        <Button
          type="button"
          variant={awayWon ? 'secondary' : 'outline'}
          size="sm"
          className={`h-7 px-2 text-xs ${
            awayWon ? 'bg-red-600 text-white hover:bg-red-700' : 'text-gray-600'
          }`}
          onClick={() => {
            if (game.awayPlayerId) {
              onSetWinner(game.awayPlayerId, awayTeamId);
            }
          }}
          disabled={!game.awayPlayerId}
          title={`${awayTeamName} wins`}
        >
          A
        </Button>
      </div>

      {/* Away player dropdown */}
      <Select
        value={game.awayPlayerId || 'none'}
        onValueChange={(value) => {
          if (value === 'none') {
            onUpdate({ awayPlayerId: null, awayPlayerName: '' });
          } else {
            const player = awayPlayers.find(p => p.playerId === value);
            onUpdate({
              awayPlayerId: value,
              awayPlayerName: player?.playerName || '',
            });
          }
        }}
      >
        <SelectTrigger className="w-32 h-8 text-sm">
          <SelectValue placeholder="Away player" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">-- Select --</SelectItem>
          {awayPlayers.map((player) => (
            <SelectItem
              key={player.playerId || player.position}
              value={player.playerId || `pos_${player.position}`}
              disabled={!player.playerId}
            >
              {player.playerName || `Position ${player.position}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* B&R / Golden Break toggle */}
      <div className="flex items-center gap-1 ml-2">
        <Button
          type="button"
          variant={game.breakAndRun ? 'secondary' : 'outline'}
          size="sm"
          className={`h-6 px-2 text-xs ${
            game.breakAndRun ? 'bg-amber-500 text-white hover:bg-amber-600' : ''
          }`}
          onClick={() => onUpdate({
            breakAndRun: !game.breakAndRun,
            goldenBreak: false, // Can't have both
          })}
          title="Break and Run"
        >
          B&R
        </Button>
        <Button
          type="button"
          variant={game.goldenBreak ? 'secondary' : 'outline'}
          size="sm"
          className={`h-6 px-2 text-xs ${
            game.goldenBreak ? 'bg-yellow-500 text-white hover:bg-yellow-600' : ''
          }`}
          onClick={() => onUpdate({
            goldenBreak: !game.goldenBreak,
            breakAndRun: false, // Can't have both
          })}
          title="Golden Break"
        >
          GB
        </Button>
      </div>

      {/* Delete button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 text-gray-400 hover:text-red-500 ml-auto"
        onClick={onRemove}
        title="Remove game"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * Games Section
 *
 * Main component for creating and editing game results.
 * Integrates with useMatchEditorState for state management.
 */
export function GamesSection({
  games: legacyGames,
  homeLineup: legacyHomeLineup,
  awayLineup: legacyAwayLineup,
  editorState,
  editorActions,
  homeTeamName = 'Home',
  awayTeamName = 'Away',
}: GamesSectionProps) {
  // If no state hook provided, show placeholder with legacy props
  if (!editorState || !editorActions) {
    const totalGames = legacyGames?.length || 0;
    const scoredGames = legacyGames?.filter((g: any) => g.winner_player_id)?.length || 0;

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Gamepad2 className="h-5 w-5" />
            Games
            {totalGames > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({scoredGames}/{totalGames} scored)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-6">
            <div className="text-center text-gray-500">
              <p className="font-medium mb-2">Games Section</p>
              <p className="text-sm mb-4">
                {totalGames === 0 ? 'No games created yet' : `${totalGames} games`}
              </p>
              <div className="text-sm text-gray-400 mt-4">
                <p>Lineups: {legacyHomeLineup ? 'Home set' : 'Home missing'} | {legacyAwayLineup ? 'Away set' : 'Away missing'}</p>
              </div>
              <p className="mt-4 text-xs text-gray-400">
                Wire editorState and editorActions props to enable editing
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { games, homeLineup, awayLineup, homeTeamId, awayTeamId, formatConfig, result } = editorState;
  const { addGames, updateGame, setGameWinner, removeGame, clearAllGames } = editorActions;

  // Get players from lineups
  const homePlayers = homeLineup.players;
  const awayPlayers = awayLineup.players;

  // Check if lineups have enough players selected
  const homePlayersSelected = homePlayers.filter(p => p.playerId !== null).length;
  const awayPlayersSelected = awayPlayers.filter(p => p.playerId !== null).length;
  const lineupsReady = homePlayersSelected >= formatConfig.lineupSize && awayPlayersSelected >= formatConfig.lineupSize;

  // Calculate expected game counts
  const singleRRCount = formatConfig.lineupSize * formatConfig.lineupSize;
  const doubleRRCount = singleRRCount * 2;

  // Count scored games and wins
  const scoredGames = games.filter(g => g.winnerTeamId !== null).length;

  /**
   * Handle generate single round robin
   */
  const handleGenerateSingleRR = () => {
    // Clear existing games and add new ones
    clearAllGames();
    const newGames = generateSingleRRGames(homePlayers, awayPlayers);
    addGames(newGames);
  };

  /**
   * Handle generate double round robin
   */
  const handleGenerateDoubleRR = () => {
    clearAllGames();
    const newGames = generateDoubleRRGames(homePlayers, awayPlayers);
    addGames(newGames);
  };

  /**
   * Handle add blank game
   */
  const handleAddBlankGame = () => {
    const newGame = createBlankGame(games.length + 1);
    addGames([newGame]);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg">
            <Gamepad2 className="h-5 w-5" />
            Games
            {games.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({scoredGames}/{games.length} scored)
              </span>
            )}
          </div>

          {/* Running totals */}
          {games.length > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-blue-600 font-medium">
                {homeTeamName}: {result.homeGamesWon}
              </span>
              <span className="text-gray-400">-</span>
              <span className="text-red-600 font-medium">
                {awayTeamName}: {result.awayGamesWon}
              </span>
            </div>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Game generation buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerateSingleRR}
            disabled={!lineupsReady}
            className="h-8"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Single RR ({singleRRCount})
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerateDoubleRR}
            disabled={!lineupsReady}
            className="h-8"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Double RR ({doubleRRCount})
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddBlankGame}
            className="h-8"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Game
          </Button>

          {/* Clear all button - only show if games exist */}
          {games.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAllGames}
              className="h-8 text-red-500 hover:text-red-600 ml-auto"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          )}
        </div>

        {/* Lineup warning */}
        {!lineupsReady && (
          <div className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            Select all {formatConfig.lineupSize} players for both teams before generating games.
          </div>
        )}

        {/* Games list */}
        {games.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">No games created yet</p>
            <p className="text-xs mt-1">
              Use the buttons above to generate games or add them manually
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {/* Header row */}
            <div className="flex items-center gap-2 py-2 text-xs text-gray-500 border-b border-gray-200">
              <span className="w-8 text-center">#</span>
              <span className="w-32 text-center">{homeTeamName}</span>
              <span className="px-2 w-24 text-center">Winner</span>
              <span className="w-32 text-center">{awayTeamName}</span>
              <span className="ml-2 w-24 text-center">Feats</span>
              <span className="ml-auto w-7"></span>
            </div>

            {/* Game rows */}
            {games.map((game) => (
              <GameRow
                key={game.id}
                game={game}
                homePlayers={homePlayers}
                awayPlayers={awayPlayers}
                homeTeamId={homeTeamId}
                awayTeamId={awayTeamId}
                homeTeamName={homeTeamName}
                awayTeamName={awayTeamName}
                onUpdate={(updates) => updateGame(game.id, updates)}
                onSetWinner={(winnerPlayerId, winnerTeamId) =>
                  setGameWinner(game.id, winnerPlayerId, winnerTeamId)
                }
                onRemove={() => removeGame(game.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
