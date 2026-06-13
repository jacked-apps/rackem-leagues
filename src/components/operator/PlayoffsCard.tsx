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
import { SectionCard, SectionCardLoading, SectionCardEmpty } from './SectionCard';
import { useResolvedPlayoffConfig } from '@/api/hooks/usePlayoffConfigurations';
import {
  checkRegularSeasonComplete,
  getPlayoffWeek,
  arePlayoffMatchupsPopulated,
} from '@/utils/playoffGenerator';
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

          // Whether the matchups have actually been populated (teams filled in) —
          // a raw row count is true all season because placeholder rows exist, so
          // use the trustworthy non-null-team-IDs signal instead.
          setPlayoffMatchesExist(await arePlayoffMatchupsPopulated(week.id));
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

  const isLoading = loading || isLoadingConfig;

  // One-line status for the collapsed header.
  const subtitle = !seasonId
    ? 'Create a season first'
    : isLoading
      ? undefined
      : !playoffWeek
        ? 'No playoff week scheduled'
        : playoffMatchesExist
          ? 'Bracket created'
          : 'Ready to set up';

  // Header action: Setup (solid) when not yet created, View Bracket (outline)
  // once it is. Only when there's a season + a scheduled playoff week.
  const actions =
    seasonId && !isLoading && playoffWeek ? (
      <Button
        onClick={handleNavigate}
        disabled={isNavigating}
        size="sm"
        variant={playoffMatchesExist ? 'outline' : 'default'}
        loadingText="none"
      >
        {isNavigating ? 'Loading...' : playoffMatchesExist ? 'View Bracket' : 'Setup Playoffs'}
      </Button>
    ) : undefined;

  // Body (shown on expand). Header-only when there's no season.
  let body: React.ReactNode = null;
  if (seasonId) {
    if (isLoading) {
      body = <SectionCardLoading message="Loading playoff status..." />;
    } else if (!playoffWeek) {
      body = (
        <SectionCardEmpty
          icon="🏆"
          message="No playoff week in the schedule — add one when editing the season."
        />
      );
    } else {
      body = (
        <div className="space-y-3">
          {resolvedConfig && (
            <div className="rounded-lg bg-purple-50 p-3">
              <div className="text-sm font-medium text-purple-800">{resolvedConfig.name}</div>
              <div className="text-xs text-purple-600">{getConfigSourceLabel()} Default</div>
            </div>
          )}

          <div className="rounded-lg bg-muted p-3">
            <div className="text-sm font-medium text-foreground">{playoffWeek.week_name}</div>
            <div className="text-xs text-muted-foreground">
              {parseLocalDate(playoffWeek.scheduled_date).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
          </div>

          <div className="space-y-2">
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
    }
  }

  return (
    <SectionCard
      title="Playoffs"
      subtitle={subtitle}
      actions={actions}
      collapsible={!!seasonId}
      defaultOpen={false}
    >
      {body}
    </SectionCard>
  );
};

export default PlayoffsCard;
