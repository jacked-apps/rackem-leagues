/**
 * @fileoverview My Stats — a player's own record, in detail.
 *
 * At `/stats`. Replaces the placeholder that stood here so the drawer's "Stats"
 * entry resolved to something.
 *
 * Shows the record, how those games ended, and every rack played. The endings
 * breakdown is the reason the page exists: a win-loss line cannot tell two
 * players apart, and how they lost can. Someone losing repeatedly to break &
 * runs is a different player from someone with the same record who never faces
 * one.
 *
 * The whole history loads once. Filters (Unit 4) will then narrow both the
 * summary and the list with no further requests, which is what keeps the page
 * responsive instead of spinner-driven.
 *
 * @see docs/plans/2026-09-06-001-feat-my-stats-page-plan.md (Unit 3)
 */

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { usePlayerGameHistory } from '@/api/hooks/usePlayerGameHistory';
import { summarizeGames } from '@/stats/summarizeGames';
import { applyGameFilter, NO_FILTER, type GameFilter } from '@/stats/gameFilters';
import { buildFilterOptions } from '@/stats/filterOptions';
import { StatsSummary } from '@/components/stats/StatsSummary';
import { GameLogTable } from '@/components/stats/GameLogTable';
import { FilterBar } from '@/components/stats/FilterBar';
import { BetaNotice } from '@/components/stats/BetaNotice';

/** A one-line message in the page's normal frame. */
function Notice({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardContent className="space-y-2 py-6">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}

/**
 * The player's own stats across every league and season they have played.
 */
export function PlayerStats() {
  const { data: rows, isLoading, isError, error } = usePlayerGameHistory();
  const [filter, setFilter] = useState<GameFilter>(NO_FILTER);

  const all = useMemo(() => rows ?? [], [rows]);

  // Counted against the rows surviving every OTHER filter, so each control's
  // numbers predict what picking that option actually gives. Counting against
  // the whole history instead showed "Billy (22)" while Fargo was selected and
  // then returned nothing, because none of Billy's games were Fargo ones.
  const options = useMemo(() => buildFilterOptions(all, filter), [all, filter]);

  const filtered = useMemo(() => applyGameFilter(all, filter), [all, filter]);

  // Summarised from the FILTERED rows, which is what makes "my record on table
  // 2" an actual record rather than the same totals with fewer rows beneath.
  // Pure array work, so changing a filter costs no request and no spinner.
  const summary = useMemo(() => summarizeGames(filtered), [filtered]);

  return (
    <div className="min-h-screen bg-muted">
      <PageHeader
        backTo="/my-teams"
        backLabel="Home"
        title="My Stats"
        subtitle="Your record across every league you play in"
      />
      <div className="container mx-auto max-w-4xl space-y-4 px-4 py-6">
        <BetaNotice />

        {isLoading && (
          <Notice title="Loading your games" body="This only happens once per visit." />
        )}

        {isError && (
          <Notice
            title="Could not load your games"
            body={
              error instanceof Error
                ? error.message
                : 'Something went wrong fetching your history.'
            }
          />
        )}

        {/* An empty history is not an error, and saying so plainly beats a
            page of zeroes that looks like something failed. Only reachable
            once loading has finished, so it can't flash during the fetch. */}
        {!isLoading && !isError && rows?.length === 0 && (
          <Notice
            title="No games yet"
            body="Once you have played some matches, your record will appear here."
          />
        )}

        {!isLoading && !isError && !!rows?.length && (
          <>
            <FilterBar
              filter={filter}
              options={options}
              onChange={setFilter}
              onReset={() => setFilter(NO_FILTER)}
              matchCount={filtered.length}
            />
            {/* Filtering to nothing is a normal thing to do by accident — say so
                rather than showing a summary of zero games, which reads as a
                broken page rather than as an over-narrow filter. */}
            {filtered.length === 0 ? (
              <Notice
                title="No games match these filters"
                body="Try widening one of them, or clear them to see everything again."
              />
            ) : (
              <>
                <StatsSummary summary={summary} />
                <GameLogTable rows={filtered} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
