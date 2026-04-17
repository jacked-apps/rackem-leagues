/**
 * @fileoverview Handicap Calculations Hook
 *
 * Manages all handicap-related calculations for a lineup.
 * Handles player handicaps, substitute handicaps, test mode overrides, and totals.
 *
 * @example
 * const handicaps = useHandicapCalculations({
 *   player1Id,
 *   player2Id,
 *   player3Id,
 *   subHandicap,
 *   players,
 *   testMode,
 *   testHandicaps,
 *   teamHandicap,
 *   isHomeTeam
 * });
 *
 * console.log(handicaps.playerTotal); // Sum of 3 player handicaps
 * console.log(handicaps.teamTotal);   // Player total + team bonus
 */

import { useMemo } from 'react';
import type { Player } from '@/types/match';
import { isSubstitute } from '@/utils/lineup';
import { roundHandicap } from '@/utils/lineup';

export interface HandicapCalculationsInput {
  player1Id: string;
  player2Id: string;
  player3Id: string;
  player4Id?: string; // Optional for 5v5
  player5Id?: string; // Optional for 5v5
  playerCount: number; // Number of players in lineup
  subHandicap: string;
  players: Player[];
  testMode: boolean;
  testHandicaps: Record<string, number>;
  teamHandicap: number;
  isHomeTeam: boolean;
  teamFormat?: '5_man' | '8_man'; // Team format to determine sub handicap logic
}

export interface HandicapCalculations {
  // Individual player handicaps (1-3 always present, 4-5 optional)
  player1Handicap: number;
  player2Handicap: number;
  player3Handicap: number;
  player4Handicap?: number; // For 5v5
  player5Handicap?: number; // For 5v5

  // Totals
  playerTotal: number;   // Sum of all players (3 or 5)
  teamTotal: number;     // Player total + team bonus (home only)

  // Helper functions
  getPlayerHandicap: (playerId: string) => number;
}

/**
 * Hook to calculate all handicap values for a lineup
 *
 * @param input - All required data for calculations
 * @returns Calculated handicaps and totals
 */
export function useHandicapCalculations(
  input: HandicapCalculationsInput
): HandicapCalculations {
  const {
    player1Id,
    player2Id,
    player3Id,
    player4Id = '',
    player5Id = '',
    playerCount,
    subHandicap,
    players,
    testMode,
    testHandicaps,
    teamHandicap,
    isHomeTeam,
    teamFormat = '5_man',
  } = input;

  /**
   * Get the highest handicap of players NOT in the lineup
   * Used for substitute handicap calculation
   */
  const getHighestUnusedHandicap = useMemo(() => {
    return (): number => {
      const usedPlayerIds = [player1Id, player2Id, player3Id, player4Id, player5Id].filter(
        (id) => id && !isSubstitute(id)
      );
      const unusedPlayers = players.filter((p) => !usedPlayerIds.includes(p.id));

      if (unusedPlayers.length === 0) return 0;

      // Use test mode overrides if available
      return Math.max(
        ...unusedPlayers.map((p) => {
          if (testMode && testHandicaps[p.id] !== undefined) {
            return testHandicaps[p.id];
          }
          return p.handicap || 0;
        })
      );
    };
  }, [player1Id, player2Id, player3Id, player4Id, player5Id, players, testMode, testHandicaps]);

  /**
   * Get handicap for a specific player
   */
  const getPlayerHandicap = useMemo(() => {
    return (playerId: string): number => {
      // In test mode, use override handicaps if available
      if (testMode && testHandicaps[playerId] !== undefined) {
        return testHandicaps[playerId];
      }

      // Handle substitutes
      if (isSubstitute(playerId)) {
        // 5v5: SUB doesn't need a calculated handicap - opponent will choose double duty player
        // Return 40 as placeholder (initial 5v5 handicap)
        if (teamFormat === '8_man') {
          return 40;
        }

        // 3v3: Calculate substitute handicap from highest unused player or manual entry
        const highestUnused = getHighestUnusedHandicap();

        // If sub handicap is manually entered, use the HIGHER of the two
        if (subHandicap) {
          const subValue = parseFloat(subHandicap);
          return Math.max(subValue, highestUnused);
        }

        // Otherwise use highest handicap of unused players
        return highestUnused;
      }

      // Regular player
      const player = players.find((p) => p.id === playerId);
      return player?.handicap || 0;
    };
  }, [players, testMode, testHandicaps, subHandicap, teamFormat, getHighestUnusedHandicap]);

  // Calculate individual player handicaps
  const player1Handicap = useMemo(
    () => (player1Id ? getPlayerHandicap(player1Id) : 0),
    [player1Id, getPlayerHandicap]
  );

  const player2Handicap = useMemo(
    () => (player2Id ? getPlayerHandicap(player2Id) : 0),
    [player2Id, getPlayerHandicap]
  );

  const player3Handicap = useMemo(
    () => (player3Id ? getPlayerHandicap(player3Id) : 0),
    [player3Id, getPlayerHandicap]
  );

  const player4Handicap = useMemo(
    () => (player4Id ? getPlayerHandicap(player4Id) : 0),
    [player4Id, getPlayerHandicap]
  );

  const player5Handicap = useMemo(
    () => (player5Id ? getPlayerHandicap(player5Id) : 0),
    [player5Id, getPlayerHandicap]
  );

  // Calculate player total (sum of 3 or 5 players based on playerCount)
  const playerTotal = useMemo(() => {
    let total = player1Handicap + player2Handicap + player3Handicap;
    if (playerCount === 5) {
      total += player4Handicap + player5Handicap;
    }
    return roundHandicap(total);
  }, [player1Handicap, player2Handicap, player3Handicap, player4Handicap, player5Handicap, playerCount]);

  // Calculate team total (player total + team bonus for home team)
  const teamTotal = useMemo(() => {
    const bonus = isHomeTeam ? teamHandicap : 0;
    return roundHandicap(playerTotal + bonus);
  }, [playerTotal, teamHandicap, isHomeTeam]);

  return {
    player1Handicap,
    player2Handicap,
    player3Handicap,
    ...(playerCount === 5 && { player4Handicap, player5Handicap }),
    playerTotal,
    teamTotal,
    getPlayerHandicap,
  };
}
