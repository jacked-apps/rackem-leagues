/**
 * @fileoverview Opponent Status Hook
 *
 * Provides opponent team information and lineup status.
 * Calculates whether opponent is absent, choosing lineup, or ready.
 * Shows detailed player selection progress.
 *
 * Note: Lineups are auto-created by database trigger when match is inserted,
 * so we determine "absent" by checking if opponent has selected any players,
 * not by checking if lineup ID exists.
 */

interface OpponentStatusParams {
  /** Match data */
  matchData: any;
  /** Is current user on home team? */
  isHomeTeam: boolean;
  /** Opponent's lineup data */
  opponentLineup: any;
  /** Is this tiebreaker mode? */
  isTiebreakerMode?: boolean;
  /** All games (for tiebreaker mode player counting) */
  allGames?: any[];
  /** Player count (3 for 3v3, 5 for 5v5) */
  playerCount?: number;
}

export type OpponentStatus = 'absent' | 'choosing' | 'ready';

interface OpponentStatusResult {
  /** Opponent team info */
  opponentTeam: any;
  /** Opponent status: absent, choosing, or ready */
  status: OpponentStatus;
  /** Detailed selection status string for display */
  selectionStatus: string;
}

/**
 * Hook to get opponent team information and lineup status
 *
 * Status meanings:
 * - absent: Opponent hasn't selected any players yet (lineup exists but empty)
 * - choosing: Opponent is selecting players (has at least 1 player but not locked)
 * - ready: Opponent has locked their lineup
 *
 * Note: Since lineups are auto-created by database trigger, we can't use
 * lineup ID presence to determine if opponent has "joined". Instead we check
 * if they've selected any players.
 *
 * @param params - Match data and opponent info
 * @returns Opponent team, status, and selection details
 *
 * @example
 * const { opponentTeam, status, selectionStatus } = useOpponentStatus({
 *   matchData,
 *   isHomeTeam,
 *   opponentLineup,
 *   isTiebreakerMode,
 *   allGames
 * });
 *
 * // status: 'absent' | 'choosing' | 'ready'
 * // selectionStatus: 'Absent' | 'Choosing lineup' | 'Players chosen: 2' | 'Locked'
 */
export function useOpponentStatus(params: OpponentStatusParams): OpponentStatusResult {
  const {
    matchData,
    isHomeTeam,
    opponentLineup,
    isTiebreakerMode = false,
    allGames = [],
    playerCount = 3, // Default to 3 for backward compatibility
  } = params;

  /**
   * Get opponent team info
   */
  const opponentTeam = matchData
    ? isHomeTeam
      ? matchData.away_team
      : matchData.home_team
    : null;

  /**
   * Count how many players opponent has selected in their lineup
   */
  const countSelectedPlayers = (): number => {
    if (!opponentLineup) return 0;

    let count = 0;
    if (opponentLineup.player1_id) count++;
    if (opponentLineup.player2_id) count++;
    if (opponentLineup.player3_id) count++;

    // Add player4/5 for 5v5 matches
    if (playerCount === 5) {
      if (opponentLineup.player4_id) count++;
      if (opponentLineup.player5_id) count++;
    }

    return count;
  };

  /**
   * Calculate opponent status based on player selection and locked state
   *
   * Since lineups are auto-created by trigger, we check:
   * 1. locked = ready
   * 2. has any players selected = choosing
   * 3. no players selected = absent (hasn't started choosing yet)
   */
  const getStatus = (): OpponentStatus => {
    if (!matchData) return 'absent';

    // Check if lineup is locked first
    if (opponentLineup?.locked) return 'ready';

    // Count selected players to determine if opponent has started
    const selectedCount = countSelectedPlayers();

    // No players selected = opponent hasn't joined/started yet
    if (selectedCount === 0) return 'absent';

    // Has some players = actively choosing
    return 'choosing';
  };

  /**
   * Get detailed opponent selection status showing player count
   */
  const getSelectionStatus = (): string => {
    const status = getStatus();

    if (status === 'absent') return 'Absent';
    if (status === 'ready') return 'Locked';

    // Status is 'choosing' - count selected players
    let selectedCount = 0;

    // In tiebreaker mode, count players from games 19, 20, 21
    if (isTiebreakerMode) {
      const opponentPlayerField = isHomeTeam
        ? 'away_player_id'
        : 'home_player_id';

      [19, 20, 21].forEach((gameNumber) => {
        const game = allGames.find(
          (g) => g.game_number === gameNumber && g.is_tiebreaker
        );
        if (game && game[opponentPlayerField as keyof typeof game]) {
          selectedCount++;
        }
      });
    } else {
      // Normal mode - use helper function
      selectedCount = countSelectedPlayers();
    }

    if (selectedCount === 0) return 'Choosing lineup';
    return `Players chosen: ${selectedCount}`;
  };

  return {
    opponentTeam,
    status: getStatus(),
    selectionStatus: getSelectionStatus(),
  };
}
