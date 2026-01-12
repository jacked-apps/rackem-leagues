/**
 * @fileoverview Match List Page for League Operators
 *
 * Accordion-based view showing all weeks and matches for a season.
 * Allows operators to navigate to individual match data pages for
 * viewing and editing match scores.
 *
 * Features:
 * - Week-by-week accordion display
 * - Status indicators (completed/in-progress/scheduled)
 * - Filter by completion status
 * - Expand all toggle
 * - Back navigation to league page
 *
 * Route: /league/:leagueId/season/:seasonId/match-list
 */

import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSeasonSchedule } from '@/api/hooks/useMatches';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Maximize2, Minimize2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { WeekAccordionHeader } from '@/components/operator/match-list/WeekAccordionHeader';
import { MatchRow } from '@/components/operator/match-list/MatchRow';

/**
 * Filter options for match list
 */
type FilterOption = 'all' | 'incomplete' | 'completed';

/**
 * Match List Page Component
 *
 * Displays all season weeks in an accordion format with match summaries.
 * Operators can expand weeks to see individual matches and click through
 * to edit match data.
 */
export default function MatchListPage() {
  const { leagueId, seasonId } = useParams<{ leagueId: string; seasonId: string }>();
  const navigate = useNavigate();

  // Fetch season schedule (weeks with matches)
  const { data: schedule = [], isLoading, error } = useSeasonSchedule(seasonId);

  // UI state
  const [filter, setFilter] = useState<FilterOption>('all');
  const [expandAll, setExpandAll] = useState(false);
  const [openWeeks, setOpenWeeks] = useState<string[]>([]);

  /**
   * Filter schedule based on selected filter option
   * - all: Show all weeks
   * - incomplete: Show only weeks where NOT all matches are completed
   * - completed: Show only weeks where ALL matches are completed
   */
  const filteredSchedule = useMemo(() => {
    // Only show regular and playoffs weeks (not blackouts, breaks, etc.)
    const playableWeeks = schedule.filter(
      ({ week }) => week.week_type === 'regular' || week.week_type === 'playoffs'
    );

    if (filter === 'all') {
      return playableWeeks;
    }

    return playableWeeks.filter(({ week, matches }) => {
      // Playoff weeks with no matches yet are always "incomplete"
      if (week.week_type === 'playoffs' && matches.length === 0) {
        return filter === 'incomplete';
      }

      // Check if all matches are completed
      const allCompleted = matches.length > 0 && matches.every(m => m.status === 'completed');

      if (filter === 'completed') {
        return allCompleted;
      }

      // incomplete filter
      return !allCompleted;
    });
  }, [schedule, filter]);

  /**
   * Calculate which accordion items should be open
   * When expandAll is true, all filtered weeks are open
   * Otherwise, use the manually selected openWeeks
   */
  const accordionValue = useMemo(() => {
    if (expandAll) {
      return filteredSchedule.map(({ week }) => week.id);
    }
    return openWeeks;
  }, [expandAll, filteredSchedule, openWeeks]);

  /**
   * Handle accordion state changes
   */
  const handleAccordionChange = (value: string[]) => {
    setOpenWeeks(value);
    // If user manually closes a week while expand all is on, turn it off
    if (expandAll && value.length < filteredSchedule.length) {
      setExpandAll(false);
    }
  };

  /**
   * Toggle expand all state
   */
  const toggleExpandAll = () => {
    if (expandAll) {
      setExpandAll(false);
      setOpenWeeks([]);
    } else {
      setExpandAll(true);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader
          backTo={`/league/${leagueId}`}
          backLabel="Back to League"
          title="Match List"
        />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-gray-600">Loading match list...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader
          backTo={`/league/${leagueId}`}
          backLabel="Back to League"
          title="Match List"
        />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-red-600">
                Error loading matches: {(error as Error).message}
              </p>
              <div className="text-center mt-4">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/league/${leagueId}`)}
                  loadingText="none"
                >
                  Back to League
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        backTo={`/league/${leagueId}`}
        backLabel="Back to League"
        title="Match List"
        subtitle="View and manage match data"
      >
        {/* Filter and expand buttons in header */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
            loadingText="none"
          >
            All
          </Button>
          <Button
            variant={filter === 'incomplete' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('incomplete')}
            loadingText="none"
          >
            Incomplete
          </Button>
          <Button
            variant={filter === 'completed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('completed')}
            loadingText="none"
          >
            Completed
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={toggleExpandAll}
            className="flex items-center gap-2"
            loadingText="none"
          >
            {expandAll ? (
              <>
                <Minimize2 className="h-4 w-4" />
                Collapse
              </>
            ) : (
              <>
                <Maximize2 className="h-4 w-4" />
                Expand
              </>
            )}
          </Button>
        </div>
      </PageHeader>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {filteredSchedule.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-gray-500">
                No {filter !== 'all' ? filter : ''} weeks found
              </p>
            </CardContent>
          </Card>
        ) : (
          <Accordion
            type="multiple"
            value={accordionValue}
            onValueChange={handleAccordionChange}
            className="space-y-2"
          >
            {filteredSchedule.map(({ week, matches }) => {
              // Calculate completion stats
              const totalMatches = matches.length;
              const completedMatches = matches.filter(m => m.status === 'completed').length;
              const isPlayoffs = week.week_type === 'playoffs';

              return (
                <AccordionItem
                  key={week.id}
                  value={week.id}
                  className="border rounded-lg bg-white"
                >
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <WeekAccordionHeader
                      weekName={week.week_name}
                      scheduledDate={week.scheduled_date}
                      completedCount={completedMatches}
                      totalCount={totalMatches}
                      isPlayoffs={isPlayoffs}
                    />
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    {isPlayoffs && totalMatches === 0 ? (
                      <div className="text-center py-4 text-gray-500 italic">
                        Matchups TBD
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {matches.map((match) => (
                          <MatchRow
                            key={match.id}
                            match={match}
                            leagueId={leagueId!}
                            seasonId={seasonId!}
                          />
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>
    </div>
  );
}
