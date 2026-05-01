/**
 * @fileoverview Spectator page — all live matches in a league.
 *
 * Lets any logged-in member peek at what's happening in their league's
 * live matches tonight. Renders a vertical stack of scoreboards, one per
 * live match, each mounting its own realtime subscription so they tick
 * live as scoring happens. No interactions — read-only view.
 *
 * Route: /league/:leagueId/live
 */

import { useLocation, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useLiveMatchesForLeague } from '@/api/hooks/useMatches';
import { formatGameType, formatDayOfWeek } from '@/types/league';
import type { GameType, DayOfWeek } from '@/types/league';
import { SpectateMatchCard } from './SpectateMatchCard';

/**
 * Compose a human-readable league label from its components. Matches the
 * pattern used by TeamCard elsewhere in the app: game-type + day-of-week,
 * plus an optional division qualifier (e.g. "A", "B").
 */
function composeLeagueLabel(league: {
  game_type?: string;
  day_of_week?: string;
  division?: string | null;
}): string {
  const parts: string[] = [];
  if (league.game_type) parts.push(formatGameType(league.game_type as GameType));
  if (league.day_of_week) parts.push(formatDayOfWeek(league.day_of_week as DayOfWeek));
  const label = parts.join(' • ');
  return league.division ? `${label} (${league.division})` : label;
}

export function SpectateLiveMatches() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const location = useLocation();
  const { data: matches = [], isLoading, error } = useLiveMatchesForLeague(leagueId);

  // If the user came from a specific page (e.g., their scoring page), the
  // opening navigation passed { from, fromLabel } in route state so the back
  // button here returns them to exactly that page instead of routing through
  // the dashboard. Falls back to dashboard for direct navigation / refresh.
  const navState = (location.state ?? {}) as { from?: string; fromLabel?: string };
  const backTo = navState.from ?? '/dashboard';
  const backLabel = navState.fromLabel ?? 'Back to Dashboard';

  // Compose league label from the first match's joined league data. Every
  // match in this list belongs to the same league (the query filters on it),
  // so any match's league_* fields are correct.
  const firstLeague = (matches[0] as any)?.season?.league;
  const leagueLabel = firstLeague ? composeLeagueLabel(firstLeague) : '';

  return (
    <div className="min-h-screen bg-muted flex flex-col">
      <PageHeader
        backTo={backTo}
        backLabel={backLabel}
        title={leagueLabel || 'League'}
      >
        {/* Pulsing red dot + "Live Matches" label — traditional broadcast
            indicator that conveys "something is happening right now." */}
        <div className="flex items-center gap-2 mt-1 text-foreground">
          <span className="relative inline-flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
          <span className="text-md lg:text-xl">Live Matches</span>
          {!isLoading && matches.length > 0 && (
            <span className="text-sm text-muted-foreground">
              — {matches.length} in progress
            </span>
          )}
        </div>
      </PageHeader>

      {/* Body */}
      <main className="flex-1 overflow-y-auto px-4 py-3 space-y-6">
        {isLoading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="ml-2 text-sm">Loading live matches…</span>
          </div>
        )}

        {!isLoading && error && (
          <div className="text-center text-sm text-red-600 py-8">
            Couldn't load live matches: {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        )}

        {!isLoading && !error && matches.length === 0 && (
          <div className="text-center py-16 px-6">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-muted mb-3">
              <span className="text-3xl">🎱</span>
            </div>
            <p className="text-sm font-medium text-foreground">Nothing on the tables yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              When a match starts in {leagueLabel || 'this league'}, it'll show up here.
            </p>
          </div>
        )}

        {!isLoading &&
          matches.map((m) => {
            // Per-card week label. Makeup matches can have different weeks on
            // the same night, so each card labels its week for clarity.
            const weekName = (m as any).season_week?.week_name || '';
            const weekDate = (m as any).season_week?.scheduled_date || '';
            const subLabel = [weekName, weekDate].filter(Boolean).join(' — ');

            return (
              <section key={m.id} aria-labelledby={`match-${m.id}-heading`}>
                {subLabel && (
                  <h2
                    id={`match-${m.id}-heading`}
                    className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 px-1"
                  >
                    {subLabel}
                  </h2>
                )}
                <SpectateMatchCard match={m} />
              </section>
            );
          })}
      </main>
    </div>
  );
}
