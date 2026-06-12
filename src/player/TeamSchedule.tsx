/**
 * @fileoverview Team Schedule Page (Player View)
 *
 * Mobile-first season calendar for a team. Walks EVERY week in the season —
 * matches AND blackout (off) weeks — interleaved by date, so a player can see
 * "oh, I don't play next week" at a glance.
 *
 * Each row is color-coded AND labeled/iconed by state (the label + icon carry
 * the meaning so it reads fine without color):
 *   Final · Live · Updating · Makeup · Next up · Scheduled · Bye · No matches · TBD
 * A bye (opponent is a BYE) reads the same as a blackout — you're off either way.
 *
 * Flow: My Teams → View Schedule → see the whole season.
 */

import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { useMatchesByTeam, useTeamDetails, useSeasonWeeks } from '@/api/hooks';
import type { MatchWithDetails } from '@/types';
import type { SeasonWeek } from '@/api/queries/matches';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  CalendarOff,
  MapPin,
  Trophy,
  AlertCircle,
  ArrowRight,
  EyeOff,
  Eye,
} from 'lucide-react';
import { parseLocalDate } from '@/utils/formatters';
import { MatchDetailCard } from '@/components/MatchDetailCard';
import { PageHeader } from '@/components/PageHeader';

/** Every state a schedule row can be in. */
type WeekEntryKind =
  | 'completed'
  | 'live'
  | 'updating'
  | 'makeup'
  | 'upcoming'
  | 'future'
  | 'bye'
  | 'blackout'
  | 'playoffTbd';

/** One row in the season calendar — a week, plus the team's match if any. */
interface WeekEntry {
  week: SeasonWeek;
  match: MatchWithDetails | null;
  kind: WeekEntryKind;
  /** Match rows expand (venue / scorecard); off-weeks are static. */
  expandable: boolean;
}

type StateMeta = {
  /** Distinct text label — the primary, color-independent signal. */
  label: string;
  /** Distinct icon — the secondary color-independent signal. */
  Icon: React.ComponentType<{ className?: string }>;
  /** Badge text color (bonus layer). */
  badge: string;
  /** Card background tint (bonus layer). */
  card: string;
};

/**
 * State → {label, icon, colors}. Label + icon are always distinct so the state
 * is legible without relying on color (Ed is colorblind). "Next up" (your next
 * match) reads differently from "Scheduled" (later ones); bye + blackout share
 * the muted "you're off" treatment.
 */
const STATE_META: Record<WeekEntryKind, StateMeta> = {
  completed: { label: 'Final', Icon: Trophy, badge: 'text-success', card: 'bg-success/10 border-success/40' },
  live: { label: 'Live', Icon: Trophy, badge: 'text-info', card: 'bg-info/10 border-info/40' },
  updating: { label: 'Updating', Icon: AlertCircle, badge: 'text-warning', card: 'bg-warning/10 border-warning/40' },
  makeup: { label: 'Makeup', Icon: AlertCircle, badge: 'text-warning', card: 'bg-warning/10 border-warning/40' },
  upcoming: { label: 'Next up', Icon: ArrowRight, badge: 'text-info', card: 'bg-info/10 border-info/40' },
  future: { label: 'Scheduled', Icon: Calendar, badge: 'text-muted-foreground', card: 'bg-card' },
  bye: { label: 'Bye — off', Icon: CalendarOff, badge: 'text-muted-foreground', card: 'bg-muted/60 border-border' },
  blackout: { label: 'No matches', Icon: CalendarOff, badge: 'text-muted-foreground', card: 'bg-muted/60 border-border' },
  playoffTbd: { label: 'TBD', Icon: Trophy, badge: 'text-highlight', card: 'bg-highlight/10 border-highlight/40' },
};

/** "Oct 12" or "Date TBD". */
function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return 'Date TBD';
  return parseLocalDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** A non-playable week (blackout / bye / playoff-TBD) — a static, no-expand row. */
function ScheduleStaticRow({ entry }: { entry: WeekEntry }) {
  const meta = STATE_META[entry.kind];
  const { Icon } = meta;
  // Headline is the week's name — the holiday for a blackout ("Christmas Eve"),
  // "Week 5" for a bye, the playoff week name for TBD. The badge says what it is.

  return (
    <Card className={meta.card}>
      <CardContent className="flex items-center justify-between gap-2 p-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{formatShortDate(entry.week.scheduled_date)}</div>
          <div className="truncate text-base font-semibold text-foreground">{entry.week.week_name}</div>
        </div>
        <span className={`flex shrink-0 items-center gap-1 text-xs font-medium ${meta.badge}`}>
          <Icon className="h-3.5 w-3.5" />
          {meta.label}
        </span>
      </CardContent>
    </Card>
  );
}

