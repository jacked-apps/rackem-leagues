/**
 * @fileoverview Season Overview Page
 *
 * A read-only, at-a-glance view of a whole season for BOTH players and the league
 * operator. For each playing night it shows the week number, the date, and the list of
 * matchups (home vs away) with their venue — so anyone can see who's playing whom, and
 * where, on any given night.
 *
 * Deliberately lighter than the operator Matchups page (src/operator/SeasonSchedulePage.tsx):
 * no editing, no controls — just the schedule at a glance, one compact block per night.
 *
 * Week numbers are DERIVED from each regular week's position (via deriveWeekLabels), not
 * read from any stored label — so the numbers are always correct and gap-free.
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { Calendar } from 'lucide-react';
import { getSeasonSchedule } from '@/api/queries/matches';
import type { WeekSchedule } from '@/api/queries/matches';
import { deriveWeekLabels } from '@/utils/scheduleDisplayUtils';
import { parseLocalDate } from '@/utils/formatters';
import { logger } from '@/utils/logger';

/**
 * Format an ISO date string as a short, friendly night label, e.g. "Wed, Sep 17".
 * Uses parseLocalDate to avoid the off-by-one timezone bug on plain date strings.
 */
function formatNight(isoDate: string): string {
  return parseLocalDate(isoDate).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function SeasonOverview() {
  const { seasonId } = useParams<{ leagueId: string; seasonId: string }>();
  const navigate = useNavigate();
  // The page that linked here can pass where "back" should go + its label (e.g. the
  // player's team schedule). Falls back to plain browser-back when opened directly.
  const location = useLocation();
  const back = (location.state ?? {}) as { backTo?: string; backLabel?: string };
  const [schedule, setSchedule] = useState<WeekSchedule[]>([]);
  const [weekLabels, setWeekLabels] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!seasonId) {
        setError('No season specified');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await getSeasonSchedule(seasonId);
        setSchedule(data);
        // Build the week-number map ONCE from all weeks, then look up per row.
        setWeekLabels(deriveWeekLabels(data.map((w) => w.week)));
      } catch (err) {
        logger.error('Error loading season overview', {
          error: err instanceof Error ? err.message : String(err),
        });
        setError('Unable to load the season schedule');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [seasonId]);

  // A blackout / season-end-break is an "off week" — shown as a slim two-line block
  // (no matchups), with its reason centered underneath.
  const isOffWeek = (weekType: string) =>
    weekType === 'blackout' || weekType === 'season_end_break';

  // Every night worth showing: the off weeks, plus play weeks that actually have
  // matchups (regular + playoffs).
  const nights = schedule.filter(
    (w) => isOffWeek(w.week.week_type) || w.matches.length > 0
  );

  return (
    <div className="min-h-screen bg-muted">
      <PageHeader
        backTo={back.backTo}
        onBackClick={back.backTo ? undefined : () => navigate(-1)}
        backLabel={back.backLabel ?? 'Back'}
        title="Season Overview"
        subtitle="Who's playing whom, and where, on every night of the season."
      />

      <main className="px-4 py-6 max-w-3xl mx-auto">
        {loading ? (
          <p className="text-center text-muted-foreground">Loading season overview...</p>
        ) : error ? (
          <p className="text-center text-destructive">{error}</p>
        ) : nights.length === 0 ? (
          <p className="text-muted-foreground">No schedule yet.</p>
        ) : (
          <div className="space-y-3">
          {nights.map(({ week, matches }) =>
            isOffWeek(week.week_type) ? (
              // Off week: "Week Off · date", reason centered underneath.
              <Card key={week.id} className="gap-0 py-0">
                <CardHeader className="px-4 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base text-muted-foreground">Week Off</CardTitle>
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {formatNight(week.scheduled_date)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pt-0 pb-2">
                  <p className="text-center text-lg font-bold text-primary">
                    {weekLabels.get(week.id)}
                  </p>
                </CardContent>
              </Card>
            ) : (
              // Play night: "Week N · date", then one line per matchup.
              <Card key={week.id} className="gap-0 py-0">
                <CardHeader className="px-4 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base">{weekLabels.get(week.id)}</CardTitle>
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {formatNight(week.scheduled_date)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pt-0 pb-2">
                  <ul className="divide-y">
                    {[...matches]
                      .sort((a, b) => a.match_number - b.match_number)
                      .map((match) => (
                        <li key={match.id} className="py-1.5 text-sm">
                          {match.home_team?.team_name ?? 'TBD'}
                          <span className="text-muted-foreground"> vs </span>
                          {match.away_team?.team_name ?? 'TBD'}
                          {match.scheduled_venue?.name && (
                            <span className="text-muted-foreground">
                              {' '}@ {match.scheduled_venue.name}
                            </span>
                          )}
                        </li>
                      ))}
                  </ul>
                </CardContent>
              </Card>
            )
          )}
          </div>
        )}
      </main>
    </div>
  );
}

export default SeasonOverview;
