/**
 * @fileoverview ScheduleCard Component
 * Displays schedule status and creation button for a league
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { Button } from '@/components/ui/button';
import { SectionCard, SectionCardLoading, SectionCardEmpty } from './SectionCard';
import { isProduction } from '@/config/environment';
import { logger } from '@/utils/logger';

interface ScheduleCardProps {
  /** League ID to fetch schedule for */
  leagueId: string;
}

/**
 * ScheduleCard Component
 *
 * Shows:
 * - "Create Schedule" button if no schedule exists and no weeks are completed
 * - Schedule status if schedule exists
 * - Hides "Create Schedule" button if any week has been completed (prevents schedule changes)
 */
export const ScheduleCard: React.FC<ScheduleCardProps> = ({ leagueId }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [scheduleExists, setScheduleExists] = useState(false);
  const [activeSeason, setActiveSeason] = useState<{ id: string } | null>(null);
  const [upcomingWeeks, setUpcomingWeeks] = useState<Array<{ name: string; date: string; type: string }>>([]);
  const [nextBlackout, setNextBlackout] = useState<{ name: string; date: string } | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [weeksCompleted, setWeeksCompleted] = useState(0);
  const [totalWeeks, setTotalWeeks] = useState(0);

  /**
   * Check if schedule exists and find the next upcoming week
   */
  useEffect(() => {
    const checkScheduleStatus = async () => {
      setLoading(true);
      try {
        // Get active season for this league
        const { data: seasonData, error: seasonError } = await supabase
          .from('seasons')
          .select('id')
          .eq('league_id', leagueId)
          .eq('status', 'active')
          .maybeSingle();

        if (seasonError && seasonError.code !== 'PGRST116') {
          throw seasonError;
        }

        if (!seasonData) {
          setLoading(false);
          return;
        }

        setActiveSeason(seasonData);

        // Check if any matches exist for this season
        const { count: matchesCount, error: matchesError } = await supabase
          .from('matches')
          .select('*', { count: 'exact', head: true })
          .eq('season_id', seasonData.id);

        if (matchesError) throw matchesError;

        setScheduleExists((matchesCount || 0) > 0);

        // Get ALL weeks for this season (for debugging)
        const { data: allWeeksData, error: allWeeksError } = await supabase
          .from('season_weeks')
          .select('week_name, scheduled_date, week_type, week_completed')
          .eq('season_id', seasonData.id)
          .order('scheduled_date', { ascending: true });

        if (allWeeksError) throw allWeeksError;

        if (allWeeksData) {
          // Get all weeks to calculate completion based on match status
        const { data: allWeeks } = await supabase
          .from('season_weeks')
          .select('id, week_name, scheduled_date, week_type')
          .eq('season_id', seasonData.id)
          .order('scheduled_date', { ascending: true });

        // Initialize completion map
        const weekCompletionMap = new Map<string, boolean>();

        if (allWeeks && allWeeks.length > 0) {
          const weekIds = allWeeks.map(w => w.id);

          // Get all matches to determine which weeks are complete
          const { data: matches } = await supabase
            .from('matches')
            .select('season_week_id, status')
            .in('season_week_id', weekIds);

          // Calculate completion per week
          const weekMatchCounts = new Map<string, { total: number; completed: number }>();

          matches?.forEach(match => {
            const weekId = match.season_week_id;
            if (!weekId) return;

            const counts = weekMatchCounts.get(weekId) || { total: 0, completed: 0 };
            counts.total++;
            if (match.status === 'completed' || match.status === 'verified') {
              counts.completed++;
            }
            weekMatchCounts.set(weekId, counts);
          });

          // Mark weeks as complete if all matches are done
          weekIds.forEach(weekId => {
            const counts = weekMatchCounts.get(weekId);
            const isComplete = counts && counts.total > 0 && counts.completed === counts.total;
            weekCompletionMap.set(weekId, isComplete || false);
          });

          // Get next 3 incomplete REGULAR weeks (matches only, not blackouts)
          const today = new Date().toISOString().split('T')[0];
          const incompleteRegularWeeks = allWeeks
            .filter(week =>
              week.week_type === 'regular' &&
              !weekCompletionMap.get(week.id)
            )
            .slice(0, 3);

          setUpcomingWeeks(incompleteRegularWeeks.map(week => ({
            name: week.week_name,
            date: week.scheduled_date,
            type: week.week_type
          })));

          // Get the next blackout week (holiday/break) based on date only
          const upcomingBlackouts = allWeeks
            .filter(week =>
              week.week_type === 'blackout' &&
              week.scheduled_date >= today
            );

          if (upcomingBlackouts.length > 0) {
            setNextBlackout({
              name: upcomingBlackouts[0].week_name,
              date: upcomingBlackouts[0].scheduled_date
            });
          } else {
            setNextBlackout(null);
          }
        }

        // Calculate week counts using match completion data
        if (allWeeks) {
          const regularWeeks = allWeeks.filter(w => w.week_type === 'regular');
          setTotalWeeks(regularWeeks.length);

          // Count completed regular weeks using the completion map we already calculated
          if (weekCompletionMap) {
            const completedRegularWeeks = regularWeeks.filter(w => weekCompletionMap.get(w.id)).length;
            setWeeksCompleted(completedRegularWeeks);
          }
        }

        }
      } catch (err) {
        logger.error('Error checking schedule status', { error: err instanceof Error ? err.message : String(err) });
      } finally {
        setLoading(false);
      }
    };

    checkScheduleStatus();
  }, [leagueId]);

  /**
   * Navigate to schedule setup page
   */
  const handleCreateSchedule = () => {
    if (activeSeason) {
      setIsNavigating(true);
      navigate(`/league/${leagueId}/season/${activeSeason.id}/schedule-setup`);
    }
  };

  /**
   * Navigate to schedule view/edit page
   */
  const handleViewSchedule = () => {
    if (activeSeason) {
      setIsNavigating(true);
      navigate(`/league/${leagueId}/season/${activeSeason.id}/schedule`);
    }
  };

  // Header actions adapt to state so the primary action stays visible even
  // while the card is collapsed: Create Schedule when none exists, View
  // Schedule once it does (+ Score a Match in non-prod).
  const actions = (
    <>
      {!isProduction && (
        <Button
          size="sm"
          variant="outline"
          loadingText="none"
          onClick={() => navigate(`/league/${leagueId}/manual-scoring`)}
        >
          Score a Match
        </Button>
      )}
      {activeSeason && scheduleExists && (
        <Button size="sm" onClick={handleViewSchedule} disabled={isNavigating} isLoading={isNavigating} loadingText="Loading...">
          View Schedule
        </Button>
      )}
      {activeSeason && !scheduleExists && (
        <Button size="sm" onClick={handleCreateSchedule} disabled={isNavigating} isLoading={isNavigating} loadingText="Loading...">
          Create Schedule
        </Button>
      )}
    </>
  );

  const subtitle =
    activeSeason && scheduleExists ? `${weeksCompleted}/${totalWeeks} weeks played` : undefined;

  return (
    <SectionCard title="Schedule" subtitle={subtitle} actions={actions} collapsible defaultOpen={false}>
      {loading ? (
        <SectionCardLoading message="Loading schedule status..." />
      ) : !activeSeason ? (
        <SectionCardEmpty icon="🗓️" message="Create a season first to generate a schedule" />
      ) : !scheduleExists ? (
        <SectionCardEmpty icon="🗓️" message="Ready to create your schedule" />
      ) : upcomingWeeks.length === 0 ? (
        <SectionCardEmpty icon="🏁" message="All weeks completed" />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Upcoming Weeks */}
          <div className="bg-muted rounded-lg p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Upcoming Weeks</h3>
            <div className="space-y-2">
              {upcomingWeeks.map((week, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-sm font-medium text-foreground">{week.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {new Date(week.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Next Holiday */}
          <div className="bg-muted rounded-lg p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Next Holiday</h3>
            {nextBlackout ? (
              <div className="py-2">
                <p className="text-lg font-semibold text-foreground mb-1">{nextBlackout.name}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(nextBlackout.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            ) : (
              <div className="py-2">
                <p className="text-sm text-muted-foreground italic">No holidays scheduled</p>
              </div>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  );
};
