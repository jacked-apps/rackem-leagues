/**
 * @fileoverview LeagueDuesPage — operator dues roster for a single league.
 *
 * Answers "who in this league has paid their annual dues, and who hasn't?" at a
 * glance, which previously required clicking each player one at a time. Reached
 * from the league's Finances card ("Dues" button). League-scoped because dues
 * sanctioning is per league.
 *
 * Shows a paid/unpaid summary, an All / Unpaid-only filter, and the roster.
 * Each row's name is a PlayerNameLink, so dues can be marked paid inline (its
 * popover → "Mark Dues Paid"), and the list refreshes automatically.
 */

import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DuesRosterList } from '@/components/operator/DuesRosterList';
import { fetchLeagueDuesRoster } from '@/api/queries/duesRoster';
import { getDuesYearStatus } from '@/utils/membershipUtils';

type DuesFilter = 'all' | 'unpaid';

/** Operator-facing dues roster for one league. */
export const LeagueDuesPage: React.FC = () => {
  const { leagueId } = useParams<{ leagueId: string }>();
  const [filter, setFilter] = useState<DuesFilter>('all');

  const { data: players, isLoading } = useQuery({
    queryKey: ['leagueDuesRoster', leagueId],
    queryFn: () => fetchLeagueDuesRoster(leagueId!),
    enabled: !!leagueId,
  });

  // Paid = recorded in the current calendar year; unpaid = expired + never.
  const { paidCount, unpaidCount, visible } = useMemo(() => {
    const roster = players ?? [];
    const isPaid = (date: string | null) => getDuesYearStatus(date).isPaid;
    const paid = roster.filter((p) => isPaid(p.membership_paid_date)).length;
    return {
      paidCount: paid,
      unpaidCount: roster.length - paid,
      visible:
        filter === 'unpaid'
          ? roster.filter((p) => !isPaid(p.membership_paid_date))
          : roster,
    };
  }, [players, filter]);

  const total = (players ?? []).length;

  return (
    <div className="min-h-screen bg-muted">
      <PageHeader
        backTo={`/league/${leagueId}/finances`}
        backLabel="Back to Finances"
        title="Dues Roster"
        subtitle="Annual membership dues by league"
      />

      <div className="container mx-auto max-w-2xl space-y-4 px-0 py-8 lg:px-4">
        <Card className="rounded-none lg:rounded-xl">
          <CardContent className="p-4 lg:p-6">
            {/* Summary + filter */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-success">{paidCount} paid</span>
                {' · '}
                <span className="font-semibold text-warning">{unpaidCount} unpaid</span>
                {' · '}
                {total} total
              </p>
              <div className="flex gap-2">
                <Button
                  variant={filter === 'all' ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('all')}
                >
                  All
                </Button>
                <Button
                  variant={filter === 'unpaid' ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('unpaid')}
                >
                  Unpaid only
                </Button>
              </div>
            </div>

            {isLoading ? (
              <p className="py-8 text-center text-muted-foreground">Loading roster…</p>
            ) : total === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                No players on this league's current-season rosters yet.
              </p>
            ) : visible.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                Everyone in this league is paid up for {new Date().getFullYear()}. 🎉
              </p>
            ) : (
              <DuesRosterList players={visible} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LeagueDuesPage;
