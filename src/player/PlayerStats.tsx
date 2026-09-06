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

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { usePlayerGameHistory } from '@/api/hooks/usePlayerGameHistory';
import { summarizeGames } from '@/stats/summarizeGames';
import { StatsSummary } from '@/components/stats/StatsSummary';
import { GameLogTable } from '@/components/stats/GameLogTable';

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

  // Recomputed only when the rows change. Once filters arrive this same call
  // runs over the filtered set, which is what makes the counts respond rather
  // than merely hiding table rows.
  const summary = useMemo(() => summarizeGames(rows ?? []), [rows]);

  return (
    <div className="min-h-screen bg-muted">
      <PageHeader
        backTo="/my-teams"
        backLabel="Home"
        title="My Stats"
        subtitle="Your record across every league you play in"
      />
      <div className="container mx-auto max-w-4xl space-y-4 px-4 py-6">
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
            <StatsSummary summary={summary} />
            <GameLogTable rows={rows} />
          </>
        )}
      </div>
    </div>
  );
}
