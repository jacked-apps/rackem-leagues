/**
 * @fileoverview Schedule Setup Page
 *
 * Page wrapper for the ScheduleSetup component.
 * Handles data fetching and navigation for schedule generation.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { ScheduleSetup } from './ScheduleSetup';
import { fetchTeamsWithDetails } from '@/api/hooks';
import type { TeamWithQueryDetails } from '@/types/team';
import { logger } from '@/utils/logger';

/**
 * ScheduleSetupPage Component
 *
 * Loads teams for a season and provides the ScheduleSetup interface
 * for assigning schedule positions and generating the season schedule.
 */
export const ScheduleSetupPage: React.FC = () => {
  const { leagueId, seasonId } = useParams<{ leagueId: string; seasonId: string }>();
  const navigate = useNavigate();

  const [teams, setTeams] = useState<TeamWithQueryDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  /**
   * Fetch teams for the season
   */
  useEffect(() => {
    const fetchData = async () => {
      if (!leagueId || !seasonId) {
        setError('Missing league or season ID');
        setLoading(false);
        return;
      }

      try {
        // Fetch teams for this season
        const { data: teamsData, error: teamsError } = await fetchTeamsWithDetails(leagueId);

        if (teamsError) throw teamsError;

        // Filter teams by season
        const seasonTeams = teamsData?.filter(team => team.season_id === seasonId) || [];

        if (seasonTeams.length === 0) {
          setError('No teams found for this season. Please add teams first.');
          setLoading(false);
          return;
        }

        setTeams(seasonTeams);
      } catch (err) {
        logger.error('Error fetching teams', { error: err instanceof Error ? err.message : String(err) });
        setError('Failed to load teams');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [leagueId, seasonId]);

  /**
   * Handle successful schedule generation
   */
  const handleSuccess = () => {
    // Navigate to schedule view page
    setIsNavigating(true);
    navigate(`/league/${leagueId}/season/${seasonId}/schedule`);
  };

  /**
   * Handle cancel
   */
  const handleCancel = () => {
    setIsNavigating(true);
    navigate(`/league/${leagueId}/season/${seasonId}/setup-teams`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="text-center text-muted-foreground">Loading teams...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-muted py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="bg-card rounded-xl shadow-sm p-6">
            <h3 className="text-destructive text-lg font-semibold mb-4">Error</h3>
            <p className="text-foreground mb-4">{error}</p>
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setIsNavigating(true);
                  navigate(`/league/${leagueId}`);
                }}
                disabled={isNavigating}
                loadingText="Loading..."
              >
                {isNavigating ? 'Loading...' : 'Back to League'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsNavigating(true);
                  navigate(`/league/${leagueId}/season/${seasonId}/setup-teams`);
                }}
                disabled={isNavigating}
                loadingText="Loading..."
              >
                {isNavigating ? 'Loading...' : 'Manage Teams'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      <PageHeader
        backTo={`/league/${leagueId}/season/${seasonId}/setup-teams`}
        backLabel="Back to Team Management"
        title="Generate Schedule"
        subtitle="Assign schedule positions and generate matchups for your season"
      />

      <div className="container mx-auto px-4 max-w-7xl py-8">
        {/* Schedule Setup Component */}
        <ScheduleSetup
          seasonId={seasonId!}
          teams={teams}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
};

export default ScheduleSetupPage;
