/**
 * @fileoverview Team Schedule Page (Player View)
 *
 * Mobile-first schedule showing all matches for a specific team.
 * Players can see dates, opponents, venues, and access score entry.
 *
 * Flow: My Teams → View Schedule → See all team matches
 */

import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { useMatchesByTeam, useTeamDetails, useSeasonWeeks } from '@/api/hooks';
import type { MatchWithDetails } from '@/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Trophy, AlertCircle, EyeOff, Eye } from 'lucide-react';
import { parseLocalDate } from '@/utils/formatters';
import { MatchDetailCard } from '@/components/MatchDetailCard';
import { PageHeader } from '@/components/PageHeader';

export function TeamSchedule() {
  const { teamId } = useParams<{ teamId: string }>();
  const [hideCompleted, setHideCompleted] = useState(false);

  // Fetch team details and matches using TanStack Query hooks
  const { data: team, isLoading: teamLoading, error: teamError } = useTeamDetails(teamId);
  const { data: matches = [], isLoading: matchesLoading, error: matchesError } = useMatchesByTeam(teamId);

  // Get season ID from team to fetch playoff weeks
  const seasonId = team?.season?.id;
  const { data: seasonWeeks = [] } = useSeasonWeeks(seasonId);

  // Filter to get playoff weeks only
  const playoffWeeks = seasonWeeks.filter(week => week.week_type === 'playoffs');

  const loading = teamLoading || matchesLoading;
  const error = teamError || matchesError ? 'Failed to load team schedule' : null;

  /**
   * Determine if this team is home or away
   */
  const getTeamRole = (match: MatchWithDetails): 'home' | 'away' | null => {
    if (match.home_team_id === teamId) return 'home';
    if (match.away_team_id === teamId) return 'away';
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <p className="text-muted-foreground">Loading schedule...</p>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="min-h-screen bg-muted p-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-destructive">{error || 'Team not found'}</p>
            <Link to="/my-teams">
              <Button variant="outline" className="mt-4">
                Back to My Teams
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get day of week from first match (all matches should be same day)
  const dayOfWeek = matches.length > 0 && matches[0].scheduled_date
    ? parseLocalDate(matches[0].scheduled_date).toLocaleDateString('en-US', { weekday: 'long' })
    : null;

  // Helper: Check if match needs makeup (scheduled date passed but not completed)
  const needsMakeup = (match: MatchWithDetails): boolean => {
    if (match.status === 'completed') return false;
    if (!match.scheduled_date) return false;

    const scheduledDate = parseLocalDate(match.scheduled_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to compare dates only

    return scheduledDate < today;
  };

  // Helper: Find the next upcoming match (first match today or in future that's not completed)
  const getUpcomingMatchId = (): string | null => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filter to non-completed matches with dates today or in the future
    const futureMatches = matches
      .filter(m => {
        if (m.status === 'completed') return false;
        if (!m.scheduled_date) return false;
        const matchDate = parseLocalDate(m.scheduled_date);
        return matchDate >= today;
      })
      .sort((a, b) => {
        const dateA = parseLocalDate(a.scheduled_date!);
        const dateB = parseLocalDate(b.scheduled_date!);
        return dateA.getTime() - dateB.getTime();
      });

    return futureMatches.length > 0 ? futureMatches[0].id : null;
  };

  const upcomingMatchId = getUpcomingMatchId();

  // Filter matches based on hideCompleted state
  const displayedMatches = hideCompleted
    ? matches.filter(m => m.status !== 'completed')
    : matches;

  return (
    <div className="min-h-screen bg-muted">
      <PageHeader
        backTo="/my-teams"
        backLabel="Back to My Teams"
        title={team.team_name}
        subtitle={dayOfWeek ? `${dayOfWeek}s` : undefined}
      >
        <div className="mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHideCompleted(!hideCompleted)}
            className="w-full sm:w-auto"
            loadingText="none"
          >
            {hideCompleted ? (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Show Completed
              </>
            ) : (
              <>
                <EyeOff className="h-4 w-4 mr-2" />
                Hide Completed
              </>
            )}
          </Button>
        </div>
      </PageHeader>

      {/* Main Content */}
      <main className="px-4 py-6 max-w-2xl mx-auto">
        {displayedMatches.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {hideCompleted ? 'No upcoming matches' : 'No matches scheduled yet'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Accordion type="single" collapsible className="space-y-4">
            {displayedMatches.map((match) => {
              const teamRole = getTeamRole(match);
              const opponent =
                teamRole === 'home' ? match.away_team : match.home_team;
              // A "real" opponent is an active team. A bye/withdrawn opponent
              // (or a legacy NULL one before the backfill ran) means this is
              // a bye week — no lineup, no Score Match button.
              const hasRealOpponent =
                !!opponent && opponent.status === 'active';
              const isMakeup = needsMakeup(match);
              const isUpcoming = match.id === upcomingMatchId || match.status === 'in_progress';

              return (
                <AccordionItem
                  key={match.id}
                  value={match.id}
                  className={`border rounded-lg shadow-sm ${
                    match.status === 'completed'
                      ? 'bg-success/10 border-success/40'
                      : isMakeup
                      ? 'bg-warning/10 border-warning/40'
                      : isUpcoming
                      ? 'bg-info/10 border-info/40'
                      : 'bg-card'
                  }`}
                >
                  <AccordionTrigger className="px-4 py-4 hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4 text-left">
                      <div className="flex items-center gap-3">
                        {/* Week Number & Date */}
                        <div className={`flex items-center gap-2 text-sm ${
                          match.status === 'completed'
                            ? 'text-foreground'
                            : isMakeup
                            ? 'text-foreground'
                            : isUpcoming
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                        }`}>
                          <span className="font-medium">
                            {match.season_week?.week_name || 'Week ?'}
                          </span>
                          {match.scheduled_date ? (
                            <span>
                              {parseLocalDate(match.scheduled_date).toLocaleDateString(
                                'en-US',
                                {
                                  month: 'short',
                                  day: 'numeric',
                                }
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">Date TBD</span>
                          )}
                        </div>
                        {/* Matchup */}
                        <div className={`font-semibold text-base ${
                          match.status === 'completed' ? 'text-foreground' : 'text-foreground'
                        }`}>
                          vs{' '}
                          {hasRealOpponent && opponent ? (
                            <span className="text-foreground">{opponent.team_name}</span>
                          ) : (
                            // Bye / withdrawn / NULL-legacy: render the
                            // descriptive bye name when available, else "BYE".
                            opponent?.team_name ?? 'BYE'
                          )}
                        </div>
                      </div>
                      {/* Status Indicator */}
                      {match.status === 'completed' && (
                        <div className="flex items-center gap-1 text-xs font-medium text-success">
                          <Trophy className="h-3 w-3" />
                          <span>Complete</span>
                        </div>
                      )}
                      {isMakeup && match.status !== 'completed' && match.status !== 'updating' && (
                        <div className="flex items-center gap-1 text-xs font-medium text-warning">
                          <AlertCircle className="h-3 w-3" />
                          <span>Makeup</span>
                        </div>
                      )}
                      {match.status === 'in_progress' && !isMakeup && (
                        <div className="flex items-center gap-1 text-xs font-medium text-info">
                          <Trophy className="h-3 w-3" />
                          <span>In Progress</span>
                        </div>
                      )}
                      {/* LO is hand-entering this match — players can't score it.
                          Shown so it's obvious why there are no scores yet. */}
                      {match.status === 'updating' && (
                        <div className="flex items-center gap-1 text-xs font-medium text-warning">
                          <AlertCircle className="h-3 w-3" />
                          <span>Updating</span>
                        </div>
                      )}
                      {match.id === upcomingMatchId && match.status !== 'in_progress' && match.status !== 'updating' && !isMakeup && match.status !== 'completed' && (
                        <div className="flex items-center gap-1 text-xs font-medium text-info">
                          <Calendar className="h-3 w-3" />
                          <span>Upcoming</span>
                        </div>
                      )}
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="px-4 pb-4">
                    {/* Show detailed match card for completed matches */}
                    {match.status === 'completed' ? (
                      <div className="pt-2">
                        <MatchDetailCard matchId={match.id} />
                      </div>
                    ) : (
                      /* Show simple info for scheduled/in-progress matches */
                      <div className="space-y-4 pt-2">
                        {/* Home/Away Indicator */}
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">
                            {teamRole === 'home' ? 'Home Game' : 'Away Game'}
                          </span>
                        </div>

                        {/* Venue - Clickable to open Google Maps */}
                        {/* Use actual_venue if set (overflow), otherwise scheduled_venue */}
                        {(() => {
                          const venue = match.actual_venue || match.scheduled_venue;
                          const isOverflow = !!match.actual_venue;
                          if (!venue) return null;
                          return (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                `${venue.name}, ${venue.street_address || ''}, ${venue.city}, ${venue.state}`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block hover:bg-muted rounded-lg p-2 -m-2 transition-colors"
                            >
                              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
                                <MapPin className="h-4 w-4 text-primary" />
                                <span>Venue</span>
                                {isOverflow && (
                                  <span className="text-xs text-warning font-medium">(overflow)</span>
                                )}
                                <span className="text-xs text-primary">(tap for directions)</span>
                              </div>
                              <div className="ml-6">
                                <p className="text-base text-foreground">
                                  {venue.name}
                                  {match.assigned_table_number && (
                                    <span className="ml-2 text-sm font-medium text-primary">
                                      Table {match.assigned_table_number}
                                    </span>
                                  )}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {venue.city}, {venue.state}
                                </p>
                              </div>
                            </a>
                          );
                        })()}

                        {/* Action Button — hidden for bye weeks (no real
                            opponent → no lineup to score). */}
                        {match.status === 'scheduled' && hasRealOpponent && (
                          <Link to={`/match/${match.id}/lineup`} className="block pt-2">
                            <Button className="w-full" loadingText="none">
                              <Trophy className="h-4 w-4 mr-2" />
                              Score Match
                            </Button>
                          </Link>
                        )}
                        {match.status === 'in_progress' && hasRealOpponent && (
                          <Link to={`/match/${match.id}/lineup`} className="block pt-2">
                            <Button className="w-full" loadingText="none">
                              <Trophy className="h-4 w-4 mr-2" />
                              Continue Scoring
                            </Button>
                          </Link>
                        )}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}

        {/* Playoff Week Placeholders */}
        {playoffWeeks.length > 0 && (
          <div className="mt-6 space-y-4">
            {playoffWeeks.map((week) => (
              <Card
                key={week.id}
                className="bg-highlight/10 border-highlight/40"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Trophy className="h-5 w-5 text-highlight" />
                      <div>
                        <div className="font-semibold text-highlight">
                          {week.week_name}
                        </div>
                        <div className="text-sm text-highlight/80">
                          {parseLocalDate(week.scheduled_date).toLocaleDateString(
                            'en-US',
                            {
                              weekday: 'long',
                              month: 'short',
                              day: 'numeric',
                            }
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-medium text-highlight italic">
                      TBD
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
