/**
 * @fileoverview Lineup Validation Utilities
 *
 * Pure functions for validating lineup selections.
 * Checks for completeness, duplicate nicknames, etc.
 */

import type { Player } from '@/types/match';
import { lineupHasSubstitute } from './substituteHelpers';

/**
 * Check if lineup is complete (all players selected)
 *
 * @param player1Id - First player ID
 * @param player2Id - Second player ID
 * @param player3Id - Third player ID
 * @param subHandicap - Substitute handicap (required if lineup has sub)
 * @param isTiebreakerMode - Whether in tiebreaker mode (sub handicap already set)
 * @returns True if lineup is complete
 */
export function isLineupComplete(
  player1Id: string,
  player2Id: string,
  player3Id: string,
  subHandicap: string,
  isTiebreakerMode?: boolean
): boolean {
  const playersSelected = !!(player1Id && player2Id && player3Id);

  // If there's a sub, handicap must be selected (unless in tiebreaker mode)
  const row = { player1_id: player1Id, player2_id: player2Id, player3_id: player3Id };
  if (lineupHasSubstitute(row, 3) && !isTiebreakerMode) {
    return playersSelected && !!subHandicap;
  }

  return playersSelected;
}

/**
 * Check if lineup has duplicate nicknames
 *
 * @param player1Id - First player ID
 * @param player2Id - Second player ID
 * @param player3Id - Third player ID
 * @param players - Array of available players
 * @returns True if any two players have the same nickname
 */
export function hasDuplicateNicknames(
  player1Id: string,
  player2Id: string,
  player3Id: string,
  players: Player[]
): boolean {
  if (!player1Id || !player2Id || !player3Id) return false;

  const player1 = players.find((p) => p.id === player1Id);
  const player2 = players.find((p) => p.id === player2Id);
  const player3 = players.find((p) => p.id === player3Id);

  if (!player1 || !player2 || !player3) return false;

  const nickname1 = player1.nickname || '';
  const nickname2 = player2.nickname || '';
  const nickname3 = player3.nickname || '';

  // Check if any two nicknames match
  return (
    nickname1 === nickname2 ||
    nickname1 === nickname3 ||
    nickname2 === nickname3
  );
}

/**
 * Check if lineup can be locked
 *
 * @param player1Id - First player ID
 * @param player2Id - Second player ID
 * @param player3Id - Third player ID
 * @param subHandicap - Substitute handicap
 * @param players - Array of available players
 * @param isTiebreakerMode - Whether in tiebreaker mode (sub handicap already set)
 * @returns True if lineup can be locked
 */
export function canLockLineup(
  player1Id: string,
  player2Id: string,
  player3Id: string,
  subHandicap: string,
  players: Player[],
  isTiebreakerMode?: boolean
): boolean {
  return (
    isLineupComplete(player1Id, player2Id, player3Id, subHandicap, isTiebreakerMode) &&
    !hasDuplicateNicknames(player1Id, player2Id, player3Id, players)
  );
}
