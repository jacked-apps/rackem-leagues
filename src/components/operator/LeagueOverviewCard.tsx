/**
 * @fileoverview LeagueOverviewCard Component
 * Displays the current active season with team format information
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { Button } from '@/components/ui/button';
import { DeleteSeasonModal } from '@/components/modals/DeleteSeasonModal';
import type { League } from '@/types/league';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';

interface LeagueOverviewCardProps {
  /** League data to display */
  league: League;
}

interface Season {
  id: string;
  league_id: string;
  season_name: string;
  start_date: string;
  end_date: string;
  season_length: number;
  status: 'active' | 'completed' | 'upcoming';
  team_count?: number;
  week_count?: number;
  created_at: string;
}

/**
 * LeagueOverviewCard Component
 *
 * Displays:
 * - Current active season information
 * - Team format (5-Man or 8-Man)
 * - Season dates and team/week counts
 */
export const LeagueOverviewCard: React.FC<LeagueOverviewCardProps> = ({ league }) => {
  const navigate = useNavigate();
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasTeams, setHasTeams] = useState(false);
  const [hasSchedule, setHasSchedule] = useState(false);
  const [hasMatchups, setHasMatchups] = useState(false);
  const [currentPlayWeek, setCurrentPlayWeek] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  /**
   * Fetch the most recent season for this league (active or otherwise)
   * Shows season info even if no teams/schedule exist yet
   * Also checks if season has teams and schedule to determine if it's complete
   */
  useEffect(() => {
    // Clear all localStorage when landing on dashboard to prevent cross-league contamination
    localStorage.removeItem(`season-creation-${league.id}`);
    localStorage.removeItem(`season-wizard-step-${league.id}`);
    localStorage.removeItem('season-schedule-review');
    localStorage.removeItem('season-blackout-weeks');

    const fetchCurrentSeason = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('seasons')
          .select('*')
          .eq('league_id', league.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          // PGRST116 is "no rows returned" - not really an error
          throw error;
        }

        setCurrentSeason(data);

        // Check if season has teams
        if (data) {
          const { count: teamCount } = await supabase
            .from('teams')
            .select('*', { count: 'exact', head: true })
            .eq('season_id', data.id);

          setHasTeams((teamCount ?? 0) > 0);

          // Check if season has schedule (season_weeks)
          const { count: weekCount } = await supabase
            .from('season_weeks')
            .select('*', { count: 'exact', head: true })
            .eq('season_id', data.id);

          setHasSchedule((weekCount ?? 0) > 0);

          // Check if matchups have been generated (matches exist)
          const { count: matchCount } = await supabase
            .from('matches')
            .select('*', { count: 'exact', head: true })
            .eq('season_id', data.id);

          setHasMatchups((matchCount ?? 0) > 0);

          // Get current play week (count of completed regular weeks)
          const { count: completedWeeks } = await supabase
            .from('season_weeks')
            .select('*', { count: 'exact', head: true })
            .eq('season_id', data.id)
            .eq('week_type', 'regular')
            .eq('week_completed', true);

          setCurrentPlayWeek(completedWeeks ?? 0);
        }
      } catch (err) {
        logger.error('Error fetching current season', { error: err instanceof Error ? err.message : String(err) });
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentSeason();
  }, [league.id]);

  /**
   * Determine which edit options should be available based on season state
   * Implements the button matrix from EDIT-MODE-PLAN.md Phase 2
   */
  const getSeasonEditOptions = () => {
    // No season exists
    if (!currentSeason) {
      return { showCreate: true };
    }

    // Incomplete season (wizard not finished - no schedule yet)
    if (!hasSchedule) {
      return {
        showContinueSetup: true,
        showDelete: true,
      };
    }

    // Upcoming season (has schedule, not started yet)
    if (currentSeason.status === 'upcoming' && currentPlayWeek === 0) {
      return {
        showManageSchedule: true,
        showDelete: true,
      };
    }

    // Active season (in progress)
    if (currentSeason.status === 'active') {
      return {
        showManageSchedule: true,
      };
    }

    // Completed season
    if (currentSeason.status === 'completed') {
      return {
        showManageSchedule: true, // View only or limited edits
      };
    }

    return {};
  };

  /**
   * Navigate to wizard to create a new season
   */
  const handleCreateSeasonClick = () => {
    // Clear ALL localStorage keys related to season creation
    localStorage.removeItem(`season-creation-${league.id}`);
    localStorage.removeItem(`season-wizard-step-${league.id}`);
    localStorage.removeItem('season-schedule-review');
    localStorage.removeItem('season-blackout-weeks');
    setIsNavigating(true);
    navigate(`/league/${league.id}/create-season`);
  };

  /**
   * Navigate to wizard to continue incomplete season setup
   * Loads existing season data from database into localStorage
   */
  const handleContinueSetupClick = async () => {
    if (!currentSeason) return;

    try {
      // Fetch season_weeks to reconstruct championship dates and blackout weeks
      const { data: seasonWeeks, error } = await supabase
        .from('season_weeks')
        .select('*')
        .eq('season_id', currentSeason.id)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;

      // Build the SeasonFormData object from existing season
      const seasonFormData = {
        startDate: currentSeason.start_date,
        seasonLength: currentSeason.season_length?.toString() || '16',
        isCustomLength: ![10, 12, 14, 16, 18, 20].includes(currentSeason.season_length),
        bcaChoice: '',
        bcaStartDate: '',
        bcaEndDate: '',
        bcaIgnored: true, // Default to ignored
        apaChoice: '',
        apaStartDate: '',
        apaEndDate: '',
        apaIgnored: true, // Default to ignored
      };

      // Extract blackout weeks (excluding championship-related ones)
      // Championship weeks will be reconstructed from form data below
      const blackoutWeeks = (seasonWeeks || [])
        .filter(w => {
          // Only include blackout type weeks
          if (w.week_type !== 'blackout') return false;

          // Exclude championship-related blackouts (they'll be handled separately as championship dates)
          const weekName = w.week_name?.toLowerCase() || '';
          const isChampionship = weekName.includes('bca') ||
                                weekName.includes('apa') ||
                                weekName.includes('championship');

          return !isChampionship;
        })
        .map(w => ({
          weekNumber: 0,
          weekName: w.week_name,
          date: w.scheduled_date,
          type: 'week-off' as const,
          conflicts: [],
        }));

      // Check for BCA championship in week names
      const bcaWeeks = (seasonWeeks || []).filter(w =>
        w.week_name?.toLowerCase().includes('bca') ||
        w.week_name?.toLowerCase().includes('championship')
      );

      if (bcaWeeks.length > 0) {
        const bcaStart = bcaWeeks[0].scheduled_date;
        const bcaEnd = bcaWeeks[bcaWeeks.length - 1].scheduled_date;
        seasonFormData.bcaChoice = 'custom'; // Mark as custom since we don't know the original choice ID
        seasonFormData.bcaStartDate = bcaStart;
        seasonFormData.bcaEndDate = bcaEnd;
        seasonFormData.bcaIgnored = false;
      }

      // Check for APA championship in week names
      const apaWeeks = (seasonWeeks || []).filter(w =>
        w.week_name?.toLowerCase().includes('apa')
      );

      if (apaWeeks.length > 0) {
        const apaStart = apaWeeks[0].scheduled_date;
        const apaEnd = apaWeeks[apaWeeks.length - 1].scheduled_date;
        seasonFormData.apaChoice = 'custom';
        seasonFormData.apaStartDate = apaStart;
        seasonFormData.apaEndDate = apaEnd;
        seasonFormData.apaIgnored = false;
      }

      // Save form data to localStorage
      const STORAGE_KEY = `season-creation-${league.id}`;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seasonFormData));

      // Save blackout weeks to localStorage
      if (blackoutWeeks.length > 0) {
        localStorage.setItem('season-blackout-weeks', JSON.stringify(blackoutWeeks));
      }

      // DON'T load the schedule from database - let the wizard regenerate it fresh
      // The database might have incomplete/corrupted data
      // The wizard will regenerate the correct schedule based on:
      // - seasonFormData (start date, length, championships)
      // - blackoutWeeks (loaded above)
      // This ensures we always get a complete, correct schedule

      // Clear any old saved schedule
      localStorage.removeItem('season-schedule-review');

      // Determine which step to start at based on what data exists
      let startStep = 0;
      if (hasSchedule) {
        // Has complete schedule - go directly to review step (last step)
        startStep = 4; // Assuming: 0=start, 1=length, 2=BCA, 3=APA, 4=review
      } else if (seasonFormData.apaStartDate) {
        // Has APA dates - go to review step
        startStep = 4;
      } else if (seasonFormData.bcaStartDate) {
        // Has BCA dates - go to APA step
        startStep = 3;
      } else if (seasonFormData.seasonLength) {
        // Has season length - go to BCA step
        startStep = 2;
      } else if (seasonFormData.startDate) {
        // Has start date - go to season length step
        startStep = 1;
      }

      localStorage.setItem(`season-wizard-step-${league.id}`, startStep.toString());

      // Navigate to wizard with seasonId for tracking
      setIsNavigating(true);
      navigate(`/league/${league.id}/create-season?seasonId=${currentSeason.id}`);
    } catch (err) {
      logger.error('Error loading season data for Continue Setup', { error: err instanceof Error ? err.message : String(err) });
      toast.error('Failed to load season data. Please try again.');
    }
  };


  /**
   * Determine if season setup is complete. A season is only "Complete" once
   * matchups have been generated AND the LO has activated the season (via
   * Finish on the matchups wizard step). Before that, it's still Incomplete
   * even if teams + schedule exist.
   */
  const isSeasonComplete = (): boolean => {
    return hasTeams && hasSchedule && hasMatchups && currentSeason?.status === 'active';
  };

  /**
   * Get status badge info based on season completion
   */
  const getStatusBadge = () => {
    if (isSeasonComplete()) {
      return {
        text: currentSeason?.status === 'active' ? 'Active' : 'Complete',
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
      };
    } else {
      return {
        text: 'Incomplete',
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-800',
      };
    }
  };

  /**
   * Handle season deletion
   * Deletes season and all related data (season_weeks, teams, matches, etc.)
   */
  const handleDeleteSeason = async () => {
    if (!currentSeason) return;

    setIsDeleting(true);
    try {
      // Delete season (CASCADE will automatically delete related records)
      const { error } = await supabase
        .from('seasons')
        .delete()
        .eq('id', currentSeason.id);

      if (error) throw error;

      // Clear localStorage for this league
      localStorage.removeItem(`season-creation-${league.id}`);
      localStorage.removeItem(`season-wizard-step-${league.id}`);
      localStorage.removeItem('season-schedule-review');
      localStorage.removeItem('season-blackout-weeks');

      // Close modal and refresh page
      setShowDeleteModal(false);
      window.location.reload();
    } catch (err) {
      logger.error('Error deleting season', { error: err instanceof Error ? err.message : String(err) });
      toast.error('Failed to delete season. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Get button visibility based on season state
  const editOptions = getSeasonEditOptions();

  return (
    <div className="lg:bg-white lg:rounded-xl lg:shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-semibold text-gray-900">League Overview</h2>
        <div className="flex gap-2">
          {/* Manage Season - shown for complete seasons (active, upcoming with schedule, completed) */}
          {editOptions.showManageSchedule && currentSeason && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setIsNavigating(true);
                navigate(`/league/${league.id}/season/${currentSeason.id}/manage-schedule`);
              }}
              disabled={isNavigating}
            >
              {isNavigating ? 'Loading...' : 'Manage Season'}
            </Button>
          )}


          {/* Continue Setup - shown for incomplete seasons */}
          {editOptions.showContinueSetup && (
            <Button
              size="sm"
              onClick={handleContinueSetupClick}
              style={{ backgroundColor: '#2563eb', color: 'white' }}
              disabled={isNavigating}
              loadingText="Loading..."
            >
              {isNavigating ? 'Loading...' : 'Continue Setup'}
            </Button>
          )}

          {/* Create Season - shown when no season exists */}
          {editOptions.showCreate && (
            <Button
              size="sm"
              onClick={handleCreateSeasonClick}
              style={{ backgroundColor: '#2563eb', color: 'white' }}
              disabled={isNavigating}
              loadingText="Loading..."
            >
              {isNavigating ? 'Loading...' : 'Create Season'}
            </Button>
          )}

          {/* Delete Season - shown for incomplete/upcoming seasons */}
          {editOptions.showDelete && currentSeason && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDeleteModal(true)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              Delete Season
            </Button>
          )}
        </div>
      </div>
      <h3 className="text-sm text-gray-600 mb-4">Current Season</h3>

      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-600">Loading season...</p>
        </div>
      ) : currentSeason ? (
        <div className={`${isSeasonComplete() ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'} border rounded-lg p-4`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={`font-semibold ${isSeasonComplete() ? 'text-green-900' : 'text-orange-900'}`}>
              {currentSeason.season_name}
            </h3>
            <span className={`px-3 py-1 ${getStatusBadge().bgColor} ${getStatusBadge().textColor} text-xs font-medium rounded-full`}>
              {getStatusBadge().text}
            </span>
          </div>
          <div className="grid md:grid-cols-3 gap-3 text-sm">
            <div>
              <span className={isSeasonComplete() ? 'text-green-700' : 'text-orange-700'}>Start Date:</span>{' '}
              <span className={`${isSeasonComplete() ? 'text-green-900' : 'text-orange-900'} font-medium`}>
                {new Date(currentSeason.start_date).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className={isSeasonComplete() ? 'text-green-700' : 'text-orange-700'}>End Date:</span>{' '}
              <span className={`${isSeasonComplete() ? 'text-green-900' : 'text-orange-900'} font-medium`}>
                {new Date(currentSeason.end_date).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className={isSeasonComplete() ? 'text-green-700' : 'text-orange-700'}>Format:</span>{' '}
              <span className={`${isSeasonComplete() ? 'text-green-900' : 'text-orange-900'} font-medium`}>
                {league.team_format === '5_man' ? '5-Man' : '8-Man'}
              </span>
            </div>
            {currentSeason.team_count !== undefined && (
              <div>
                <span className={isSeasonComplete() ? 'text-green-700' : 'text-orange-700'}>Teams:</span>{' '}
                <span className={`${isSeasonComplete() ? 'text-green-900' : 'text-orange-900'} font-medium`}>
                  {currentSeason.team_count}
                </span>
              </div>
            )}
            {currentSeason.week_count !== undefined && (
              <div>
                <span className={isSeasonComplete() ? 'text-green-700' : 'text-orange-700'}>Weeks:</span>{' '}
                <span className={`${isSeasonComplete() ? 'text-green-900' : 'text-orange-900'} font-medium`}>
                  {currentSeason.week_count}
                </span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 text-sm">
            No active season currently.
          </p>
        </div>
      )}

      {/* Delete Season Confirmation Modal */}
      {currentSeason && (
        <DeleteSeasonModal
          isOpen={showDeleteModal}
          seasonName={currentSeason.season_name}
          hasTeams={hasTeams}
          hasSchedule={hasSchedule}
          isDeleting={isDeleting}
          onConfirm={handleDeleteSeason}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
};
