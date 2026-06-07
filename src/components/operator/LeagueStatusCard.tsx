/**
 * @fileoverview Unified League Status Card Component
 *
 * Single source of truth for league status across the application.
 * Displays status badge, progress bar, and next action steps.
 * Used on both Operator Dashboard and League Detail pages to ensure consistency.
 */
import React, { useState, useEffect } from 'react';
import { supabase } from '@/supabaseClient';
import { LeagueProgressBar } from './LeagueProgressBar';
import { deriveSetupProgress } from './leagueSetupProgress';
import type { League } from '@/types/league';
import type { Season } from '@/types/season';
import { logger } from '@/utils/logger';

interface LeagueStatusCardProps {
  /** League to display status for */
  league: League;
  /** Optional: Show as compact card (for dashboard) vs full section (for detail page) */
  variant?: 'card' | 'section';
}

type LeagueStatus = 'setup' | 'ready' | 'in_session';

/**
 * The five ordered setup stages, aligned 1:1 with `deriveSetupProgress`'s
 * `stepsDone` vector (index 0..4). Activation is the explicit final step.
 */
const SETUP_STEP_LABELS = [
  'Create the season (dates, length, playoff format)',
  'Set up the weekly schedule (blackout weeks, championships)',
  'Add teams and captains',
  'Generate the matchups (team positions + round-robin)',
  'Accept the schedule to activate the season',
] as const;

/**
 * LeagueStatusCard Component
 *
 * Fetches and calculates league status information:
 * - Season count
 * - Team count
 * - Player count
 * - Schedule existence
 * - Current play week (if active season)
 *
 * Displays:
 * - Status badge (Setup Needed / Ready to Play / In Session)
 * - Progress bar
 * - Next action text
 */
