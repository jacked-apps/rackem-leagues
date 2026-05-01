/**
 * @fileoverview PlayoffsCard Component
 *
 * Card displayed on the League Detail page to access playoff setup.
 * Shows playoff status and provides navigation to the playoff configuration page.
 * Displays the current playoff template/configuration name.
 *
 * Uses the same styling pattern as TeamsCard and ScheduleCard for consistency.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/supabaseClient';
import { useResolvedPlayoffConfig } from '@/api/hooks/usePlayoffConfigurations';
import { checkRegularSeasonComplete, getPlayoffWeek } from '@/utils/playoffGenerator';
import { parseLocalDate } from '@/utils/formatters';

interface PlayoffsCardProps {
  /** League ID */
  leagueId: string;
  /** Active season ID (if any) */
  seasonId: string | null;
}

/**
 * PlayoffsCard Component
 *
 * Displays playoff information and navigation for a league's active season.
 * Shows different states based on:
 * - Whether there's an active season
 * - Whether playoffs are configured
 * - Regular season completion status
 */
export const PlayoffsCard: React.FC<PlayoffsCardProps> = ({ leagueId, seasonId }) => {
  const navigate = useNavigate();
  const [isNavigating, setIsNavigating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playoffWeek, setPlayoffWeek] = useState<{
    id: string;
    scheduled_date: string;
    week_name: string;
  } | null>(null);
  const [seasonStatus, setSeasonStatus] = useState<{
    isComplete: boolean;
    completedMatches: number;
    totalMatches: number;
  } | null>(null);
  const [playoffMatchesExist, setPlayoffMatchesExist] = useState(false);

  // Fetch the resolved playoff configuration (shows name and source)
  const { data: resolvedConfig, isLoading: isLoadingConfig } = useResolvedPlayoffConfig(leagueId);

  useEffect(() => {
    async function loadPlayoffStatus() {
      if (!seasonId) {
        setLoading(false);
        return;
      }

      try {
        // Check for playoff week
        const week = await getPlayoffWeek(seasonId);
        setPlayoffWeek(week);

        if (week) {
          // Check regular season status
          const status = await checkRegularSeasonComplete(seasonId);
          setSeasonStatus(status);

          // Check if playoff matches already exist
          const { count } = await supabase
            .from('matches')
            .select('*', { count: 'exact', head: true })
            .eq('season_week_id', week.id);

          setPlayoffMatchesExist((count || 0) > 0);
        }
      } catch {
        // Silently handle errors - card will show default state
      } finally {
        setLoading(false);
      }
    }

    loadPlayoffStatus();
  }, [seasonId]);

  const handleNavigate = () => {
    if (!seasonId) return;
    setIsNavigating(true);
    navigate(`/league/${leagueId}/season/${seasonId}/playoffs`);
  };

  /**
   * Get the source label for the current configuration
   */
  const getConfigSourceLabel = () => {
    if (!resolvedConfig) return null;
    switch (resolvedConfig.config_source) {
      case 'league':
        return 'League';
      case 'organization':
        return 'Organization';
      case 'global':
        return 'Template';
      default:
        return null;
    }
  };

  // No active season
  if (!seasonId) {
    return (
      <div className="bg-card lg:rounded-xl shadow-sm p-6 mb-6 opacity-60">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Playoffs</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Create a season to configure playoffs.
        </p>
      </div>
    );
  }

  // Loading
  if (loading || isLoadingConfig) {
    return (
      <div className="bg-card lg:rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Playoffs</h2>
        </div>
        <p className="text-sm text-muted-foreground">Loading playoff status...</p>
      </div>
    );
  }

  // No playoff week configured
  if (!playoffWeek) {
    return (
      <div className="bg-card lg:rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Playoffs</h2>
        </div>
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div>
            <p className="text-sm text-foreground">
              No playoff week found in the season schedule.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Add a playoff week when creating or editing the season.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card lg:rounded-xl shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-foreground">Playoffs</h2>
        <Button
          onClick={handleNavigate}
          disabled={isNavigating}
          size="sm"
          loadingText="Loading..."
        >
          {isNavigating
            ? 'Loading...'
            : playoffMatchesExist
              ? 'View Bracket'
              : 'Setup Playoffs'
          }
        </Button>
      </div>

      {/* Current Template */}
      {resolvedConfig && (
        <div className="bg-purple-50 rounded-lg p-3 mb-4">
          <div className="text-sm font-medium text-purple-800">
            {resolvedConfig.name}
          </div>
          <div className="text-xs text-purple-600">
            {getConfigSourceLabel()} Default
          </div>
        </div>
      )}

      {/* Playoff Week Info */}
      <div className="bg-muted rounded-lg p-3 mb-4">
        <div className="text-sm font-medium text-foreground">
          {playoffWeek.week_name}
        </div>
        <div className="text-xs text-muted-foreground">
          {parseLocalDate(playoffWeek.scheduled_date).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </div>
      </div>

      {/* Status */}
      <div className="space-y-2">
        {/* Regular season status */}
        {seasonStatus && (
          <div className="flex items-center gap-2 text-sm">
            {seasonStatus.isComplete ? (
              <>
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-green-700">Regular season complete</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <span className="text-yellow-700">
                  {seasonStatus.completedMatches}/{seasonStatus.totalMatches} matches completed
                </span>
              </>
            )}
          </div>
        )}

        {/* Playoff matches status */}
        <div className="flex items-center gap-2 text-sm">
          {playoffMatchesExist ? (
            <>
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-green-700">Playoff matches created</span>
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Playoff matches not yet created</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayoffsCard;
