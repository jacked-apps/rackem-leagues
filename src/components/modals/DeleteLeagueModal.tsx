/**
 * @fileoverview Delete League Modal
 *
 * Handles league deletion with comprehensive warnings based on league status:
 * - Active leagues with played matches: STRONG WARNING (data loss)
 * - Completed leagues: BLOCKED (preserve historical stats)
 * - Empty/upcoming leagues: Standard warning
 *
 * Teardown order (matters under FK RESTRICT on team-referencing FKs):
 * 1. DELETE matches WHERE season_id IN (...) — cascades match_lineups + match_games
 * 2. DELETE FROM leagues — cascades seasons, season_weeks, team_players,
 *    teams (via teams.season_id and teams.league_id), and league_venues
 *
 * Step 1 must run first because matches.home_team_id, matches.away_team_id,
 * and match_lineups.team_id are now ON DELETE RESTRICT — Postgres no
 * longer guarantees an order that lets the leagues cascade chain wipe
 * matches before it tries to wipe teams. Pre-deleting matches removes
 * the RESTRICT-bearing rows so the leagues cascade has nothing to trip on.
 */
import React, { useState, useEffect } from 'react';
import { supabase } from '@/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, XCircle, Info } from 'lucide-react';
import { logger } from '@/utils/logger';

interface DeleteLeagueModalProps {
  /** Whether modal is open */
  isOpen: boolean;
  /** League ID to delete */
  leagueId: string;
  /** League name for display */
  leagueName: string;
  /** Callback when user cancels */
  onCancel: () => void;
  /** Callback when deletion succeeds */
  onSuccess: () => void;
}

interface LeagueStats {
  hasSeasons: boolean;
  hasMatches: boolean;
  hasPlayedMatches: boolean;
  totalSeasons: number;
  totalTeams: number;
  totalMatches: number;
  playedMatches: number;
  hasCompletedSeasons: boolean;
}

/**
 * DeleteLeagueModal Component
 *
 * Multi-stage warning system:
 * 1. Check league data (seasons, matches, completion status)
 * 2. Show appropriate warning level:
 *    - RED: Completed seasons exist (BLOCK deletion)
 *    - ORANGE: Active with played matches (STRONG warning)
 *    - YELLOW: Has data but no plays (MODERATE warning)
 *    - BLUE: Empty league (INFO warning)
 * 3. Require typed confirmation for dangerous deletes
 * 4. Execute cascade delete via database FK constraints
 */
