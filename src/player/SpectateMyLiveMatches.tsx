/**
 * @fileoverview Cross-league spectator page.
 *
 * Shows every currently-live match in every league where the viewing member
 * is on a team. Grouped by league, so if someone plays in multiple leagues
 * with overlapping match nights, each league gets its own section.
 *
 * Route: /live
 * Entry point: Dashboard.
 *
 * Scoping rule: a member must be on a team in a league to see that league's
 * live matches. This mirrors the product intent — spectating is for fellow
 * players, not for unaffiliated viewers.
 */

import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useUserProfile } from '@/api/hooks';
import { useLiveMatchesForMember } from '@/api/hooks/useMatches';
import { useWeekLabelsForSeasons } from '@/api/hooks/useWeekLabels';
import { formatGameType, formatDayOfWeek } from '@/types/league';
import type { GameType, DayOfWeek } from '@/types/league';
import type { MatchWithDetails } from '@/types';
import { SpectateMatchCard } from './SpectateMatchCard';

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

interface LeagueGroup {
  leagueId: string;
  label: string;
  matches: MatchWithDetails[];
}

export function SpectateMyLiveMatches() {
  const { member } = useUserProfile();
  const { data: matches = [], isLoading, error } = useLiveMatchesForMember(member?.id);

  // Week numbers are DERIVED per season from position, never the stored week_name.
  // This feed spans multiple leagues/seasons, so the hook builds a per-season map.
  const weekLabels = useWeekLabelsForSeasons(
    matches.map((m) => (m as any).season_id),
  );

  // Group matches by league. If a member is on teams in multiple leagues
  // running matches tonight, each league renders as its own titled section.
  const groups: LeagueGroup[] = useMemo(() => {
    const byLeague = new Map<string, LeagueGroup>();
    for (const m of matches) {
      const league = (m as any).season?.league;
      const leagueId = league?.id ?? 'unknown';
      if (!byLeague.has(leagueId)) {
        byLeague.set(leagueId, {
          leagueId,
          label: league ? composeLeagueLabel(league) : 'League',
          matches: [],
        });
      }
      byLeague.get(leagueId)!.matches.push(m);
    }
    return Array.from(byLeague.values());
  }, [matches]);

  return (
    <div className="min-h-screen bg-muted flex flex-col">
      <PageHeader
        backTo="/my-teams"
        backLabel="Back to My Teams"
        title="Live Matches"
      >
        <div className="flex items-center gap-2 mt-1 text-foreground">
          <span className="relative inline-flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
          </span>
          {!isLoading && matches.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {matches.length} in progress across {groups.length}{' '}
              {groups.length === 1 ? 'league' : 'leagues'}
            </span>
          )}
          {!isLoading && matches.length === 0 && (
            <span className="text-sm text-muted-foreground">Nothing happening right now</span>
          )}
        </div>
      </PageHeader>

      <main className="flex-1 overflow-y-auto px-4 py-3 space-y-6">
        {isLoading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="ml-2 text-sm">Loading live matches…</span>
          </div>
        )}

        {!isLoading && error && (
          <div className="text-center text-sm text-destructive py-8">
            Couldn't load live matches: {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        )}

        {!isLoading && !error && groups.length === 0 && (
          <div className="text-center py-16 px-6">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-muted mb-3">
              <span className="text-3xl">🎱</span>
            </div>
            <p className="text-sm font-medium text-foreground">
              Nothing on the tables yet.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              When a match starts in any of your leagues, it'll show up here.
            </p>
          </div>
        )}

        {!isLoading &&
          groups.map((g) => (
            <section key={g.leagueId} className="space-y-4">
              <h2 className="text-sm font-semibold text-foreground border-b pb-1">
                {g.label}
              </h2>
              {g.matches.map((m) => {
                const weekName =
                  weekLabels.get((m as any).season_week?.id) ||
                  (m as any).season_week?.week_name ||
                  '';
                const weekDate = (m as any).season_week?.scheduled_date || '';
                const subLabel = [weekName, weekDate].filter(Boolean).join(' — ');
                return (
                  <div key={m.id}>
                    {subLabel && (
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 px-1">
                        {subLabel}
                      </div>
                    )}
                    <SpectateMatchCard match={m} />
                  </div>
                );
              })}
            </section>
          ))}
      </main>
    </div>
  );
}
