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
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">
          Your Active Leagues
        </h3>
        <div className="text-center py-12">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-600">Loading your leagues...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">
          Your Active Leagues
        </h3>
        <div className="text-center py-12">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-red-600 mb-4">{error}</p>
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
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">
          Your Active Leagues
        </h3>
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎱</div>
          <h4 className="text-lg font-medium text-gray-900 mb-2">
            No Active Leagues
          </h4>
          <p className="text-gray-600 mb-6">
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
    <div className="lg:bg-white lg:rounded-xl lg:shadow-sm px-2">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold text-gray-900">
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
          return (
            <div
              key={league.id}
              className="border-2 border-orange-300 rounded-lg hover:border-orange-400 hover:shadow-md transition-all bg-orange-50/30 overflow-hidden"
            >
              <div className="flex justify-between items-start p-4 pb-0">
                <Link to={`/league/${league.id}`} className="flex-1">
                  <h4 className="font-semibold text-gray-900 text-lg hover:text-orange-600 transition-colors">
                    {getLeagueName(league)}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {league.team_format === '5_man'
                      ? '5-Man Roster'
                      : '8-Man Roster'}{' '}
                    • Started{' '}
                    {parseLocalDate(
                      league.league_start_date
                    ).toLocaleDateString()}
                  </p>
                </Link>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => handleDeleteClick(e, league)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300"
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
