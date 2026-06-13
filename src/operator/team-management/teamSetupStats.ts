/**
 * @fileoverview computeTeamSetupStats — pure derivations for the Manage Teams
 * surface: league type (in-house vs traveling), table capacity, the max-teams
 * ceiling, and whether an open BYE exists. Extracted from
 * `src/operator/TeamManagement.tsx` so the rules are testable in isolation.
 */

import type { LeagueVenue } from '@/types/venue';
import type { TeamWithQueryDetails } from '@/types/team';

export interface TeamSetupStats {
  /** Total tables available across all assigned venues. */
  totalCapacity: number;
  /** Exactly one venue assigned. */
  isInHouse: boolean;
  /** More than one venue assigned. */
  isTraveling: boolean;
  /** Max teams the capacity allows (in-house = 2 teams/table; traveling = 1). */
  maxTeams: number;
  /** Team count has reached the max. */
  isAtMaxTeams: boolean;
  /** The team list includes an open BYE row (odd-league reserved slot). */
  hasBye: boolean;
}

/**
 * Derive the Manage Teams capacity/type/bye stats from the assigned venues and
 * current teams.
 *
 * In-house leagues (1 venue) fit 2 teams per table since both teams play at the
 * same venue; traveling leagues (multiple venues) allow 1 home team per table.
 */
export function computeTeamSetupStats(
  leagueVenues: LeagueVenue[],
  teams: TeamWithQueryDetails[],
): TeamSetupStats {
  const totalCapacity = leagueVenues.reduce(
    (sum, lv) => sum + (lv.capacity ?? lv.available_table_numbers?.length ?? 0),
    0,
  );
  const isInHouse = leagueVenues.length === 1;
  const isTraveling = leagueVenues.length > 1;
  const maxTeams = isInHouse ? totalCapacity * 2 : totalCapacity;
  const isAtMaxTeams = teams.length >= maxTeams && maxTeams > 0;
  const hasBye = teams.some((t) => t.status === 'bye');

  return { totalCapacity, isInHouse, isTraveling, maxTeams, isAtMaxTeams, hasBye };
}
