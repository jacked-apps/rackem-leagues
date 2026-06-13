/**
 * @fileoverview SeasonsCard Component
 * Displays current active season and past seasons for a league
 */
import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { logger } from '@/utils/logger';

interface SeasonsCardProps {
  /** League ID to fetch seasons for */
  leagueId: string;
  /** Callback when "Create Season" button is clicked */
  onCreateSeason: () => void;
}

// TODO: Replace with actual Season type once seasons table is created
interface Season {
  id: string;
  league_id: string;
  season_name: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'completed' | 'upcoming';
  team_count?: number;
  week_count?: number;
  created_at: string;
}

/**
 * SeasonsCard Component
 *
 * Displays:
 * - Current active season with details
 * - Collapsible past seasons section showing count
 * - "Create Season" button if no seasons exist
 */
export const SeasonsCard: React.FC<SeasonsCardProps> = ({ leagueId, onCreateSeason }) => {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPastSeasons, setShowPastSeasons] = useState(false);

  /**
   * Fetch seasons for this league
   */
  useEffect(() => {
    const fetchSeasons = async () => {
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from('seasons')
          .select('*')
          .eq('league_id', leagueId)
          .order('start_date', { ascending: false });

        if (error) throw error;
        setSeasons(data || []);
      } catch (err) {
        logger.error('Error fetching seasons', { error: err instanceof Error ? err.message : String(err) });
      } finally {
        setLoading(false);
      }
    };

    fetchSeasons();
  }, [leagueId]);

  // Separate current and past seasons
  const currentSeason = seasons.find(s => s.status === 'active');
  const pastSeasons = seasons.filter(s => s.status === 'completed');

  // Loading state
  if (loading) {
    return (
      <div className="bg-card rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Seasons</h2>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading seasons...</p>
        </div>
      </div>
    );
  }

  // Empty state - no seasons yet
  if (seasons.length === 0) {
    return (
      <div className="bg-card rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Seasons</h2>
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📅</div>
          <h3 className="text-lg font-medium text-foreground mb-2">No Seasons Yet</h3>
          <p className="text-muted-foreground mb-6">
            Create your first season to start adding teams and scheduling matches.
          </p>
          <button
            onClick={onCreateSeason}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create First Season
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-sm p-6">
      <h2 className="text-xl font-semibold text-foreground mb-4">Seasons</h2>

      {/* Current Active Season */}
      {currentSeason ? (
        <div className="bg-success/10 border border-success/40 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-success">{currentSeason.season_name}</h3>
            <span className="px-3 py-1 bg-success/10 text-success text-xs font-medium rounded-full">
              Active
            </span>
          </div>
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Start Date:</span>{' '}
              <span className="text-foreground font-medium">
                {new Date(currentSeason.start_date).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">End Date:</span>{' '}
              <span className="text-foreground font-medium">
                {new Date(currentSeason.end_date).toLocaleDateString()}
              </span>
            </div>
            {currentSeason.team_count !== undefined && (
              <div>
                <span className="text-muted-foreground">Teams:</span>{' '}
                <span className="text-foreground font-medium">{currentSeason.team_count}</span>
              </div>
            )}
            {currentSeason.week_count !== undefined && (
              <div>
                <span className="text-muted-foreground">Weeks:</span>{' '}
                <span className="text-foreground font-medium">{currentSeason.week_count}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-info/10 border border-info/40 rounded-lg p-4 mb-4">
          <p className="text-info text-sm">
            No active season. <button onClick={onCreateSeason} className="underline font-medium">Create a new season</button> to get started.
          </p>
        </div>
      )}

      {/* Past Seasons - Collapsible */}
      {pastSeasons.length > 0 && (
        <div>
          <button
            onClick={() => setShowPastSeasons(!showPastSeasons)}
            className="flex items-center justify-between w-full py-3 px-4 bg-muted hover:bg-muted rounded-lg transition-colors"
          >
            <span className="text-foreground font-medium">
              {pastSeasons.length} Past Season{pastSeasons.length !== 1 ? 's' : ''}
            </span>
            {showPastSeasons ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </button>

          {showPastSeasons && (
            <div className="mt-3 space-y-2">
              {pastSeasons.map((season) => (
                <div
                  key={season.id}
                  className="border border-border rounded-lg p-3 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-foreground">{season.season_name}</h4>
                    <span className="px-2 py-1 bg-muted text-foreground text-xs font-medium rounded">
                      Completed
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(season.start_date).toLocaleDateString()} - {new Date(season.end_date).toLocaleDateString()}
                    {season.team_count !== undefined && ` • ${season.team_count} teams`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
