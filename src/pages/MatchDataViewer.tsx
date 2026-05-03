/**
 * @fileoverview Match Data Viewer Page
 *
 * Comprehensive match data viewer showing ALL important match information.
 * Multi-row layout per match to display complete game details.
 * Mobile-first design with status filtering.
 * Used for debugging and verification during MVP development.
 */

import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useMatchesBySeason } from '@/api/hooks/useMatches';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MatchDetailCard } from '@/components/MatchDetailCard';

/**
 * Match Data Viewer Component
 *
 * Displays complete match information with filtering by status.
 * Defaults to showing only completed matches.
 * Shows all critical data: teams, scores, winner, games won, points, thresholds.
 * Ordered by date (most recent first).
 */
export function MatchDataViewer() {
  const { seasonId } = useParams<{ seasonId: string }>();
  const { data: allMatches = [], isLoading, error } = useMatchesBySeason(seasonId);
  const [statusFilter, setStatusFilter] = useState<string>('completed');

  // Filter and sort matches
  const matches = useMemo(() => {
    let filtered = allMatches;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(m => m.status === statusFilter);
    }

    // Sort by date (most recent first)
    return filtered.sort((a, b) => {
      const dateA = a.season_week?.scheduled_date || '';
      const dateB = b.season_week?.scheduled_date || '';
      return dateB.localeCompare(dateA);
    });
  }, [allMatches, statusFilter]);

  // Count matches by status
  const statusCounts = useMemo(() => {
    return {
      all: allMatches.length,
      completed: allMatches.filter(m => m.status === 'completed').length,
      awaiting_verification: allMatches.filter(m => m.status === 'awaiting_verification').length,
      in_progress: allMatches.filter(m => m.status === 'in_progress').length,
      scheduled: allMatches.filter(m => m.status === 'scheduled').length,
    };
  }, [allMatches]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">Loading match data...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-red-600">Error loading matches: {(error as Error).message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <Card>
        <CardHeader>
          <CardTitle>Match Data Viewer</CardTitle>
          <p className="text-sm text-muted-foreground mb-4">
            Showing {matches.length} of {allMatches.length} matches • Ordered by date (most recent first)
          </p>

          {/* Debug Info */}
          <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs">
            <div className="font-semibold mb-1">🐛 Debug Info:</div>
            <div>Total Matches Loaded: {allMatches.length}</div>
            <div>Statuses Found: {allMatches.map(m => `${m.id.substring(0, 8)}... = "${m.status}"`).join(', ')}</div>
            <div>Current Filter: "{statusFilter}"</div>
            <div>Matches After Filter: {matches.length}</div>
          </div>

          {/* Status Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={statusFilter === 'completed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('completed')}
              loadingText="none"
            >
              Completed ({statusCounts.completed})
            </Button>
            <Button
              variant={statusFilter === 'awaiting_verification' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('awaiting_verification')}
              loadingText="none"
            >
              Awaiting Verification ({statusCounts.awaiting_verification})
            </Button>
            <Button
              variant={statusFilter === 'in_progress' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('in_progress')}
              loadingText="none"
            >
              In Progress ({statusCounts.in_progress})
            </Button>
            <Button
              variant={statusFilter === 'scheduled' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('scheduled')}
              loadingText="none"
            >
              Scheduled ({statusCounts.scheduled})
            </Button>
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('all')}
              loadingText="none"
            >
              All ({statusCounts.all})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {matches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No {statusFilter !== 'all' ? statusFilter : ''} matches found
            </div>
          ) : (
            <div className="space-y-4">
              {matches.map((match) => (
                <MatchDetailCard key={match.id} matchId={match.id} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
