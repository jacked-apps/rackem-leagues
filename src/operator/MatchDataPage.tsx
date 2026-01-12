/**
 * @fileoverview Match Data Page for League Operators
 *
 * Individual match editing page where operators can view and modify
 * all match data including lineups, games, scores, and results.
 *
 * Phase 1: Placeholder page with basic match info
 * Phase 2: Full editing capability (coming soon)
 *
 * Route: /league/:leagueId/season/:seasonId/match/:matchId
 */

import { useParams } from 'react-router-dom';
import { useMatchById } from '@/api/hooks/useMatches';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Construction } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { parseLocalDate } from '@/utils/formatters';

/**
 * Match Data Page Component
 *
 * Displays individual match details for operator review and editing.
 * Currently a placeholder showing basic match info - full editing
 * capability will be added in Phase 2.
 */
export default function MatchDataPage() {
  const { leagueId, seasonId, matchId } = useParams<{
    leagueId: string;
    seasonId: string;
    matchId: string;
  }>();

  // Fetch match details
  const { data: match, isLoading, error } = useMatchById(matchId);

  // Get team names (fallback if loading)
  const homeTeamName = match?.home_team?.team_name || 'Home Team';
  const awayTeamName = match?.away_team?.team_name || 'Away Team';
  const matchTitle = match ? `${homeTeamName} vs ${awayTeamName}` : 'Loading...';

  // Format date for display
  const formattedDate = match?.season_week?.scheduled_date
    ? parseLocalDate(match.season_week.scheduled_date).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  // Get status display
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'completed':
        return { text: 'Completed', className: 'bg-green-100 text-green-700' };
      case 'in_progress':
        return { text: 'In Progress', className: 'bg-blue-100 text-blue-700' };
      case 'awaiting_verification':
        return { text: 'Awaiting Verification', className: 'bg-yellow-100 text-yellow-700' };
      default:
        return { text: 'Scheduled', className: 'bg-gray-100 text-gray-600' };
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader
          backTo={`/league/${leagueId}/season/${seasonId}/match-list`}
          backLabel="Back to Match List"
          title="Loading..."
        />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-gray-600">Loading match data...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !match) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader
          backTo={`/league/${leagueId}/season/${seasonId}/match-list`}
          backLabel="Back to Match List"
          title="Error"
        />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-red-600">
                {error ? `Error loading match: ${(error as Error).message}` : 'Match not found'}
              </p>
              <div className="text-center mt-4">
                <Button
                  variant="outline"
                  onClick={() => window.history.back()}
                  loadingText="none"
                >
                  Go Back
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const status = getStatusDisplay(match.status);

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        backTo={`/league/${leagueId}/season/${seasonId}/match-list`}
        backLabel="Back to Match List"
        title={matchTitle}
        subtitle={`${match.season_week?.week_name || 'Week'} • ${formattedDate}`}
      >
        <span className={`inline-block text-sm px-3 py-1 rounded-full mt-2 ${status.className}`}>
          {status.text}
        </span>
      </PageHeader>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Current score if available */}
        {(match.home_games_won !== null || match.away_games_won !== null) && (
          <Card className="mb-6">
            <CardContent className="py-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2 text-center">Current Score</h3>
              <div className="flex items-center justify-center gap-4 text-3xl font-bold">
                <span className="text-gray-900">{match.home_games_won ?? 0}</span>
                <span className="text-gray-400">-</span>
                <span className="text-gray-900">{match.away_games_won ?? 0}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Coming soon notice */}
        <Card className="mb-6">
          <CardContent className="py-8">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Construction className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                Match Editor Coming Soon
              </h3>
              <p className="text-gray-500 max-w-md mx-auto">
                Full match editing capability will be available in Phase 2.
                You will be able to edit lineups, enter game results, and
                modify match outcomes.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Basic match info */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="py-4">
              <h4 className="text-sm font-medium text-gray-500 mb-1">Venue</h4>
              <p className="text-gray-900">
                {match.scheduled_venue?.name || 'Venue TBD'}
              </p>
              {match.scheduled_venue?.city && (
                <p className="text-sm text-gray-600">
                  {match.scheduled_venue.city}, {match.scheduled_venue.state}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <h4 className="text-sm font-medium text-gray-500 mb-1">Match ID</h4>
              <p className="text-gray-900 font-mono text-sm truncate">
                {match.id}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
