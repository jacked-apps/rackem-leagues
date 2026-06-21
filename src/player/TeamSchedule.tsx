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
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  CalendarRange,
  CalendarOff,
  MapPin,
  Trophy,
  CircleCheck,
  AlertCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  EyeOff,
  Eye,
} from 'lucide-react';
import { parseLocalDate } from '@/utils/formatters';
import { deriveWeekLabels } from '@/utils/scheduleDisplayUtils';
import { MatchDetailCard } from '@/components/MatchDetailCard';
import { TeamNameLink } from '@/components/TeamNameLink';
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
  /** Derived display label ("Week 5", "Christmas", "Playoffs") — never week_name. */
  label: string;
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
  // Neutral tint + check icon — a completed match can be a win OR a loss, so
  // the card itself stays neutral and the Won/Lost/Tied outcome (with the word,
  // colorblind-safe) carries the result. Trophy is reserved for live/playoff.
  completed: { label: 'Final', Icon: CircleCheck, badge: 'text-muted-foreground', card: 'bg-card' },
  // Live + Next up moved OFF blue — blue is reserved for clickable links.
  live: { label: 'Live', Icon: Trophy, badge: 'text-destructive', card: 'bg-destructive/10 border-destructive/40' },
  updating: { label: 'Updating', Icon: AlertCircle, badge: 'text-warning', card: 'bg-warning/10 border-warning/40' },
  makeup: { label: 'Makeup', Icon: AlertCircle, badge: 'text-warning', card: 'bg-warning/10 border-warning/40' },
  upcoming: { label: 'Next up', Icon: ArrowRight, badge: 'text-foreground', card: 'bg-foreground/5 border-foreground/20' },
  future: { label: 'Scheduled', Icon: Calendar, badge: 'text-muted-foreground', card: 'bg-card' },
  bye: { label: 'Bye — off', Icon: CalendarOff, badge: 'text-muted-foreground', card: 'bg-muted/60 border-border' },
  blackout: { label: 'No matches', Icon: CalendarOff, badge: 'text-muted-foreground', card: 'bg-muted/60 border-border' },
  playoffTbd: { label: 'TBD', Icon: Trophy, badge: 'text-highlight', card: 'bg-highlight/10 border-highlight/40' },
};

