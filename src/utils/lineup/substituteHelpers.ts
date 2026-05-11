/**
 * @fileoverview Substitute Player Helpers
 *
 * Sentinel UUIDs encode the substitute type directly:
 *   - ANON sentinels mean "anonymous sub — final state, captain-entered handicap"
 *   - DD sentinels mean "double-duty — awaits opposing captain's OpponentSubstituteModal"
 *
 * This lets both clients discriminate sub type from persisted lineup state alone,
 * without a new column or ephemeral React state.
 */

// Anonymous-sub sentinels (canonical = current DB values; legacy aliases kept below)
export const SUB_HOME_ANON_ID = '00000000-0000-0000-0000-000000000001';
export const SUB_AWAY_ANON_ID = '00000000-0000-0000-0000-000000000002';

// Double-duty sentinels (new)
export const SUB_HOME_DD_ID = '00000000-0000-0000-0000-000000000011';
export const SUB_AWAY_DD_ID = '00000000-0000-0000-0000-000000000012';

// Legacy aliases kept for untouched callers. Prefer the helpers below for new code.
export const SUB_HOME_ID = SUB_HOME_ANON_ID;
export const SUB_AWAY_ID = SUB_AWAY_ANON_ID;

export function isAnonSubSentinel(playerId: string | null | undefined): boolean {
  return playerId === SUB_HOME_ANON_ID || playerId === SUB_AWAY_ANON_ID;
}

export function isDoubleDutySentinel(playerId: string | null | undefined): boolean {
  return playerId === SUB_HOME_DD_ID || playerId === SUB_AWAY_DD_ID;
}

export function isAnySubSentinel(playerId: string | null | undefined): boolean {
  return isAnonSubSentinel(playerId) || isDoubleDutySentinel(playerId);
}

/** Legacy: kept for callers that haven't been migrated. New code: use isAnySubSentinel. */
export function isSubstitute(playerId: string | null | undefined): boolean {
  return isAnySubSentinel(playerId);
}

export function getAnonSubId(isHomeTeam: boolean): string {
  return isHomeTeam ? SUB_HOME_ANON_ID : SUB_AWAY_ANON_ID;
}

export function getDoubleDutySubId(isHomeTeam: boolean): string {
  return isHomeTeam ? SUB_HOME_DD_ID : SUB_AWAY_DD_ID;
}

/** Legacy: returns the ANON sentinel for this team. Prefer the explicit helpers above. */
export function getSubstituteId(isHomeTeam: boolean): string {
  return getAnonSubId(isHomeTeam);
}

/**
 * Does any slot in this lineup hold a sub sentinel (anon or DD)?
 * Iterates positions 1..lineupSize from a lineup-row-shaped object.
 */
export function lineupHasSubstitute(
  lineupRow: Record<string, unknown>,
  lineupSize: number
): boolean {
  for (let pos = 1; pos <= lineupSize; pos++) {
    const id = lineupRow[`player${pos}_id`];
    if (typeof id === 'string' && isAnySubSentinel(id)) return true;
  }
  return false;
}

/** Does any slot hold an unresolved double-duty placeholder? */
export function lineupHasDoubleDuty(
  lineupRow: Record<string, unknown>,
  lineupSize: number
): boolean {
  for (let pos = 1; pos <= lineupSize; pos++) {
    const id = lineupRow[`player${pos}_id`];
    if (typeof id === 'string' && isDoubleDutySentinel(id)) return true;
  }
  return false;
}

/**
 * Calculate the handicap for an anonymous substitute player.
 *
 * Rule: Sub handicap = MAX(captain-entered value, highest unused player handicap).
 * Prevents captains from sandbagging by picking a very low sub value while keeping
 * a high-handicap player on the bench.
 */
export function calculateSubstituteHandicap(
  usedPlayerIds: string[],
  allPlayers: Array<{ id: string; handicap?: number }>,
  subHandicapValue: number
): number {
  const nonSubUsedIds = usedPlayerIds.filter((id) => !isAnySubSentinel(id));
  const unusedPlayers = allPlayers.filter((p) => !nonSubUsedIds.includes(p.id));
  const highestUnused = unusedPlayers.length > 0
    ? Math.max(...unusedPlayers.map((p) => p.handicap || 0))
    : 0;
  return Math.max(subHandicapValue, highestUnused);
}
