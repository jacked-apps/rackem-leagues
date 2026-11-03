/**
 * @fileoverview useAnnouncementTargets Hook
 *
 * Custom hook for fetching announcement targets (leagues and organizations).
 * Fetches leagues where user is a captain and organizations for operators.
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/supabaseClient';
import { logger } from '@/utils/logger';

export interface AnnouncementTarget {
  id: string;
  name: string;
  type: 'league' | 'organization';
  season_id?: string;
  season_name?: string;
}

export function useAnnouncementTargets(
  currentUserId: string,
  canAccessOperatorFeatures: boolean
) {
  const [targets, setTargets] = useState<AnnouncementTarget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnnouncementTargets() {
      const allTargets: AnnouncementTarget[] = [];

      // Get teams where user is captain
      const { data: captainTeams, error: teamsError } = await supabase
        .from('team_players')
        .select('team_id, teams!inner(id, league_id, season_id)')
        .eq('member_id', currentUserId)
        .eq('is_captain', true);

      if (teamsError) {
        logger.error('Error fetching captain leagues', { error: teamsError.message });
        setLoading(false);
        return;
      }

      // Get unique league and season IDs
      const leagueSeasonPairs = new Map<string, { leagueId: string; seasonId: string }>();

      (captainTeams || []).forEach((item) => {
        const team = item.teams;
        const leagueId = team.league_id;
        const seasonId = team.season_id;

        if (!leagueSeasonPairs.has(leagueId)) {
          leagueSeasonPairs.set(leagueId, { leagueId, seasonId });
        }
      });

      // Fetch league targets
      const leaguePromises = Array.from(leagueSeasonPairs.values()).map(
        async ({ leagueId, seasonId }) => {
          // Fetch league data
          const { data: league, error: leagueError } = await supabase
            .from('leagues')
            .select('id, game_type, day_of_week, division, league_start_date')
            .eq('id', leagueId)
            .single();

          if (leagueError) {
            logger.error('Error fetching league', { error: leagueError.message });
            return null;
          }

          // Fetch season data
          const { data: season, error: seasonError } = await supabase
            .from('seasons')
            .select('id, season_name')
            .eq('id', seasonId)
            .single();

          if (seasonError) {
            logger.error('Error fetching season', { error: seasonError.message });
            return null;
          }

          if (!league || !season) return null;

          // Build simple league display name from available data
          const gameNames: Record<string, string> = {
            eight_ball: '8-Ball',
            nine_ball: '9-Ball',
            ten_ball: '10-Ball',
          };
          const gameName = gameNames[league.game_type] || league.game_type;
          const dayName = league.day_of_week.charAt(0).toUpperCase() + league.day_of_week.slice(1);
          const divisionPart = league.division ? ` (${league.division})` : '';
          const leagueName = `${gameName} ${dayName}${divisionPart}`;

          return {
            id: leagueId,
            name: leagueName,
            type: 'league' as const,
            season_id: seasonId,
            season_name: season.season_name,
          };
        }
      );

      const leagueTargets = (await Promise.all(leaguePromises)).filter((t) => t !== null);
      allTargets.push(...leagueTargets);

      // Fetch organization targets (if user has operator access)
      if (canAccessOperatorFeatures) {
        const { data: staffData } = await supabase
          .from('organization_staff')
          .select('organization_id, organizations!inner(id, organization_name)')
          .eq('member_id', currentUserId)
          .order('added_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (staffData && staffData.organizations) {
          const org = staffData.organizations;
          allTargets.push({
            id: org.id,
            name: `${org.organization_name} (Organization)`,
            type: 'organization',
          });
        }
      }

      setTargets(allTargets);
      setLoading(false);
    }

    fetchAnnouncementTargets();
  }, [currentUserId, canAccessOperatorFeatures]);

  return { targets, loading };
}
