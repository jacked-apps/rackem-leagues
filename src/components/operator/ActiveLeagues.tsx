/**
 * @fileoverview ActiveLeagues Component
 * Displays operator's active leagues with progress tracking
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLeaguesWithProgress } from '@/api/hooks';
import type { League } from '@/types/league';
import { buildLeagueTitle, getTimeOfYear } from '@/utils/leagueUtils';
import { parseLocalDate } from '@/utils/formatters';
import { LeagueStatusCard } from './LeagueStatusCard';
import { DeleteLeagueModal } from '@/components/modals/DeleteLeagueModal';
import { isNextSeasonRipe } from '@/utils/seasonLifecycle';

interface ActiveLeaguesProps {
  /** Operator ID to fetch leagues for */
  operatorId: string | null;
}

/**
 * ActiveLeagues Component
 *
 * Displays a list of the operator's active leagues with:
 * - League name and details
 * - Progress indicators (creation, season setup, active, etc.)
 * - Quick action buttons
 * - Empty state for no leagues
 */
export const ActiveLeagues: React.FC<ActiveLeaguesProps> = ({ operatorId }) => {
  const navigate = useNavigate();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState<{
    id: string;
    name: string;
  } | null>(null);
  // Track navigation loading state for lazy-loaded pages
  const [isNavigating, setIsNavigating] = useState(false);

  // Fetch leagues with progress data using TanStack Query
  const {
    data: leagues = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useLeaguesWithProgress(operatorId);

  const error = queryError ? 'Failed to load leagues' : null;

  /**
   * Generate display name for league
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
      year,
    });
  };

  /**
   * Handle delete button click - open modal
   */
  const handleDeleteClick = (e: React.MouseEvent, league: League) => {
    e.preventDefault(); // Prevent navigation
    e.stopPropagation(); // Stop event bubbling
    setSelectedLeague({ id: league.id, name: getLeagueName(league) });
    setDeleteModalOpen(true);
  };

  /**
   * Handle successful league deletion - refresh list
   */
  const handleDeleteSuccess = () => {
    setDeleteModalOpen(false);
    setSelectedLeague(null);

    // Refetch leagues data after deletion
    refetch();
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-card rounded-xl shadow-sm p-6">
        <h3 className="text-xl font-semibold text-foreground mb-6">
          Your Active Leagues
        </h3>
        <div className="text-center py-12">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-muted-foreground">Loading your leagues...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-card rounded-xl shadow-sm p-6">
        <h3 className="text-xl font-semibold text-foreground mb-6">
          Your Active Leagues
        </h3>
        <div className="text-center py-12">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-destructive mb-4">{error}</p>
          <Button loadingText="none" onClick={() => window.location.reload()} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Empty state
  if (leagues.length === 0) {
    return (
      <div className="bg-card rounded-xl shadow-sm p-6">
        <h3 className="text-xl font-semibold text-foreground mb-6">
          Your Active Leagues
        </h3>
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎱</div>
          <h4 className="text-lg font-medium text-foreground mb-2">
            No Active Leagues
          </h4>
          <p className="text-muted-foreground mb-6">
            You haven't created any leagues yet. Start by creating your first
            league!
          </p>
          <Button
            loadingText="Loading..."
            isLoading={isNavigating}
            onClick={() => {
              setIsNavigating(true);
              navigate(`/create-league/${operatorId}`);
            }}
            disabled={isNavigating}
          >
            Create Your First League
          </Button>
        </div>
      </div>
    );
  }

  // Leagues list
  return (
    <div className="lg:bg-card lg:rounded-xl lg:shadow-sm px-2">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold text-foreground">
          Your Active Leagues
        </h3>
        <div className="flex gap-2">
          <Button
            loadingText="Loading..."
            isLoading={isNavigating}
            onClick={() => {
              setIsNavigating(true);
              navigate(`/create-league/${operatorId}`);
            }}
            disabled={isNavigating}
          >
            Create New League
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {leagues.map((league) => {
          // Subtle hint badge: this league is ripe for starting the
          // next season (last 2 weeks of current season OR previous
          // season completed). Click takes the operator to the league
          // page where the full ActionCard "Create Next Season" CTA
          // lives — the org page lists many leagues, so the badge is
          // intentionally low-chrome to avoid noise.
          const progress = (league as { _progress?: { activeSeason?: { end_date?: string | null }; seasonCount?: number; hasScheduledSeason?: boolean } })._progress;
          const seasonRipe = isNextSeasonRipe(
            progress?.activeSeason ?? null,
            progress?.seasonCount ?? 0,
            progress?.hasScheduledSeason ?? false,
          );

          return (
            <div
              key={league.id}
              className="border-2 border-warning/40 rounded-lg hover:border-warning/60 hover:shadow-md transition-all bg-warning/10 overflow-hidden"
            >
              <div className="flex justify-between items-start p-4 pb-0">
                <Link to={`/league/${league.id}`} className="flex-1">
                  <h4 className="font-semibold text-foreground text-lg hover:text-warning transition-colors flex items-center gap-2 flex-wrap">
                    {getLeagueName(league)}
                    {seasonRipe && (
                      <span
                        className="text-xs font-medium bg-info/10 text-info px-2 py-0.5 rounded-full"
                        data-testid="next-season-ripe-badge"
                      >
                        📅 Plan next season
                      </span>
                    )}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {/* Phase 7 Unit 7.3: roster-format label dropped from
                        the summary card — `team_format` no longer exists
                        on the leagues table. The league detail page shows
                        lineup size via the resolved preferences. */}
                    Started{' '}
                    {parseLocalDate(
                      league.league_start_date
                    ).toLocaleDateString()}
                  </p>
                </Link>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => handleDeleteClick(e, league)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/40"
                >
                  Delete
                </Button>
              </div>

              {/* Unified status card */}
              <Link to={`/league/${league.id}`} className="block">
                <div className="p-4 pt-2">
                  <LeagueStatusCard league={league} variant="card" />
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      {/* Delete League Modal */}
      {selectedLeague && (
        <DeleteLeagueModal
          isOpen={deleteModalOpen}
          onCancel={() => {
            setDeleteModalOpen(false);
            setSelectedLeague(null);
          }}
          onSuccess={handleDeleteSuccess}
          leagueId={selectedLeague.id}
          leagueName={selectedLeague.name}
        />
      )}
    </div>
  );
};
