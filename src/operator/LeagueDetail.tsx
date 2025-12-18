/**
 * @fileoverview League Detail Page
 *
 * Central hub for managing a specific league - shows overview, status, seasons,
 * teams, schedule, standings, and all league-specific settings.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import type { League } from '@/types/league';
import { parseLocalDate } from '@/utils/formatters';
import { buildLeagueTitle, getTimeOfYear } from '@/utils/leagueUtils';
import { PageHeader } from '@/components/PageHeader';
import { InfoButton } from '@/components/InfoButton';
import { LeagueStatusCard } from '@/components/operator/LeagueStatusCard';
import { logger } from '@/utils/logger';
import { LeagueOverviewCard } from '@/components/operator/LeagueOverviewCard';
import { TeamsCard } from '@/components/operator/TeamsCard';
import { ScheduleCard } from '@/components/operator/ScheduleCard';
import { StatsCard } from '@/components/operator/StatsCard';
import { PlayoffsCard } from '@/components/operator/PlayoffsCard';
import { Button } from '@/components/ui/button';
import { DashboardCard } from '@/components/operator/DashboardCard';
import { Settings } from 'lucide-react';

/**
 * League Detail Component
 *
 * Displays comprehensive information about a specific league including:
 * - Overview (game type, day, format, dates)
 * - Current status and next steps
 * - Seasons (current and historical)
 * - Teams enrolled
 * - Schedule and standings
 * - Player roster
 * - League-specific settings
 */
export const LeagueDetail: React.FC = () => {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();

  const [league, setLeague] = useState<League | null>(null);
  const [seasonCount, setSeasonCount] = useState(0);
  const [activeSeason, setActiveSeason] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Track navigation loading state for lazy-loaded pages
  const [isNavigating, setIsNavigating] = useState(false);

  /**
   * Fetch league details, season count, team count, player count, and schedule status on mount
   */
  useEffect(() => {
    const fetchLeague = async () => {
      if (!leagueId) {
        setError('No league ID provided');
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('leagues')
          .select('*')
          .eq('id', leagueId)
          .single();

        if (error) throw error;

        setLeague(data);

        // Fetch season count
        const { count: seasonCountResult } = await supabase
          .from('seasons')
          .select('*', { count: 'exact', head: true })
          .eq('league_id', leagueId);
        setSeasonCount(seasonCountResult || 0);

        // Fetch active season (if any)
        const { data: activeSeasonData } = await supabase
          .from('seasons')
          .select('*')
          .eq('league_id', leagueId)
          .eq('status', 'active')
          .maybeSingle();

        if (activeSeasonData) {
          setActiveSeason(activeSeasonData);
        }
      } catch (err) {
        logger.error('Error fetching league', { error: err instanceof Error ? err.message : String(err) });
        setError('Failed to load league details');
      } finally {
        setLoading(false);
      }
    };

    fetchLeague();
  }, [leagueId]);

  /**
   * Generate display name for league using helper function
   */
  const getLeagueName = (league: League): string => {
    const startDate = parseLocalDate(league.league_start_date);
    const season = getTimeOfYear(startDate);
    const year = startDate.getFullYear();

    return buildLeagueTitle({
      gameType: league.game_type,
      dayOfWeek: league.day_of_week,
      division: league.division,
      season,
      year
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="text-center text-gray-600">Loading league details...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !league) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-red-600 text-lg font-semibold mb-4">Error</h3>
            <p className="text-gray-700 mb-4">{error || 'League not found'}</p>
            <button
              onClick={() => navigate(league?.organization_id ? `/operator-dashboard/${league.organization_id}` : '/dashboard')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        backTo={`/operator-dashboard/${league.organization_id}`}
        backLabel="Back to Dashboard"
        title={getLeagueName(league)}
      >
        <div className="flex items-center gap-3 mt-1">
          <span className="text-md lg:text-xl text-gray-600">
            {league.team_format === '5_man' ? '5-Man Roster' : '8-Man Roster'}
          </span>
          {league.team_format === '5_man' && (
            <InfoButton
              title="Double Round Robin Format"
              label="RRx2"
            >
              <div className="space-y-2">
                <p>• Teams have 5 players on their roster</p>
                <p>• Match lineup: 3 players vs 3 players</p>
                <p>• Each player plays each opposing player twice (once breaking, once racking)</p>
                <p>• Total: 6 games per match (3 breaking, 3 racking)</p>
              </div>
            </InfoButton>
          )}
          <span className="text-md lg:text-xl text-gray-600">
            • Started {parseLocalDate(league.league_start_date).toLocaleDateString()}
          </span>
        </div>
      </PageHeader>

      <div className="container mx-auto lg:px-4 w-full lg:max-w-7xl py-8">
        {/* Status and Progress */}
        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          {/* Use unified LeagueStatusCard component */}
          <LeagueStatusCard league={league} variant="section" />

          {/* Action Button - 1 column */}
          <div className="lg:bg-white lg:rounded-xl lg:shadow-sm p-6 flex flex-col items-center justify-center">
            <div className="text-6xl mb-4">🚀</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">Ready to Begin?</h3>
            <p className="text-sm text-gray-600 mb-6 text-center">
              {seasonCount === 0
                ? 'Create your first season to get started'
                : 'Manage venues and teams for your league'
              }
            </p>
            <Button
              loadingText="Loading..."
              isLoading={isNavigating}
              onClick={() => {
                setIsNavigating(true);
                navigate(seasonCount === 0 ? `/league/${league.id}/create-season` : `/league/${league.id}/manage-teams`);
              }}
              disabled={isNavigating}
              size="lg"
            >
              Let's Go!
            </Button>
          </div>
        </div>

        {/* Stats & Standings (only shown if active season exists) */}
        <StatsCard leagueId={league.id} seasonId={activeSeason?.id || null} />

        {/* League Overview */}
        <LeagueOverviewCard league={league} />

        {/* League Settings */}
        <div className="mb-6">
          <DashboardCard
            icon={<Settings className="h-6 w-6" />}
            iconColor="text-indigo-600"
            title="League Settings"
            description="Configure handicap, format, and match rules for this league"
            buttonText="Manage League"
            linkTo={`/league/${league.id}/settings`}
          />
        </div>

        {/* Teams Section */}
        <TeamsCard leagueId={league.id} />

        {/* Schedule Section */}
        <ScheduleCard leagueId={league.id} />

        {/* Playoffs Section */}
        <PlayoffsCard leagueId={league.id} seasonId={activeSeason?.id || null} />
      </div>
    </div>
  );
};

export default LeagueDetail;
