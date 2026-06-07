/**
 * @fileoverview SeasonCard — the "Season" part of a league.
 *
 * One of the four league parts (Season / Teams / Schedule / Matchups), each
 * with its own SectionCard on the league detail page. Shows the current
 * season's name, dates, format, and team/week counts, with Manage Season and
 * (for an unfinished season) Delete Season.
 *
 * Was `LeagueOverviewCard`, which had become a catch-all: it carried the
 * season info AND a pile of setup-flow buttons (Create Season/Schedule, Add
 * Teams, Set Matchups) plus an inline-styled wizard button. Those setup
 * actions are already driven by the Status card's Next Steps + the ActionCard,
 * so they're dropped here — this card is now just the Season part.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { Button } from '@/components/ui/button';
import { SectionCard, SectionCardLoading, SectionCardEmpty } from './SectionCard';
import { DeleteSeasonModal } from '@/components/modals/DeleteSeasonModal';
import type { League } from '@/types/league';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import { useResolvedLeaguePrefs } from '@/api/hooks/useResolvedLeaguePrefs';

interface SeasonCardProps {
  /** League data to display. */
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

export const SeasonCard: React.FC<SeasonCardProps> = ({ league }) => {
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

  const { data: leaguePrefs } = useResolvedLeaguePrefs(league.id);
  const lineupSize = leaguePrefs?.lineup_size;

  /**
   * Fetch the most recent season for this league + its setup signals (teams,
   * schedule, matchups) so the card can show status + the right edit options.
   */
  useEffect(() => {
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

        if (error && error.code !== 'PGRST116') throw error;
        setCurrentSeason(data);

        if (data) {
          const [{ count: teamCount }, { count: weekCount }, { count: matchCount }, { count: completedWeeks }] =
            await Promise.all([
              supabase.from('teams').select('*', { count: 'exact', head: true }).eq('season_id', data.id).eq('status', 'active'),
              supabase.from('season_weeks').select('*', { count: 'exact', head: true }).eq('season_id', data.id),
              supabase.from('matches').select('*', { count: 'exact', head: true }).eq('season_id', data.id),
              supabase.from('season_weeks').select('*', { count: 'exact', head: true }).eq('season_id', data.id).eq('week_type', 'regular').eq('week_completed', true),
            ]);
          setHasTeams((teamCount ?? 0) > 0);
          setHasSchedule((weekCount ?? 0) > 0);
          setHasMatchups((matchCount ?? 0) > 0);
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

  /** A season is "complete" once matchups exist AND it's been activated. */
  const isSeasonComplete = (): boolean =>
    hasTeams && hasSchedule && hasMatchups && currentSeason?.status === 'active';

  /** Status badge text + colors. */
  const getStatusBadge = () => {
    if (isSeasonComplete()) {
      return {
        text: currentSeason?.status === 'active' ? 'Active' : 'Complete',
        classes: 'bg-green-100 text-green-800',
      };
    }
    return { text: 'Incomplete', classes: 'bg-orange-100 text-orange-800' };
  };

  /** Which edit options apply, based on season state. */
  const getSeasonEditOptions = () => {
    if (!currentSeason) return {};
    if (!hasSchedule) return { showDelete: true };
    if (currentSeason.status === 'upcoming' && currentPlayWeek === 0) {
      return { showManageSchedule: true, showDelete: true };
    }
    return { showManageSchedule: true }; // active or completed
  };

  const handleDeleteSeason = async () => {
    if (!currentSeason) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('seasons').delete().eq('id', currentSeason.id);
      if (error) throw error;
      setShowDeleteModal(false);
      window.location.reload();
    } catch (err) {
      logger.error('Error deleting season', { error: err instanceof Error ? err.message : String(err) });
      toast.error('Failed to delete season. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const editOptions = getSeasonEditOptions();
  const badge = getStatusBadge();

  // Header actions: status badge + Manage Season when a season exists; a
  // Create Season entry when none does (parity with Teams/Schedule cards).
  const actions = currentSeason ? (
    <>
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.classes}`}>
        {badge.text}
      </span>
      {editOptions.showManageSchedule && (
        <Button
          size="sm"
          variant="outline"
          loadingText="none"
          disabled={isNavigating}
          onClick={() => {
            setIsNavigating(true);
            navigate(`/league/${league.id}/season/${currentSeason.id}/manage-schedule`);
          }}
        >
          {isNavigating ? 'Loading...' : 'Manage Season'}
        </Button>
      )}
    </>
  ) : (
    <Button
      size="sm"
      loadingText="none"
      disabled={isNavigating}
      onClick={() => {
        setIsNavigating(true);
        navigate(`/league/${league.id}/create-season`);
      }}
    >
      {isNavigating ? 'Loading...' : 'Create Season'}
    </Button>
  );

  return (
    <SectionCard
      title="Season"
      subtitle={currentSeason?.season_name}
      actions={actions}
      collapsible
      defaultOpen={false}
    >
      {loading ? (
        <SectionCardLoading message="Loading season..." />
      ) : !currentSeason ? (
        <SectionCardEmpty icon="📅" message="No season yet" />
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <div>
              <span className="text-muted-foreground">Start:</span>{' '}
              <span className="font-medium text-foreground">
                {new Date(currentSeason.start_date).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">End:</span>{' '}
              <span className="font-medium text-foreground">
                {new Date(currentSeason.end_date).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Format:</span>{' '}
              <span className="font-medium text-foreground">
                {lineupSize === 3 ? '3v3' : lineupSize === 5 ? '5v5' : `${lineupSize ?? '?'}v${lineupSize ?? '?'}`}
              </span>
            </div>
            {currentSeason.team_count !== undefined && (
              <div>
                <span className="text-muted-foreground">Teams:</span>{' '}
                <span className="font-medium text-foreground">{currentSeason.team_count}</span>
              </div>
            )}
            {currentSeason.week_count !== undefined && (
              <div>
                <span className="text-muted-foreground">Weeks:</span>{' '}
                <span className="font-medium text-foreground">{currentSeason.week_count}</span>
              </div>
            )}
          </div>

          {editOptions.showDelete && (
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setShowDeleteModal(true)}
            >
              Delete Season
            </Button>
          )}
        </div>
      )}

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
    </SectionCard>
  );
};
