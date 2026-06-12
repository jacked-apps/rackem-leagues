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
import type { Season } from '@/types/season';
import { parseLocalDate } from '@/utils/formatters';
import { buildLeagueTitle, getTimeOfYear } from '@/utils/leagueUtils';
import { PageHeader } from '@/components/PageHeader';
import { InfoButton } from '@/components/InfoButton';
import { LeagueStatusCard } from '@/components/operator/LeagueStatusCard';
import { useResolvedLeaguePrefs } from '@/api/hooks/useResolvedLeaguePrefs';
import { logger } from '@/utils/logger';
import { SeasonCard } from '@/components/operator/SeasonCard';
import { MatchupsCard } from '@/components/operator/MatchupsCard';
import { LeagueReupStatusCard } from '@/components/operator/LeagueReupStatusCard';
import { TeamsCard } from '@/components/operator/TeamsCard';
import { ScheduleCard } from '@/components/operator/ScheduleCard';
import { StatsCard } from '@/components/operator/StatsCard';
import { PlayoffsCard } from '@/components/operator/PlayoffsCard';
import { OnboardCaptainsList } from '@/onboarding/OnboardCaptainsList';
import { JoinRequestList } from '@/onboarding/components/JoinRequestList';
import { Button } from '@/components/ui/button';
import { DashboardCard } from '@/components/operator/DashboardCard';
import { Calendar, DollarSign, Settings, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useIsWizard2League, useFlowStageDetection } from '@/api/hooks';
import { useDeleteSeason } from '@/api/hooks/useSeasonMutations';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { isNextSeasonRipe } from '@/utils/seasonLifecycle';

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
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  // `scheduledSeason` is a season the operator already set up that hasn't
  // started yet (status='scheduled'). Rendered as a second "Next season"
  // panel alongside the current one so the operator knows it's queued.
  const [scheduledSeason, setScheduledSeason] = useState<Season | null>(null);
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

        // Fetch the currently-active season (if any) — there should be
        // at most one row with status='active' per league once the new
        // 'scheduled' lifecycle is in place.
        const { data: activeSeasonData } = await supabase
          .from('seasons')
          .select('*')
          .eq('league_id', leagueId)
          .eq('status', 'active')
          .maybeSingle();
        if (activeSeasonData) setActiveSeason(activeSeasonData as unknown as Season);

        // Fetch the queued (next) season if one exists. Earliest
        // start_date wins if there are multiples (shouldn't happen
        // under normal use, but defensive).
        const { data: scheduledSeasonData } = await supabase
          .from('seasons')
          .select('*')
          .eq('league_id', leagueId)
          .eq('status', 'scheduled')
          .order('start_date', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (scheduledSeasonData) setScheduledSeason(scheduledSeasonData as unknown as Season);
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
            <h3 className="text-destructive text-lg font-semibold mb-4">Error</h3>
            <p className="text-foreground mb-4">{error || 'League not found'}</p>
            <Button
              onClick={() => navigate(league?.organization_id ? `/operator-dashboard/${league.organization_id}` : '/my-teams')}
              loadingText="none"
            >
              Back to Dashboard
            </Button>
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
        {/* Top of page: League Status + League Overview are the first two
            cards. ActionCard renders below them only when there's something to
            do (it returns null once the league is set up and in session). */}
        <div className="mb-6">
          <LeagueStatusCard league={league} variant="section" />
        </div>

        {/* Setup / next-season CTA. Self-hides (null) when the league is fully
            set up and a season is in session with no next-season prompt. */}
        <div className="mb-6">
          <ActionCard
            league={league}
            seasonCount={seasonCount}
            activeSeason={activeSeason}
            scheduledSeason={scheduledSeason}
            isNavigating={isNavigating}
            setIsNavigating={setIsNavigating}
            navigate={navigate}
          />
        </div>

        {/* Next-season banner — visible only when the operator has
            already set up the next season (status='scheduled', start
            date in the future). Tells them "yes, you finished the
            wizard, it's queued, here's when it goes live." */}
        {scheduledSeason && league && (
          <NextSeasonBanner
            season={scheduledSeason}
            leagueId={league.id}
            onCancelled={() => setScheduledSeason(null)}
          />
        )}

        {/* Re-up Status — only renders when the league's active season
            is in its last 3 weeks; otherwise the card returns null and
            takes up no space. */}
        <LeagueReupStatusCard leagueId={league.id} />

        {/* Stats & Standings (only shown if active season exists) */}
        <StatsCard leagueId={league.id} seasonId={activeSeason?.id || null} />

        {/* The four league parts, grouped in setup order. */}
        <SeasonCard league={league} />
        {/* Captain-onboarding list — sits with Teams; self-clears as captains
            register. Restored after a merge (#192's restructure) dropped it. */}
        <OnboardCaptainsList leagueId={league.id} />

        {/* Pending join requests for THIS league — the per-league approval
            surface. Stays visible (empty state) so the operator can see it. */}
        <JoinRequestList
          title="Join requests"
          leagueId={league.id}
          emptyHint="No pending join requests for this league yet. When a captain or player taps their invite link and asks to join, they'll appear here to approve."
        />
        <TeamsCard leagueId={league.id} />
        <ScheduleCard leagueId={league.id} />
        <MatchupsCard league={league} />

        {/* Playoffs Section */}
        <PlayoffsCard leagueId={league.id} seasonId={activeSeason?.id || null} />

        {/* Admin links live at the bottom — League Settings, then Finances. */}
        <div className="mb-6">
          <DashboardCard
            icon={<Settings className="h-6 w-6" />}
            iconColor="text-primary"
            title="League Settings"
            description="Configure handicap, format, and match rules for this league"
            buttonText="Manage League"
            linkTo={`/league/${league.id}/settings`}
          />
        </div>

        {/* Finances entry — lives on its own page so the league
            detail stays focused on season-running bits. Not every
            operator uses payouts/expenses, so we hide the cards
            behind a single link rather than render them inline. */}
        <div className="mb-6">
          <DashboardCard
            icon={<DollarSign className="h-6 w-6" />}
            iconColor="text-emerald-600"
            title="Finances"
            description="Track expenses, dropped teams, projected income, and calculate end-of-season payouts."
            buttonText="Open Finances"
            linkTo={`/league/${league.id}/finances`}
          />
        </div>
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
  activeSeason,
  scheduledSeason,
  isNavigating,
  setIsNavigating,
  navigate,
}: {
  league: League;
  seasonCount: number;
  activeSeason: { end_date?: string | null; status?: string } | null;
  scheduledSeason: { id?: string; start_date?: string; season_name?: string } | null;
  isNavigating: boolean;
  setIsNavigating: (v: boolean) => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const isV2 = useIsWizard2League(league.id);
  const { firstIncompleteStage } = useFlowStageDetection(league.id);
  const flowComplete = firstIncompleteStage >= 5;
  const showContinueSetup = isV2 && !flowComplete;

  // "Create Next Season" takes priority over the generic "Let's Go" CTA
  // when the league is in the natural end-of-season window. Setup-in-
  // progress takes priority over everything (mid-wizard users haven't
  // even launched their first season yet).
  // hasScheduledSeason short-circuits the ripe check — if the next
  // season is already queued, the operator doesn't need a "create
  // next season" prompt.
  const showStartNextSeason =
    !showContinueSetup && isNextSeasonRipe(activeSeason, seasonCount, !!scheduledSeason);

  const STAGE_LABELS = ['League', 'Season', 'Schedule', 'Teams', 'Matchups'];
  const nextStageName = STAGE_LABELS[firstIncompleteStage] ?? 'Setup';

  if (showStartNextSeason) {
    const hasActive = !!activeSeason;
    return (
      <div className="lg:bg-card lg:rounded-xl lg:shadow-sm p-6 flex flex-col items-center justify-center border-2 border-blue-200 bg-blue-50">
        <div className="text-6xl mb-4">📅</div>
        <h3 className="text-lg font-semibold text-foreground mb-2 text-center">
          Create Next Season
        </h3>
        <p className="text-sm text-muted-foreground mb-6 text-center">
          {hasActive
            ? "Your current season is wrapping up — get a head start on the next one."
            : "Roll forward into the next season — most of your teams will carry over."}
        </p>
        <Button
          loadingText="Loading..."
          isLoading={isNavigating}
          onClick={() => {
            setIsNavigating(true);
            navigate(`/operator/start-next-season/${league.id}`);
          }}
          disabled={isNavigating}
          size="lg"
        >
          Create Next Season
        </Button>
      </div>
    );
  }

  // Nothing to do: the league is fully set up and a season is in session, with
  // no next-season prompt due. Don't render the 🚀 "Ready to Begin?" CTA — it's
  // setup-phase noise once the league is just running. (Continue-Setup and
  // Create-Next-Season above still render in their states.)
  if (!showContinueSetup && flowComplete && activeSeason) {
    return null;
  }

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
              // Route resume: if the league already has an active or
              // queued season, the in-progress build must be the
              // NEXT-season wizard (only that flow leaves an
              // upcoming season behind while the previous one's
              // still live). Sending the operator to the first-time
              // route would lose `previousSeasonVenueIds` /
              // `reupResponses` and they'd see empty venue + captain
              // editors — defeating the whole purpose of "Continue."
              const isNextSeasonResume = !!activeSeason || !!scheduledSeason;
              navigate(
                isNextSeasonResume
                  ? `/operator/start-next-season/${league.id}`
                  : `/create-league/${league.organization_id}?leagueId=${league.id}`,
              );
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

/**
 * Shows up at the top of the league page when a season is queued
 * (status='scheduled'): wizard finished, but start_date hasn't arrived
 * yet. Distinct from the current active season so the LO sees both
 * side by side instead of wondering "which season am I looking at?"
 *
 * Action buttons let the LO View Schedule, Manage Teams, or Cancel the
 * queued season before it goes live — completing the wizard's loop so
 * the next season isn't a black box after the wizard finishes.
 */
function NextSeasonBanner({
  season,
  leagueId,
  onCancelled,
}: {
  season: { id: string; season_name?: string; start_date?: string };
  leagueId: string;
  onCancelled: () => void;
}) {
  const navigate = useNavigate();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();
  const deleteSeason = useDeleteSeason();
  const [isCancelling, setIsCancelling] = useState(false);

  const startLabel = season.start_date
    ? parseLocalDate(season.start_date).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'an upcoming date';

  const handleCancel = async () => {
    const ok = await confirm({
      title: 'Cancel this queued season?',
      message:
        'The season will be marked as cancelled. Its schedule weeks and teams stay in the database for historical record, but the season will no longer go live on its start date.\n\nYou\'ll be able to start a fresh next-season wizard afterward.',
      confirmText: 'Yes, cancel season',
      cancelText: 'Keep it',
      confirmVariant: 'destructive',
    });
    if (!ok) return;
    setIsCancelling(true);
    try {
      await deleteSeason.mutateAsync({ seasonId: season.id });
      toast.success('Queued season cancelled.');
      onCancelled();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel season');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="mb-6 rounded-lg border-2 border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-4">
      <div className="flex items-start gap-3">
        <div className="text-2xl">🔵</div>
        <div className="flex-1 space-y-3">
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-200">
              Next season queued
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">
              <strong>{season.season_name ?? 'A new season'}</strong> is all
              set up and goes live on <strong>{startLabel}</strong>. Players
              won&rsquo;t see it until then.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              loadingText="none"
              onClick={() =>
                navigate(`/league/${leagueId}/season/${season.id}/schedule`)
              }
            >
              <Calendar className="size-4" />
              View Schedule
            </Button>
            <Button
              variant="outline"
              loadingText="none"
              onClick={() => navigate(`/league/${leagueId}/manage-teams`)}
            >
              <Users className="size-4" />
              Manage Teams
            </Button>
            <Button
              variant="destructive"
              loadingText="Cancelling"
              isLoading={isCancelling}
              onClick={handleCancel}
              disabled={isCancelling}
            >
              Cancel Season
            </Button>
          </div>
        </div>
      </div>
      {ConfirmDialogComponent}
    </div>
  );
}

export default LeagueDetail;
