/**
 * @fileoverview Handicap Query Functions
 *
 * Functions for getting handicap thresholds.
 * Routes to the correct chart based on handicapType.
 */

import { getGamesNeeded } from '@/utils/handicap';
import type { HandicapThresholds } from '@/types';

/**
 * Get handicap thresholds for 3v3 match
 * @deprecated Use getHandicapThresholds() with handicapType parameter instead
 */
export function getHandicapThresholds3v3(handicapDiff: number): HandicapThresholds {
  return getGamesNeeded(handicapDiff, 'points');
}

/**
 * Get handicap thresholds based on the league's handicap type.
 *
 * @param handicapDiff - Handicap difference between teams
 * @param handicapType - 'points', 'percentage', 'fargo', etc.
 * @returns Handicap thresholds (games_to_win, games_to_tie, games_to_lose)
 */
export function getHandicapThresholds(
  handicapDiff: number,
  handicapType: string
): HandicapThresholds {
  return getGamesNeeded(handicapDiff, handicapType);
}
