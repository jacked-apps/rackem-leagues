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
import { useResolvedLeaguePrefs } from '@/api/hooks/useResolvedLeaguePrefs';
import { logger } from '@/utils/logger';
import { LeagueOverviewCard } from '@/components/operator/LeagueOverviewCard';
import { TeamsCard } from '@/components/operator/TeamsCard';
import { ScheduleCard } from '@/components/operator/ScheduleCard';
import { StatsCard } from '@/components/operator/StatsCard';
import { PlayoffsCard } from '@/components/operator/PlayoffsCard';
import { Button } from '@/components/ui/button';
import { DashboardCard } from '@/components/operator/DashboardCard';
import { Settings } from 'lucide-react';
import { useIsWizard2League, useFlowStageDetection } from '@/api/hooks';

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
  const { data: leaguePrefs } = useResolvedLeaguePrefs(league?.id);
  const lineupSize = leaguePrefs?.lineup_size;
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
      <div className="min-h-screen bg-muted py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="text-center text-muted-foreground">Loading league details...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !league) {
    return (
      <div className="min-h-screen bg-muted py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="bg-card rounded-xl shadow-sm p-6">
            <h3 className="text-red-600 text-lg font-semibold mb-4">Error</h3>
            <p className="text-foreground mb-4">{error || 'League not found'}</p>
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
    <div className="min-h-screen bg-muted">
      <PageHeader
        backTo={`/operator-dashboard/${league.organization_id}`}
        backLabel="Back to Dashboard"
        title={getLeagueName(league)}
      >
        <div className="flex items-center gap-3 mt-1">
          <span className="text-md lg:text-xl text-muted-foreground">
            {lineupSize === 3 ? '3v3 Lineup' : lineupSize === 5 ? '5v5 Lineup' : `${lineupSize ?? '?'}v${lineupSize ?? '?'} Lineup`}
          </span>
          {lineupSize === 3 && (
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
          <span className="text-md lg:text-xl text-muted-foreground">
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
          <ActionCard
            league={league}
            seasonCount={seasonCount}
            isNavigating={isNavigating}
            setIsNavigating={setIsNavigating}
            navigate={navigate}
          />
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

/**
 * Action card — shows different buttons for v1 vs v2 leagues.
 * V2 leagues get a "Continue Setup" button that resumes the wizard flow.
 */
function ActionCard({
  league,
  seasonCount,
  isNavigating,
  setIsNavigating,
  navigate,
}: {
  league: League;
  seasonCount: number;
  isNavigating: boolean;
  setIsNavigating: (v: boolean) => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const isV2 = useIsWizard2League(league.id);
  const { firstIncompleteStage } = useFlowStageDetection(league.id);
  const flowComplete = firstIncompleteStage >= 5;
  const showContinueSetup = isV2 && !flowComplete;

  const STAGE_LABELS = ['League', 'Season', 'Schedule', 'Teams', 'Matchups'];
  const nextStageName = STAGE_LABELS[firstIncompleteStage] ?? 'Setup';

  return (
    <div className="lg:bg-card lg:rounded-xl lg:shadow-sm p-6 flex flex-col items-center justify-center">
      <div className="text-6xl mb-4">🚀</div>
      <h3 className="text-lg font-semibold text-foreground mb-2 text-center">
        {showContinueSetup ? 'Setup In Progress' : 'Ready to Begin?'}
      </h3>
      <p className="text-sm text-muted-foreground mb-6 text-center">
        {showContinueSetup
          ? `Next step: ${nextStageName} (Stage ${firstIncompleteStage + 1} of 5)`
          : seasonCount === 0
            ? 'Create your first season to get started'
            : 'Manage venues and teams for your league'
        }
      </p>
      <div className="flex flex-col gap-2">
        {showContinueSetup ? (
          <Button
            loadingText="Loading..."
            isLoading={isNavigating}
            onClick={() => {
              setIsNavigating(true);
              navigate(`/create-league/${league.organization_id}?leagueId=${league.id}`);
            }}
            disabled={isNavigating}
            size="lg"
          >
            Continue Setup
          </Button>
        ) : (
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
        )}
      </div>
    </div>
  );
}

export default LeagueDetail;
