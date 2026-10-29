/**
 * @fileoverview Tiebreaker Lineup Hook
 *
 * Handles tiebreaker-specific lineup logic.
 * In tiebreaker mode, player selections are stored in match_games records
 * instead of the match_lineups table (games 19, 20, 21 for best-of-3).
 *
 * Tiebreakers always use 3 positions regardless of the original match format.
 */

import { logger } from '@/utils/logger';
import type { useUpdateMatchGame } from '@/api/hooks/useMatchMutations';
import type { Tables } from '@/types/database.types';

interface TiebreakerLineupParams {
  /** All match games */
  allGames: Tables<'match_games'>[];
  /** Is current user on home team? */
  isHomeTeam: boolean;
  /** Match ID */
  matchId: string | undefined;
  /** Lineup state setters */
  setPlayer1Id: (id: string) => void;
  setPlayer2Id: (id: string) => void;
  setPlayer3Id: (id: string) => void;
  /** Mutation to update game records */
  updateGameMutation: ReturnType<typeof useUpdateMatchGame>;
}

interface TiebreakerLineupResult {
  /** Get player ID for a tiebreaker position (1-3) */
  getTiebreakerPlayerIdByPosition: (position: number) => string;
  /** Handle player selection change in tiebreaker mode */
  handleTiebreakerPlayerChange: (position: number, playerId: string) => void;
  /** Handle clearing player selection in tiebreaker mode */
  handleClearTiebreakerPlayer: (position: number) => void;
}

/**
 * Hook to manage tiebreaker lineup selections
 *
 * Tiebreaker mode stores selections in match_games table (games 19-21)
 * instead of match_lineups table. Only uses 3 positions (best-of-3).
 *
 * @param params - Tiebreaker configuration
 * @returns Tiebreaker lineup handlers
 *
 * @example
 * const {
 *   getTiebreakerPlayerIdByPosition,
 *   handleTiebreakerPlayerChange,
 *   handleClearTiebreakerPlayer
 * } = useTiebreakerLineup({
 *   allGames,
 *   isHomeTeam,
 *   matchId,
 *   setPlayer1Id,
 *   setPlayer2Id,
 *   setPlayer3Id,
 *   updateGameMutation
 * });
 */
export function useTiebreakerLineup(
  params: TiebreakerLineupParams
): TiebreakerLineupResult {
  const {
    allGames,
    isHomeTeam,
    matchId,
    setPlayer1Id,
    setPlayer2Id,
    setPlayer3Id,
    updateGameMutation,
  } = params;

  /**
   * Get player ID for a tiebreaker position
   * Maps position 1-3 to games 19-21
   */
  const getTiebreakerPlayerIdByPosition = (position: number): string => {
    const gameNumber = 18 + position;
    const game = allGames.find(
      (g) => g.game_number === gameNumber && g.is_tiebreaker
    );
    if (!game) return '';

    const playerField = isHomeTeam ? 'home_player_id' : 'away_player_id';
    return (game[playerField as keyof typeof game] as string) || '';
  };

  /**
   * Handle player selection change in tiebreaker mode
   * Updates both local state and game record
   */
  const handleTiebreakerPlayerChange = (
    position: number,
    playerId: string
  ) => {
    if (!matchId) return;

    // Map position to game number (1 → 19, 2 → 20, 3 → 21)
    const gameNumber = 18 + position;

    // Find the game
    const game = allGames.find(
      (g) => g.game_number === gameNumber && g.is_tiebreaker
    );
    if (!game) {
      logger.error('Tiebreaker game not found', {
        gameNumber,
        matchId,
        position
      });
      return;
    }

    // Update local state (for UI responsiveness)
    if (position === 1) setPlayer1Id(playerId);
    else if (position === 2) setPlayer2Id(playerId);
    else setPlayer3Id(playerId);

    // Determine which player field to update based on team
    const playerField = isHomeTeam ? 'home_player_id' : 'away_player_id';

    // Update the game record in database
    updateGameMutation.mutate({
      gameId: game.id,
      updates: {
        [playerField]: playerId,
      },
    });
  };

  /**
   * Handle clearing player selection in tiebreaker mode
   * Clears both local state and game record
   */
  const handleClearTiebreakerPlayer = (position: number) => {
    if (!matchId) return;

    // Map position to game number
    const gameNumber = 18 + position;

    // Find the game
    const game = allGames.find(
      (g) => g.game_number === gameNumber && g.is_tiebreaker
    );
    if (!game) return;

    // Clear local state
    if (position === 1) setPlayer1Id('');
    else if (position === 2) setPlayer2Id('');
    else setPlayer3Id('');

    // Determine which player field to clear
    const playerField = isHomeTeam ? 'home_player_id' : 'away_player_id';

    // Clear the game record in database
    updateGameMutation.mutate({
      gameId: game.id,
      updates: {
        [playerField]: null,
      },
    });
  };

  return {
    getTiebreakerPlayerIdByPosition,
    handleTiebreakerPlayerChange,
    handleClearTiebreakerPlayer,
  };
}