export const DeleteLeagueModal: React.FC<DeleteLeagueModalProps> = ({
  isOpen,
  leagueId,
  leagueName,
  onCancel,
  onSuccess,
}) => {
  const [stats, setStats] = useState<LeagueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch league statistics to determine warning level
   */
  useEffect(() => {
    if (!isOpen) return;

    const fetchStats = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get all seasons for this league
        const { data: seasons, error: seasonsError } = await supabase
          .from('seasons')
          .select('id, status')
          .eq('league_id', leagueId);

        if (seasonsError) throw seasonsError;

        const hasCompletedSeasons = (seasons || []).some(s => s.status === 'completed');
        const seasonIds = (seasons || []).map(s => s.id);

        // Get all teams across all seasons
        const { count: teamsCount, error: teamsError } = await supabase
          .from('teams')
          .select('*', { count: 'exact', head: true })
          .in('season_id', seasonIds.length > 0 ? seasonIds : ['00000000-0000-0000-0000-000000000000']);

        if (teamsError) throw teamsError;

        // Get all matches across all seasons
        const { data: matches, error: matchesError } = await supabase
          .from('matches')
          .select('id, status')
          .in('season_id', seasonIds.length > 0 ? seasonIds : ['00000000-0000-0000-0000-000000000000']);

        if (matchesError) throw matchesError;

        const playedMatches = (matches || []).filter(m =>
          m.status === 'completed' || m.status === 'in_progress' || m.status === 'forfeited'
        ).length;

        setStats({
          hasSeasons: (seasons || []).length > 0,
          hasMatches: (matches || []).length > 0,
          hasPlayedMatches: playedMatches > 0,
          totalSeasons: (seasons || []).length,
          totalTeams: teamsCount || 0,
          totalMatches: (matches || []).length,
          playedMatches,
          hasCompletedSeasons,
        });
      } catch (err) {
        logger.error('Error fetching league stats', { error: err instanceof Error ? err.message : String(err) });
        setError('Failed to load league information');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [isOpen, leagueId]);

  /**
   * Handle delete confirmation.
   *
   * Two-step teardown required under FK RESTRICT on team-referencing FKs:
   * step 1 deletes matches (which cascades their lineups + games) so step 2's
   * leagues cascade can safely delete teams without tripping the team RESTRICTs.
   * See file header for the full FK rationale.
   */
  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      // Step 1: collect season IDs and delete matches first.
      const { data: seasonRows, error: seasonsError } = await supabase
        .from('seasons')
        .select('id')
        .eq('league_id', leagueId);

      if (seasonsError) throw seasonsError;

      const seasonIds = (seasonRows ?? []).map(s => s.id);

      if (seasonIds.length > 0) {
        const { error: matchesError } = await supabase
          .from('matches')
          .delete()
          .in('season_id', seasonIds);

        if (matchesError) throw matchesError;
      }

      // Step 2: delete the league. Cascades handle league_venues, seasons,
      // season_weeks, team_players, and teams now that matches are gone.
      const { error: deleteError } = await supabase
        .from('leagues')
        .delete()
        .eq('id', leagueId);

      if (deleteError) throw deleteError;

      onSuccess();
    } catch (err) {
      logger.error('Error deleting league', { error: err instanceof Error ? err.message : String(err) });
      setError(err instanceof Error ? err.message : 'Failed to delete league');
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-card rounded-lg p-6 max-w-md w-full">
          <p className="text-center text-muted-foreground">Loading league information...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !stats) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-card rounded-lg p-6 max-w-md w-full">
          <h3 className="text-lg font-semibold text-destructive mb-4">Error</h3>
          <p className="text-foreground mb-4">{error}</p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onCancel}>
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // BLOCK: Completed seasons exist
  if (stats?.hasCompletedSeasons) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-card rounded-lg p-6 max-w-lg w-full">
          <div className="flex items-start gap-3 mb-4">
            <XCircle className="h-6 w-6 text-destructive flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-destructive">Cannot Delete League</h3>
            </div>
          </div>

          <div className="bg-destructive/10 border border-destructive/40 rounded-lg p-4 mb-4">
            <p className="text-destructive font-medium mb-2">
              This league has completed seasons and cannot be deleted.
            </p>
            <p className="text-foreground text-sm mb-3">
              Deleting completed seasons would erase historical player statistics, standings, and match records that are essential for:
            </p>
            <ul className="list-disc list-inside text-foreground text-sm space-y-1 mb-3">
              <li>Player lifetime statistics and handicaps</li>
              <li>Season-over-season performance tracking</li>
              <li>Historical league records and achievements</li>
              <li>Playoff qualification verification</li>
            </ul>
            <p className="text-foreground text-sm font-medium">
              If you no longer want this league active, change its status to "Abandoned" instead of deleting it.
            </p>
          </div>

          <div className="bg-muted rounded-lg p-3 mb-4">
            <p className="text-sm text-foreground">
              <strong>League:</strong> {leagueName}
            </p>
            <p className="text-sm text-foreground">
              <strong>Seasons:</strong> {stats.totalSeasons} ({stats.hasCompletedSeasons ? 'includes completed' : 'all active/upcoming'})
            </p>
            <p className="text-sm text-foreground">
              <strong>Total Matches:</strong> {stats.totalMatches}
            </p>
          </div>

          <div className="flex justify-end">
            <Button loadingText="none" onClick={onCancel}>
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // STRONG WARNING: Active with played matches
  if (stats?.hasPlayedMatches) {
    const requiresConfirmation = confirmText !== 'DELETE';

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-card rounded-lg p-6 max-w-lg w-full">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="h-6 w-6 text-warning flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-warning">⚠️ Danger: Active League With Played Matches</h3>
            </div>
          </div>

          <div className="bg-warning/10 border border-warning/40 rounded-lg p-4 mb-4">
            <p className="text-warning font-medium mb-2">
              This league has {stats.playedMatches} match{stats.playedMatches !== 1 ? 'es' : ''} that have been played!
            </p>
            <p className="text-foreground text-sm mb-3">
              Deleting this league will permanently erase:
            </p>
            <ul className="list-disc list-inside text-foreground text-sm space-y-1">
              <li>{stats.totalSeasons} season{stats.totalSeasons !== 1 ? 's' : ''}</li>
              <li>{stats.totalTeams} team{stats.totalTeams !== 1 ? 's' : ''}</li>
              <li>{stats.totalMatches} match{stats.totalMatches !== 1 ? 'es' : ''} ({stats.playedMatches} already played)</li>
              <li>All match scores and results</li>
              <li>All team rosters and standings</li>
            </ul>
          </div>

          <div className="bg-muted rounded-lg p-3 mb-4">
            <p className="text-sm text-foreground mb-2">
              <strong>League:</strong> {leagueName}
            </p>
            <p className="text-sm text-muted-foreground italic">
              💡 Tip: If the season is over, mark it as "Completed" to preserve the data instead of deleting.
            </p>
          </div>

          <div className="mb-4">
            <Label htmlFor="confirm-delete" className="text-sm font-medium text-foreground">
              Type <span className="font-mono bg-muted px-1">DELETE</span> to confirm:
            </Label>
            <Input
              id="confirm-delete"
              value={confirmText}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="mt-1"
              disabled={deleting}
            />
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/40 rounded-lg p-3 mb-4">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onCancel} disabled={deleting}>
              Cancel
            </Button>
            <Button
              loadingText="Deleting..."
              isLoading={deleting}
              onClick={handleDelete}
              disabled={requiresConfirmation || deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete League
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // MODERATE WARNING: Has data but no plays
  if (stats?.hasSeasons || stats?.hasMatches) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-card rounded-lg p-6 max-w-lg w-full">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="h-6 w-6 text-warning flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-warning">Delete League?</h3>
            </div>
          </div>

          <div className="bg-warning/10 border border-warning/40 rounded-lg p-4 mb-4">
            <p className="text-warning text-sm mb-2">
              This league has setup data that will be deleted:
            </p>
            <ul className="list-disc list-inside text-foreground text-sm space-y-1">
              {stats.totalSeasons > 0 && <li>{stats.totalSeasons} season{stats.totalSeasons !== 1 ? 's' : ''}</li>}
              {stats.totalTeams > 0 && <li>{stats.totalTeams} team{stats.totalTeams !== 1 ? 's' : ''}</li>}
              {stats.totalMatches > 0 && <li>{stats.totalMatches} scheduled match{stats.totalMatches !== 1 ? 'es' : ''} (none played yet)</li>}
            </ul>
          </div>

          <div className="bg-muted rounded-lg p-3 mb-4">
            <p className="text-sm text-foreground">
              <strong>League:</strong> {leagueName}
            </p>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/40 rounded-lg p-3 mb-4">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onCancel} disabled={deleting}>
              Cancel
            </Button>
            <Button
              loadingText="Deleting..."
              isLoading={deleting}
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete League
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // INFO: Empty league
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg p-6 max-w-md w-full">
        <div className="flex items-start gap-3 mb-4">
          <Info className="h-6 w-6 text-info flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">Delete Empty League?</h3>
          </div>
        </div>

        <p className="text-foreground mb-4">
          Are you sure you want to delete <strong>{leagueName}</strong>?
        </p>

        <div className="bg-info/10 border border-info/40 rounded-lg p-3 mb-4">
          <p className="text-info text-sm">
            This league has no seasons or data. It's safe to delete.
          </p>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/40 rounded-lg p-3 mb-4">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button
            loadingText="Deleting..."
            isLoading={deleting}
            onClick={handleDelete}
            disabled={deleting}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Delete League
          </Button>
        </div>
      </div>
    </div>
  );
};
