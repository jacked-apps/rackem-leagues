/**
 * @fileoverview Lineup Validation Hook
 *
 * Provides validation functions for lineup completeness and validity.
 * Checks for required selections, duplicate nicknames, etc.
 *
 * @example
 * const validation = useLineupValidation({
 *   player1Id,
 *   player2Id,
 *   player3Id,
 *   subHandicap,
 *   players
 * });
 *
 * if (validation.isComplete && !validation.hasDuplicates) {
 *   // Lineup is valid
 * }
 */

import { useMemo } from 'react';
import type { Player } from '@/types/match';
import { hasDuplicateNicknames } from '@/utils/lineup';
import { lineupHasSubstitute } from '@/utils/lineup';

export interface LineupValidationInput {
  player1Id: string;
  player2Id: string;
  player3Id: string;
  player4Id?: string; // Optional for 5v5
  player5Id?: string; // Optional for 5v5
  playerCount?: number; // Defaults to 3 for backward compatibility
  subHandicap: string;
  players: Player[];
  isTiebreakerMode?: boolean;
  teamFormat?: '5_man' | '8_man'; // Team format - 5v5 doesn't need sub handicap
}

export interface LineupValidation {
  // Validation flags
  isComplete: boolean;
  hasDuplicates: boolean;
  hasSub: boolean;
  canLock: boolean;

  // Error messages
  completenessError: string | null;
  duplicatesError: string | null;
}

/**
 * Hook to validate lineup selections
 *
 * @param input - All required data for validation
 * @returns Validation results and error messages
 */
export function useLineupValidation(
  input: LineupValidationInput
): LineupValidation {
  const {
    player1Id,
    player2Id,
    player3Id,
    player4Id = '',
    player5Id = '',
    playerCount = 3,
    subHandicap,
    players,
    isTiebreakerMode,
    teamFormat = '5_man',
  } = input;

  // Build array of all player IDs based on player count
  const allPlayerIds = useMemo(() => {
    const ids = [player1Id, player2Id, player3Id];
    if (playerCount === 5) {
      ids.push(player4Id, player5Id);
    }
    return ids;
  }, [player1Id, player2Id, player3Id, player4Id, player5Id, playerCount]);

  // Check if lineup has a substitute (check first 3 positions - subs only in 3v3)
  const hasSub = useMemo(
    () => lineupHasSubstitute(player1Id, player2Id, player3Id),
    [player1Id, player2Id, player3Id]
  );

  // Check if lineup is complete (all positions filled)
  const isComplete = useMemo(() => {
    // All positions must be filled
    const allFilled = allPlayerIds.slice(0, playerCount).every((id) => id !== '');

    // If there's a sub and not in tiebreaker mode and not in 5v5, must have subHandicap
    // 5v5 (8_man) doesn't need substitute handicap - opponent chooses double duty player
    if (hasSub && !isTiebreakerMode && teamFormat !== '8_man' && !subHandicap) {
      return false;
    }

    return allFilled;
  }, [allPlayerIds, playerCount, hasSub, isTiebreakerMode, teamFormat, subHandicap]);

  // Check for duplicate nicknames
  const hasDuplicates = useMemo(() => {
    // For now, only check first 3 players (existing utility only supports 3)
    // TODO: Update hasDuplicateNicknames utility to support 5 players
    if (playerCount === 5) {
      // Manual check for 5 players
      const selectedPlayerIds = allPlayerIds.filter((id) => id !== '');
      const selectedPlayers = players.filter((p) => selectedPlayerIds.includes(p.id));
      const nicknames = selectedPlayers.map((p) => p.nickname || `${p.first_name} ${p.last_name}`);
      const uniqueNicknames = new Set(nicknames);
      return nicknames.length !== uniqueNicknames.size;
    }
    return hasDuplicateNicknames(player1Id, player2Id, player3Id, players);
  }, [allPlayerIds, playerCount, players, player1Id, player2Id, player3Id]);

  // Check if lineup can be locked
  const canLock = useMemo(
    () => isComplete && !hasDuplicates,
    [isComplete, hasDuplicates]
  );

  // Generate error messages
  const completenessError = useMemo(() => {
    if (isComplete) return null;
    // Only show substitute handicap error in 3v3 (not tiebreaker and not 5v5)
    if (hasSub && !isTiebreakerMode && teamFormat !== '8_man' && !subHandicap) {
      return 'Please select a handicap for the substitute player';
    }
    return `Please select all ${playerCount} players before locking your lineup`;
  }, [isComplete, hasSub, isTiebreakerMode, teamFormat, subHandicap, playerCount]);

  const duplicatesError = useMemo(() => {
    if (!hasDuplicates) return null;
    return 'Two or more players in your lineup have the same nickname. Please have at least one of them go to their profile page to change their nickname so they will be identifiable during scoring.';
  }, [hasDuplicates]);

  return {
    isComplete,
    hasDuplicates,
    hasSub,
    canLock,
    completenessError,
    duplicatesError,
  };
}