export function TeamSchedule() {
  const { teamId } = useParams<{ teamId: string }>();
  const [hideCompleted, setHideCompleted] = useState(false);

  const { data: team, isLoading: teamLoading, error: teamError } = useTeamDetails(teamId);
  const { data: matches = [], isLoading: matchesLoading, error: matchesError } = useMatchesByTeam(teamId);

  const seasonId = team?.season?.id;
  const { data: seasonWeeks = [], isLoading: weeksLoading } = useSeasonWeeks(seasonId);

  const loading = teamLoading || matchesLoading || (!!seasonId && weeksLoading);
  const error = teamError || matchesError ? 'Failed to load team schedule' : null;

  /** Is this team home or away in the match? */
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
              <Button variant="outline" className="mt-4" loadingText="none">
                Back to My Teams
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Day of week for the subtitle (all matches are the same night).
  const dayOfWeek =
    matches.length > 0 && matches[0].scheduled_date
      ? parseLocalDate(matches[0].scheduled_date).toLocaleDateString('en-US', { weekday: 'long' })
      : null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  /** Past-due, not completed → needs a makeup. */
  const needsMakeup = (match: MatchWithDetails): boolean => {
    if (match.status === 'completed' || !match.scheduled_date) return false;
    return parseLocalDate(match.scheduled_date) < today;
  };

  // The single "Next up" match: earliest non-completed match dated today-or-later.
  const upcomingMatchId = (() => {
    const future = matches
      .filter((m) => m.status !== 'completed' && m.scheduled_date && parseLocalDate(m.scheduled_date) >= today)
      .sort((a, b) => parseLocalDate(a.scheduled_date!).getTime() - parseLocalDate(b.scheduled_date!).getTime());
    return future[0]?.id ?? null;
  })();

  // Map each week to the team's match in it (regular + playoff weeks that exist).
  const matchByWeekId = new Map<string, MatchWithDetails>();
  matches.forEach((m) => {
    const weekId = m.season_week?.id;
    if (weekId) matchByWeekId.set(weekId, m);
  });

  // Build the unified, date-ordered calendar (seasonWeeks is already ordered).
  const entries: WeekEntry[] = [];
  for (const week of seasonWeeks) {
    const match = matchByWeekId.get(week.id) ?? null;

    if (week.week_type === 'blackout') {
      entries.push({ week, match: null, kind: 'blackout', expandable: false });
      continue;
    }

    if (match) {
      const role = getTeamRole(match);
      const opponent = role === 'home' ? match.away_team : match.home_team;
      // A bye/withdrawn opponent (or a legacy NULL one) means you're off.
      const hasRealOpponent = !!opponent && opponent.status === 'active';

      let kind: WeekEntryKind;
      let expandable = true;
      if (!hasRealOpponent) {
        kind = 'bye';
        expandable = false;
      } else if (match.status === 'completed') kind = 'completed';
      else if (match.status === 'in_progress') kind = 'live';
      else if (match.status === 'updating') kind = 'updating';
      else if (needsMakeup(match)) kind = 'makeup';
      else if (match.id === upcomingMatchId) kind = 'upcoming';
      else kind = 'future';

      entries.push({ week, match, kind, expandable });
      continue;
    }

    // No match yet: playoff weeks show as TBD; a regular week with no match for
    // this team is a data gap — skip it rather than show a phantom row.
    if (week.week_type === 'playoffs') {
      entries.push({ week, match: null, kind: 'playoffTbd', expandable: false });
    }
  }

  const displayedEntries = hideCompleted ? entries.filter((e) => e.kind !== 'completed') : entries;

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

      <main className="px-4 py-6 max-w-2xl mx-auto">
        {displayedEntries.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {hideCompleted ? 'No upcoming matches' : 'No schedule yet'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Accordion type="single" collapsible className="space-y-3">
            {displayedEntries.map((entry) => {
              // Static (no-expand) rows: blackout, bye, playoff-TBD.
              if (!entry.expandable) {
                return <ScheduleStaticRow key={entry.week.id} entry={entry} />;
              }

              // Expandable match rows.
              const match = entry.match!;
              const meta = STATE_META[entry.kind];
              const { Icon } = meta;
              const role = getTeamRole(match);
              const opponent = role === 'home' ? match.away_team : match.home_team;

              return (
                <AccordionItem
                  key={match.id}
                  value={match.id}
                  className={`border rounded-lg shadow-sm ${meta.card}`}
                >
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex w-full items-center justify-between gap-2 pr-2 text-left">
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground">
                          {entry.week.week_name} · {formatShortDate(match.scheduled_date ?? entry.week.scheduled_date)}
                        </div>
                        <div className="truncate text-base font-semibold text-foreground">
                          vs {opponent?.team_name ?? 'Opponent'}
                        </div>
                      </div>
                      <span className={`flex shrink-0 items-center gap-1 text-xs font-medium ${meta.badge}`}>
                        <Icon className="h-3.5 w-3.5" />
                        {meta.label}
                      </span>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="px-4 pb-4">
                    {match.status === 'completed' ? (
                      <div className="pt-2">
                        <MatchDetailCard matchId={match.id} />
                      </div>
                    ) : (
                      <div className="space-y-4 pt-2">
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">{role === 'home' ? 'Home Game' : 'Away Game'}</span>
                        </div>

                        {/* Venue — clickable to Google Maps. Uses actual_venue
                            (overflow) if set, else scheduled_venue. */}
                        {(() => {
                          const venue = match.actual_venue || match.scheduled_venue;
                          const isOverflow = !!match.actual_venue;
                          if (!venue) return null;
                          return (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                `${venue.name}, ${venue.street_address || ''}, ${venue.city}, ${venue.state}`,
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block hover:bg-muted rounded-lg p-2 -m-2 transition-colors"
                            >
                              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
                                <MapPin className="h-4 w-4 text-primary" />
                                <span>Venue</span>
                                {isOverflow && <span className="text-xs text-warning font-medium">(overflow)</span>}
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

                        {match.status === 'scheduled' && (
                          <Link to={`/match/${match.id}/lineup`} className="block pt-2">
                            <Button className="w-full" loadingText="none">
                              <Trophy className="h-4 w-4 mr-2" />
                              Score Match
                            </Button>
                          </Link>
                        )}
                        {match.status === 'in_progress' && (
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
      </main>
    </div>
  );
}
