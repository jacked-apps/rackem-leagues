/**
 * @fileoverview Team Management Data Hook
 *
 * Custom hook for fetching and managing team-related data.
 * Handles all data fetching for leagues, venues, teams, members, and seasons.
 */

import { useState, useEffect, useMemo } from 'react';
import { fetchTeamsWithDetails } from '@/api/hooks';
import {
  useLeagueById,
  useVenuesByOperator,
  useLeagueVenues,
  useAllMembers,
  useActiveSeason,
  useMostRecentSeason,
  usePreviousCompletedSeason,
} from '@/api/hooks';
import { logger } from '@/utils/logger';
import type { UseTeamManagementReturn } from '@/types';
import type { TeamWithQueryDetails } from '@/types/team';

/**
 * Custom hook for managing team data
 *
 * Fetches and provides:
 * - League information
 * - Available venues
 * - League venue assignments
 * - Teams with full details
 * - Available members
 * - Current and previous season IDs
 *
 * @param operatorId - The operator's user ID
 * @param leagueId - The league ID to fetch data for
 * @returns Object containing all team management data and refresh function
 */
export function useTeamManagement(
  operatorId: string | null,
  leagueId: string | undefined
): UseTeamManagementReturn {
  // ============================================================================
  // TANSTACK QUERY HOOKS
  // ============================================================================

  // Fetch league data
  const {
    data: leagueData,
    isLoading: leagueLoading,
    error: leagueError,
  } = useLeagueById(leagueId);

  // Get organization ID from league (for fetching venues)
  const organizationId = leagueData?.organization_id || operatorId;

  // Fetch organization's venues
  const {
    data: venuesData = [],
    isLoading: venuesLoading,
    error: venuesError,
  } = useVenuesByOperator(organizationId);

  // Fetch league's assigned venues
  const {
    data: leagueVenuesData = [],
    isLoading: leagueVenuesLoading,
    error: leagueVenuesError,
  } = useLeagueVenues(leagueId);

  // Fetch all members
  const {
    data: membersData = [],
    isLoading: membersLoading,
    error: membersError,
  } = useAllMembers();

  // Fetch active season
  const {
    data: activeSeasonData,
    isLoading: seasonLoading,
    error: seasonError,
  } = useActiveSeason(leagueId);

  // Fetch most recent season (any status - for team management)
  // Teams can be added to upcoming, active, or completed seasons
  const {
    data: mostRecentSeasonData,
    isLoading: mostRecentSeasonLoading,
    error: mostRecentSeasonError,
  } = useMostRecentSeason(leagueId);

  // Fetch previous completed season (before active season)
  const {
    data: previousSeasonData,
    isLoading: prevSeasonLoading,
  } = usePreviousCompletedSeason(leagueId, activeSeasonData?.created_at);

  // ============================================================================
  // LOCAL STATE (for data that still needs useEffect/useState)
  // ============================================================================

  const [teams, setTeams] = useState<TeamWithQueryDetails[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);

  // ============================================================================
  // DERIVED DATA
  // ============================================================================

  const league = leagueData || null;
  const venues = venuesData;
  const leagueVenues = leagueVenuesData; // Use TanStack Query data directly
  const members = membersData;
  // Use most recent season for team management (can be upcoming, active, or completed)
  const seasonId = mostRecentSeasonData?.id || null;
  const previousSeasonId = previousSeasonData?.id || null;

  // Combined loading state
  const loading = leagueLoading || venuesLoading || leagueVenuesLoading || membersLoading || seasonLoading || mostRecentSeasonLoading || prevSeasonLoading || teamsLoading;

  // Combined error state
  const error = useMemo(() => {
    if (leagueError) return leagueError.message || 'Failed to load league';
    if (venuesError) return venuesError.message || 'Failed to load venues';
    if (leagueVenuesError) return leagueVenuesError.message || 'Failed to load league venues';
    if (membersError) return membersError.message || 'Failed to load members';
    if (seasonError) return seasonError.message || 'Failed to load season';
    if (mostRecentSeasonError) return mostRecentSeasonError.message || 'Failed to load season';
    return null;
  }, [leagueError, venuesError, leagueVenuesError, membersError, seasonError, mostRecentSeasonError]);

  // ============================================================================
  // DATA FETCHING (for data not yet in TanStack Query)
  // ============================================================================

  /**
   * Fetch teams
   * TODO: Migrate teams to TanStack Query
   */
  useEffect(() => {
    if (!leagueId) {
      setTeamsLoading(false);
      return;
    }

    const fetchTeams = async () => {
      try {
        setTeamsLoading(true);

        // Fetch teams with captain info, roster details, and venue. Include the
        // BYE row so the operator can SEE it (a hidden bye is how LOs end up
        // adding a redundant team to an odd league).
        const { data: teamsData, error: teamsError } = await fetchTeamsWithDetails(leagueId, { includeBye: true });
        if (teamsError) throw teamsError;
        setTeams(teamsData || []);

      } catch (err) {
        logger.error('Error fetching teams', {
          error: err instanceof Error ? err.message : String(err),
          leagueId
        });
      } finally {
        setTeamsLoading(false);
      }
    };

    fetchTeams();
  }, [leagueId, mostRecentSeasonData, previousSeasonData]);

  /**
   * Refresh teams list (useful after create/update/delete)
   */
  const refreshTeams = async () => {
    if (!leagueId) return;

    try {
      const { data: teamsData, error: teamsError } = await fetchTeamsWithDetails(leagueId, { includeBye: true });

      if (teamsError) throw teamsError;
      setTeams(teamsData || []);
    } catch (err) {
      logger.error('Error refreshing teams', {
        error: err instanceof Error ? err.message : String(err),
        leagueId
      });
    }
  };

  return {
    league,
    venues,
    leagueVenues,
    teams,
    members, // Now correctly typed as PartialMember[]
    seasonId,
    previousSeasonId,
    loading,
    error,
    refreshTeams,
    // TODO: Remove this setter - should use TanStack Query mutations/invalidations instead
    setTeams,
  };
}
