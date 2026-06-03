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

import { useCallback, useMemo } from 'react';
import type { Player } from '@/types/match';
import { isSubstitute } from '@/utils/lineup';
import { roundHandicap } from '@/utils/lineup';
import { getHandicapSystem, type HandicapType } from '@/systems/handicap-systems';

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
  handicapType?: string; // 'points' uses sub handicap calc, 'percentage' uses placeholder
  // Fargo-only: LO types each player's current rating directly in the lineup UI.
  // Keyed by position (1-5). When handicapType === 'fargo', these override the
  // member's `player.handicap` value (which stores BCA handicaps, not Fargo
  // ratings). Without this override the hook would write zeros into
  // match_lineups on lock and break Fargo start-points negotiation.
  manualFargoRatings?: Record<number, string>;
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
    handicapType = 'points',
    manualFargoRatings,
  } = input;

  // Read the system's entry config once. Generalized from the legacy
  // `handicapType === 'fargo'` check: any system whose entry source is
  // 'manual' uses the manualFargoRatings record for per-position values.
  const entry = useMemo(
    () => getHandicapSystem(handicapType as HandicapType).handicapEntry,
    [handicapType],
  );
  const isManualEntry = entry.source === 'manual';
  const subPlaceholderValue = entry.subPlaceholderValue;

  // Manual-entry override: pull the typed rating for a position. Returns 0
  // when the captain hasn't entered a value yet (lineup validation blocks
  // lock in that case). Used by any system with `source === 'manual'`;
  // today that's only Fargo.
  const getPositionManualRating = useCallback(
    (position: number): number => {
      const manual = manualFargoRatings?.[position];
      if (!manual || manual.trim() === '') return 0;
      const parsed = parseInt(manual, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    },
    [manualFargoRatings]
  );

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
        // Systems with a sub placeholder (Percentage today, 40) skip the
        // dynamic calc — opponent picks the double-duty player and the
        // placeholder serves as the value until that resolves.
        if (subPlaceholderValue !== null) {
          return subPlaceholderValue;
        }

        // Other systems (Points today): calculate substitute handicap from
        // highest unused player or the captain's manual entry.
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
  }, [players, testMode, testHandicaps, subHandicap, subPlaceholderValue, getHighestUnusedHandicap]);

  // Calculate individual player handicaps.
  // Manual-entry systems (Fargo today) read the captain's typed value from
  // manualFargoRatings. All other systems use the existing player-lookup /
  // substitute logic.
  const player1Handicap = useMemo(() => {
    if (isManualEntry) return getPositionManualRating(1);
    return player1Id ? getPlayerHandicap(player1Id) : 0;
  }, [isManualEntry, getPositionManualRating, player1Id, getPlayerHandicap]);

  const player2Handicap = useMemo(() => {
    if (isManualEntry) return getPositionManualRating(2);
    return player2Id ? getPlayerHandicap(player2Id) : 0;
  }, [isManualEntry, getPositionManualRating, player2Id, getPlayerHandicap]);

  const player3Handicap = useMemo(() => {
    if (isManualEntry) return getPositionManualRating(3);
    return player3Id ? getPlayerHandicap(player3Id) : 0;
  }, [isManualEntry, getPositionManualRating, player3Id, getPlayerHandicap]);

  const player4Handicap = useMemo(() => {
    if (isManualEntry) return getPositionManualRating(4);
    return player4Id ? getPlayerHandicap(player4Id) : 0;
  }, [isManualEntry, getPositionManualRating, player4Id, getPlayerHandicap]);

  const player5Handicap = useMemo(() => {
    if (isManualEntry) return getPositionManualRating(5);
    return player5Id ? getPlayerHandicap(player5Id) : 0;
  }, [isManualEntry, getPositionManualRating, player5Id, getPlayerHandicap]);

  // Calculate player total — sum handicaps for all active lineup positions
  const playerTotal = useMemo(() => {
    const all = [player1Handicap, player2Handicap, player3Handicap, player4Handicap, player5Handicap];
    const total = all.slice(0, playerCount).reduce((sum, h) => sum + h, 0);
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
    ...(playerCount >= 4 && { player4Handicap }),
    ...(playerCount >= 5 && { player5Handicap }),
    playerTotal,
    teamTotal,
    getPlayerHandicap,
  };
}