/** Compact numeric month/day, e.g. "6/11" (or "Date TBD"). */
function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return 'Date TBD';
  const d = parseLocalDate(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** Contextual "score this match" link text per state, or null when there's no
 *  player-scoreable action (updating / completed). */
function scoreLinkLabel(kind: WeekEntryKind): string | null {
  switch (kind) {
    case 'live':
      return 'Score match in progress';
    case 'makeup':
      return 'Score Makeup match';
    case 'upcoming':
      return 'Score Match';
    case 'future':
      return 'Score Match Early';
    default:
      return null;
  }
}

/**
 * Win/Loss/Tie outcome for THIS team in a completed match. Just the word —
 * "Win" / "Loss" / "Tie" — which is the only result detail that's meaningful
 * across ALL scoring systems (the actual score lives in the dropdown, where it
 * can be shown in that system's own units). The word carries the meaning so it
 * reads without color (Ed is colorblind); color is a bonus layer. Prefers the
 * authoritative `match_result` column, falling back to a games-won comparison
 * for legacy rows. Returns null if the result isn't in yet.
 */
function completedOutcome(
  match: MatchWithDetails,
  role: 'home' | 'away' | null,
): { word: string; tone: string } | null {
  const home = match.home_games_won;
  const away = match.away_games_won;
  if (home == null || away == null || !role) return null;

  const result =
    match.match_result ?? (home > away ? 'home_win' : away > home ? 'away_win' : 'tie');
  const tie = result === 'tie';
  const weWon =
    (result === 'home_win' && role === 'home') || (result === 'away_win' && role === 'away');

  const word = tie ? 'Tie' : weWon ? 'Win' : 'Loss';
  const tone = tie ? 'text-muted-foreground' : weWon ? 'text-success' : 'text-destructive';
  return { word, tone };
}

/** A non-playable week (blackout / bye / playoff-TBD) — a static, no-expand row. */
function ScheduleStaticRow({ entry }: { entry: WeekEntry }) {
  const meta = STATE_META[entry.kind];
  const { Icon } = meta;
  // Headline is the week's name — the holiday for a blackout ("Christmas Eve"),
  // "Week 5" for a bye, the playoff week name for TBD. The badge says what it is.

  return (
    <Card className={`gap-0 py-0 ${meta.card}`}>
      <CardContent className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{formatShortDate(entry.week.scheduled_date)}</div>
          <div className="truncate text-base font-semibold text-foreground">{entry.label}</div>
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
  // Second filter: hide the weeks you don't play (blackouts + byes) to show
  // only playing dates.
  const [hideOffWeeks, setHideOffWeeks] = useState(false);
  // Which completed match (if any) has its full box score expanded. The list
  // stays compact by default; tapping a result opens the scorecard in place so
  // no information is lost — only deferred until asked for.
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

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

  // Week numbers are DERIVED from each week's position by date (never the stored
  // week_name, which can drift/collide — e.g. a duplicate "Week 14").
  const weekLabels = deriveWeekLabels(seasonWeeks);

  // Build the unified, date-ordered calendar (seasonWeeks is already ordered).
  const entries: WeekEntry[] = [];
  for (const week of seasonWeeks) {
    const match = matchByWeekId.get(week.id) ?? null;
    const label = weekLabels.get(week.id) ?? week.week_name;

    if (week.week_type === 'blackout') {
      entries.push({ week, label, match: null, kind: 'blackout', expandable: false });
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

      entries.push({ week, label, match, kind, expandable });
      continue;
    }

    // No match yet: playoff weeks show as TBD; a regular week with no match for
    // this team is a data gap — skip it rather than show a phantom row.
    if (week.week_type === 'playoffs') {
      entries.push({ week, label, match: null, kind: 'playoffTbd', expandable: false });
    }
  }

  const displayedEntries = entries.filter((e) => {
    if (hideCompleted && e.kind === 'completed') return false;
    if (hideOffWeeks && (e.kind === 'blackout' || e.kind === 'bye')) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-muted">
      <PageHeader
        backTo="/my-teams"
        backLabel="Back to My Teams"
        title={team.team_name}
        subtitle={dayOfWeek ? `${dayOfWeek}s` : undefined}
      />

      <main className="px-4 py-6 max-w-2xl mx-auto">
        {/* Jump to the whole-season at-a-glance view (who plays whom, where, every
            night) — players can't reach the league pages, so the entry lives here. */}
        {team.season?.league?.id && team.season?.id && (
          <div className="mb-4 flex justify-center">
            <Link
              to={`/league/${team.season.league.id}/season/${team.season.id}/overview`}
              state={{ backTo: `/team/${teamId}/schedule`, backLabel: 'Back to Schedule' }}
            >
              <Button
                variant="outline"
                size="sm"
                loadingText="none"
                className="h-8 gap-1.5 rounded-full px-4 text-xs"
              >
                <CalendarRange className="h-4 w-4" />
                Season Overview
              </Button>
            </Link>
          </div>
        )}

        {/* Filter chips — tap to hide a category. Filled (+ "off" icon) = that
            category is hidden; the icon carries the state without relying on color. */}
        <div className="mb-4 flex justify-center gap-2">
          <Button
            type="button"
            variant={hideCompleted ? 'outline' : 'default'}
            size="sm"
            loadingText="none"
            onClick={() => setHideCompleted(!hideCompleted)}
            aria-pressed={!hideCompleted}
            className="h-7 gap-1 rounded-full px-3 text-xs"
          >
            {hideCompleted ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            Completed
          </Button>
          <Button
            type="button"
            variant={hideOffWeeks ? 'outline' : 'default'}
            size="sm"
            loadingText="none"
            onClick={() => setHideOffWeeks(!hideOffWeeks)}
            aria-pressed={!hideOffWeeks}
            className="h-7 gap-1 rounded-full px-3 text-xs"
          >
            {hideOffWeeks ? <CalendarOff className="h-3.5 w-3.5" /> : <Calendar className="h-3.5 w-3.5" />}
            Off weeks
          </Button>
        </div>

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
          <div className="space-y-3">
            {displayedEntries.map((entry) => {
              // Static rows: blackout, bye, playoff-TBD.
              if (!entry.expandable) {
                return <ScheduleStaticRow key={entry.week.id} entry={entry} />;
              }

              // Match rows — flat cards (no accordion); everything visible.
              const match = entry.match!;
              const meta = STATE_META[entry.kind];
              const { Icon } = meta;
              const role = getTeamRole(match);
              const opponent = role === 'home' ? match.away_team : match.home_team;
              // Final result (our score first) for completed cards; null otherwise.
              const outcome =
                match.status === 'completed' ? completedOutcome(match, role) : null;
              const isExpanded = expandedMatchId === match.id;

              const venue = match.actual_venue || match.scheduled_venue;
              const mapsUrl = venue
                ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${venue.name}, ${venue.street_address || ''}, ${venue.city}, ${venue.state}`,
                  )}`
                : null;

              return (
                <Card key={match.id} className={`gap-0 py-0 shadow-sm ${meta.card}`}>
                  <CardContent className="px-3 py-2">
                    {/* Row 1: week·date  ───  status tag, OR (completed) the big
                        Win/Loss/Tie result that toggles the box-score dropdown.
                        A finished match needs no "Final" tag — the result word
                        says it's done; the score lives in the dropdown (the only
                        place it can be shown in each system's own units). */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 truncate text-base text-foreground">
                        {entry.label} ·{' '}
                        <span className="font-bold">
                          {formatShortDate(match.scheduled_date ?? entry.week.scheduled_date)}
                        </span>
                      </div>
                      {entry.kind === 'completed'
                        ? outcome && (
                            <Button
                              type="button"
                              variant="ghost"
                              loadingText="none"
                              onClick={() => setExpandedMatchId(isExpanded ? null : match.id)}
                              aria-expanded={isExpanded}
                              aria-label={`${outcome.word} — ${isExpanded ? 'hide' : 'show'} box score`}
                              className={`h-auto shrink-0 items-center gap-2 p-0 text-lg font-bold hover:bg-transparent ${outcome.tone}`}
                            >
                              {outcome.word}
                              {isExpanded ? (
                                <ChevronUp className="h-5 w-5" />
                              ) : (
                                <ChevronDown className="h-5 w-5" />
                              )}
                            </Button>
                          )
                        : (
                          <span className={`flex shrink-0 items-center gap-1 text-xs font-medium ${meta.badge}`}>
                            <Icon className="h-3.5 w-3.5" />
                            {meta.label}
                          </span>
                        )}
                    </div>

                    {/* Row 2: matchup  ───  result / score link (same axis). */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 text-base font-semibold text-muted-foreground">
                        {/* "vs {team}" — clickable. Played matches stop there;
                            unplayed ones append "at 📍{venue}" for directions. */}
                        <span className="flex flex-wrap items-center gap-x-1.5">
                          <span>vs</span>
                          {opponent ? (
                            <TeamNameLink
                              teamId={opponent.id}
                              teamName={opponent.team_name}
                              className="text-base font-semibold"
                            />
                          ) : (
                            <span>Opponent</span>
                          )}
                          {match.status !== 'completed' && venue && mapsUrl && (
                            <>
                              <span className="font-normal text-muted-foreground">at</span>
                              <a
                                href={mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                <MapPin className="h-4 w-4" />
                                {venue.name}
                              </a>
                            </>
                          )}
                        </span>
                      </div>

                      {/* Right: score link for unplayed states. A completed
                          match's result lives on Row 1, so nothing here. */}
                      {match.status !== 'completed' && scoreLinkLabel(entry.kind) && (
                        <Link to={`/match/${match.id}/lineup`} className="shrink-0">
                          <Button
                            variant="link"
                            loadingText="none"
                            className="h-auto gap-0.5 p-0 text-sm text-blue-600 hover:text-blue-800"
                          >
                            {scoreLinkLabel(entry.kind)}
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      )}
                    </div>

                    {/* Table / overflow (unplayed only). */}
                    {match.status !== 'completed' &&
                      (match.assigned_table_number || match.actual_venue) && (
                        <div className="text-sm text-muted-foreground">
                          {match.assigned_table_number ? `Table ${match.assigned_table_number}` : null}
                          {match.actual_venue ? (
                            <span className="text-warning">
                              {match.assigned_table_number ? ' · ' : ''}overflow venue
                            </span>
                          ) : null}
                        </div>
                      )}

                    {/* Full box score — revealed on tap so the list stays compact
                        but every detail (games, points, thresholds, verification)
                        is still here, not gone. */}
                    {match.status === 'completed' && isExpanded && (
                      <div className="mt-3">
                        <MatchDetailCard matchId={match.id} playerView weekLabel={entry.label} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