export const LeagueStatusCard: React.FC<LeagueStatusCardProps> = ({
  league,
  variant = 'section'
}) => {
  const [loading, setLoading] = useState(true);
  const [seasonCount, setSeasonCount] = useState(0);
  const [teamCount, setTeamCount] = useState(0);
  const [scheduleExists, setScheduleExists] = useState(false);
  const [matchupsExist, setMatchupsExist] = useState(false);
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [completedWeeksCount, setCompletedWeeksCount] = useState(0);
  const [totalWeeksCount, setTotalWeeksCount] = useState(0);

  /**
   * Fetch all league status data
   */
  useEffect(() => {
    const fetchStatusData = async () => {
      setLoading(true);
      try {
        // Fetch season count
        const { count: seasonCountResult } = await supabase
          .from('seasons')
          .select('*', { count: 'exact', head: true })
          .eq('league_id', league.id);
        setSeasonCount(seasonCountResult || 0);

        // Fetch the most-recent season (any status). Previously this only
        // fetched active seasons, which meant upcoming seasons (mid-setup)
        // reported 0 teams / no schedule and the card was always misleading.
        const { data: mostRecentSeason } = await supabase
          .from('seasons')
          .select('*')
          .eq('league_id', league.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (mostRecentSeason) {
          // Only flag as "active" if the LO has finished Matchups (status=active).
          setActiveSeason(
            mostRecentSeason.status === 'active'
              ? (mostRecentSeason as unknown as Season)
              : null,
          );

          // These counts apply to ANY season (upcoming, active, completed) so
          // the progress bar and next-steps list reflect real state during setup.
          const [teamRes, scheduleRes, matchRes] = await Promise.all([
            supabase.from('teams').select('*', { count: 'exact', head: true }).eq('season_id', mostRecentSeason.id).eq('status', 'active'),
            supabase.from('season_weeks').select('*', { count: 'exact', head: true }).eq('season_id', mostRecentSeason.id),
            supabase.from('matches').select('*', { count: 'exact', head: true }).eq('season_id', mostRecentSeason.id),
          ]);
          setTeamCount(teamRes.count || 0);
          setScheduleExists((scheduleRes.count || 0) > 0);
          setMatchupsExist((matchRes.count || 0) > 0);

          // Week-completion stats only meaningful once season is active
          if (mostRecentSeason.status === 'active') {
            const { data: regularWeeks } = await supabase
              .from('season_weeks')
              .select('id')
              .eq('season_id', mostRecentSeason.id)
              .eq('week_type', 'regular');

            const totalWeeks = regularWeeks?.length || 0;
            setTotalWeeksCount(totalWeeks);

            if (regularWeeks && regularWeeks.length > 0) {
              const weekIds = regularWeeks.map(w => w.id);
              const { data: matches } = await supabase
                .from('matches')
                .select('season_week_id, status')
                .in('season_week_id', weekIds);

              const weekMatchCounts = new Map<string, { total: number; completed: number }>();
              matches?.forEach(match => {
                const weekId = match.season_week_id;
                if (!weekId) return;
                const counts = weekMatchCounts.get(weekId) || { total: 0, completed: 0 };
                counts.total++;
                if (match.status === 'completed' || match.status === 'verified') counts.completed++;
                weekMatchCounts.set(weekId, counts);
              });

              let completedWeeks = 0;
              weekIds.forEach(weekId => {
                const counts = weekMatchCounts.get(weekId);
                if (counts && counts.total > 0 && counts.completed === counts.total) completedWeeks++;
              });
              setCompletedWeeksCount(completedWeeks);
            } else {
              setCompletedWeeksCount(0);
            }
          } else {
            setTotalWeeksCount(0);
            setCompletedWeeksCount(0);
          }
        } else {
          // No season at all yet
          setActiveSeason(null);
          setTeamCount(0);
          setScheduleExists(false);
          setMatchupsExist(false);
          setTotalWeeksCount(0);
          setCompletedWeeksCount(0);
        }
      } catch (error) {
        logger.error('Error fetching league status', { error: error instanceof Error ? error.message : String(error) });
      } finally {
        setLoading(false);
      }
    };

    fetchStatusData();
  }, [league.id]);

  /**
   * Determine current status.
   * Setup stages mirror Wizard 2.0: Season → Schedule → Teams → Matchups → Activate.
   * A season is only "ready" once all stages are done (activation is the final flip).
   */
  const getStatus = (): LeagueStatus => {
    if (activeSeason) return 'in_session';
    if (seasonCount > 0 && scheduleExists && teamCount > 0 && matchupsExist) return 'ready';
    return 'setup';
  };

  // Five-stage setup progress (season / schedule / teams / matchups / activate).
  // Activation is counted as a real stage so the bar and the Next-Steps list
  // agree — four-of-five reads 80% with "activate" as the current step, never
  // 100% with an open activate step.
  const setup = deriveSetupProgress({
    seasonCount,
    scheduleExists,
    teamCount,
    matchupsExist,
    isActive: !!activeSeason,
  });

  /**
   * Calculate progress percentage.
   * - In session with weeks: season progress (weeks completed / total weeks).
   * - Otherwise: the five-stage setup percent.
   */
  const calculateProgress = (): number => {
    if (activeSeason && totalWeeksCount > 0) {
      return Math.round((completedWeeksCount / totalWeeksCount) * 100);
    }
    return setup.percent;
  };

  /**
   * Get status badge configuration
   */
  const getStatusBadge = () => {
    const status = getStatus();
    switch (status) {
      case 'in_session':
        return {
          label: 'In Session',
          classes: 'bg-blue-100 text-blue-800'
        };
      case 'ready':
        return {
          label: 'Ready to Play',
          classes: 'bg-green-100 text-green-800'
        };
      case 'setup':
        return {
          label: 'Setup Needed',
          classes: 'bg-orange-100 text-orange-800'
        };
    }
  };

  /**
   * Get next action text.
   * Ordered to match Wizard 2.0 stages: Season → Schedule → Teams → Matchups → Activate.
   */
  const getNextAction = (): string => {
    if (activeSeason) {
      return `Week ${completedWeeksCount} of ${totalWeeksCount} completed`;
    }

    if (seasonCount === 0) return 'Next: Create your first season';
    if (!scheduleExists) return 'Next: Set up the weekly schedule';
    if (teamCount === 0) return 'Next: Add teams to your season';
    if (!matchupsExist) return 'Next: Generate the matchups';
    return "All set! Finish the wizard to activate the season.";
  };

  const status = getStatus();
  const statusBadge = getStatusBadge();
  const progress = calculateProgress();
  const nextAction = getNextAction();

  if (loading) {
    return (
      <div className="bg-card rounded-xl shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-accent rounded w-1/3 mb-4"></div>
          <div className="h-2 bg-accent rounded mb-2"></div>
          <div className="h-4 bg-accent rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  // Card variant (for dashboard)
  if (variant === 'card') {
    return (
      <div className="bg-card rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Status</h3>
          <span className={`px-3 py-1 ${statusBadge.classes} text-sm font-medium rounded-full`}>
            {statusBadge.label}
          </span>
        </div>
        <LeagueProgressBar
          status={status === 'in_session' ? 'active' : status === 'ready' ? 'active' : 'setup'}
          progress={progress}
          label={activeSeason ? 'Season Progress' : 'League Setup Progress'}
          nextAction={nextAction}
        />
      </div>
    );
  }

  // Section variant (for detail page)
  return (
    <div className="lg:col-span-2 bg-card lg:rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-foreground">
          {activeSeason ? 'Season Status' : 'League Status'}
        </h2>
        <span className={`px-4 py-2 ${statusBadge.classes} text-sm font-medium rounded-full`}>
          {statusBadge.label}
        </span>
      </div>
      <LeagueProgressBar
        status={status === 'in_session' ? 'active' : status === 'ready' ? 'active' : 'setup'}
        progress={progress}
        label={activeSeason ? 'Season Progress' : 'League Setup Progress'}
        nextAction={nextAction}
      />

      {/* Next Steps / Season Management */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">
          {activeSeason ? 'Season Management' : 'Next Steps'}
        </h3>
        {activeSeason ? (
          <ul className="list-disc list-inside text-blue-800 space-y-1">
            <li>Enter scores after each week's matches</li>
            <li>View standings and player statistics</li>
            <li>Manage schedule changes and makeup matches</li>
            <li>Prepare for playoffs when season ends</li>
          </ul>
        ) : (
          <ol className="list-decimal list-inside text-blue-800 space-y-1">
            {SETUP_STEP_LABELS.map((label, i) => {
              const done = setup.stepsDone[i];
              const current = i === setup.firstIncompleteIndex;
              const className = done
                ? 'line-through opacity-50'
                : current
                  ? 'font-semibold'
                  : '';
              return (
                <li key={label} className={className}>
                  {label}
                  {current && (
                    <span className="ml-2 text-xs font-normal text-blue-700">
                      ← do this next
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
};
