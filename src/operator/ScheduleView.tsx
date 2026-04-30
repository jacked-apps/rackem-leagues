/**
 * @fileoverview Schedule View Component
 *
 * Displays the full season schedule grouped by week.
 * Shows all matches with teams, venues, and status.
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '@/supabaseClient';
import { MatchCard } from '@/components/MatchCard';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import type { MatchWithDetails } from '@/types';
import { logger } from '@/utils/logger';

interface ScheduleViewProps {
  /** Season ID to display schedule for */
  seasonId: string;
  /** Optional: League ID for navigation */
  leagueId?: string;
  /** Optional: Highlight matches for a specific team */
  highlightTeamId?: string;
  /** Called to go back */
  onBack?: () => void;
}

interface WeekGroup {
  weekId: string;
  weekName: string;
  scheduledDate: string;
  matches: MatchWithDetails[];
}

/**
 * ScheduleView Component
 *
 * Displays the full season schedule organized by week.
 * Each week shows all matches scheduled for that date.
 *
 * @example
 * <ScheduleView
 *   seasonId="season-123"
 *   leagueId="league-456"
 *   onBack={handleBack}
 * />
 */
export const ScheduleView: React.FC<ScheduleViewProps> = ({
  seasonId,
  highlightTeamId,
  onBack,
}) => {
  const [weekGroups, setWeekGroups] = useState<WeekGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch matches grouped by week
   */
  useEffect(() => {
    const fetchSchedule = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch all matches with team and venue details
        const { data: matches, error: matchesError } = await supabase
          .from('matches')
          .select(`
            *,
            home_team:teams!home_team_id(id, team_name, captain_id),
            away_team:teams!away_team_id(id, team_name, captain_id),
            scheduled_venue:venues!scheduled_venue_id(id, name),
            actual_venue:venues!actual_venue_id(id, name),
            season_week:season_weeks(id, scheduled_date, week_name, week_type)
          `)
          .eq('season_id', seasonId)
          .order('match_number', { ascending: true });

        if (matchesError) throw matchesError;

        // Group matches by week
        const grouped = new Map<string, WeekGroup>();

        matches?.forEach((match: any) => {
          const weekId = match.season_week.id;

          if (!grouped.has(weekId)) {
            grouped.set(weekId, {
              weekId,
              weekName: match.season_week.week_name,
              scheduledDate: match.season_week.scheduled_date,
              matches: [],
            });
          }

          grouped.get(weekId)!.matches.push(match as MatchWithDetails);
        });

        // Convert to array and sort by date
        const sortedGroups = Array.from(grouped.values()).sort(
          (a, b) =>
            new Date(a.scheduledDate).getTime() -
            new Date(b.scheduledDate).getTime()
        );

        setWeekGroups(sortedGroups);
      } catch (err) {
        logger.error('Error fetching schedule', { error: err instanceof Error ? err.message : String(err) });
        setError(err instanceof Error ? err.message : 'Failed to load schedule');
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [seasonId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-muted py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="text-center text-muted-foreground">Loading schedule...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-muted py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="bg-card rounded-xl shadow-sm p-6">
            <h3 className="text-red-600 text-lg font-semibold mb-4">Error</h3>
            <p className="text-foreground mb-4">{error}</p>
            {onBack && (
              <Button onClick={onBack} loadingText="none">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (weekGroups.length === 0) {
    return (
      <div className="min-h-screen bg-muted py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="bg-card rounded-xl shadow-sm p-6">
            <h3 className="text-foreground text-lg font-semibold mb-4">
              No Schedule Generated
            </h3>
            <p className="text-muted-foreground mb-4">
              The schedule has not been generated yet. Please generate the schedule
              from the schedule setup page.
            </p>
            {onBack && (
              <Button onClick={onBack} loadingText="none">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          {onBack && (
            <Button
              variant="ghost"
              onClick={onBack}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Season Schedule</h1>
              <p className="text-muted-foreground mt-1">
                {weekGroups.length} weeks scheduled
              </p>
            </div>
          </div>
        </div>

        {/* Schedule - Grouped by Week */}
        <div className="space-y-8">
          {weekGroups.map((weekGroup) => (
            <div key={weekGroup.weekId} className="bg-card rounded-xl shadow-sm p-6">
              {/* Week Header */}
              <div className="mb-4 pb-3 border-b border-border">
                <h2 className="text-xl font-semibold text-foreground">
                  {weekGroup.weekName}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {new Date(weekGroup.scheduledDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>

              {/* Matches */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {weekGroup.matches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    highlightTeamId={highlightTeamId}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
