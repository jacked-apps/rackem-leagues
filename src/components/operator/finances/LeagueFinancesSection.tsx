/**
 * @fileoverview Top-level "Finances" section for the league page.
 *
 * Composes the settings card + running projection card + expenses
 * card + dropped-teams card. Mounted on `LeagueDetail.tsx` between
 * the league overview and the teams section. Wires to the payout
 * calculator (Unit 4) as that lands.
 */

import { useMemo } from 'react';
import { useLeagueFinances } from '@/api/hooks/useLeagueFinances';
import { useResolvedLeaguePrefs } from '@/api/hooks/useResolvedLeaguePrefs';
import { useSeasonFinanceEntries } from '@/api/hooks/useSeasonFinanceEntries';
import { LoadingState } from '@/components/shared';
import { FinanceSettingsCard } from './FinanceSettingsCard';
import { RunningProjectionCard } from './RunningProjectionCard';
import { SeasonExpensesCard } from './SeasonExpensesCard';
import { DroppedTeamsCard } from './DroppedTeamsCard';
import { PayoutCalculatorCard } from './PayoutCalculatorCard';
import type { DroppedTeam } from '@/utils/finances';

interface LeagueFinancesSectionProps {
  leagueId: string;
  /** Active season ID — required to load + manage line items. May be null if no season exists yet. */
  seasonId: string | null;
  /** Number of active teams in the current/upcoming season. */
  teamCount: number;
  /** Total regular-season weeks for the current/upcoming season. */
  totalWeeks: number;
}

export function LeagueFinancesSection({
  leagueId,
  seasonId,
  teamCount,
  totalWeeks,
}: LeagueFinancesSectionProps) {
  const { data: finances, isLoading } = useLeagueFinances(leagueId);
  const { data: prefs } = useResolvedLeaguePrefs(leagueId);
  const { data: entries = [] } = useSeasonFinanceEntries(seasonId ?? undefined);

  const lineupSize = prefs?.lineup_size ?? 5;

  // Roll up entry types so the projection card stays a pure render
  const { totalExpenses, totalCredits, droppedTeams } = useMemo(() => {
    let expenses = 0;
    let credits = 0;
    const drops: DroppedTeam[] = [];
    for (const e of entries) {
      if (e.entry_type === 'expense' && !e.lo_funded) {
        expenses += e.amount ?? 0;
      } else if (e.entry_type === 'credit') {
        credits += e.amount ?? 0;
      } else if (e.entry_type === 'dropped_team' && e.dropped_at_week != null) {
        drops.push({ teamId: e.dropped_team_id ?? e.id, droppedAtWeek: e.dropped_at_week });
      }
    }
    return { totalExpenses: expenses, totalCredits: credits, droppedTeams: drops };
  }, [entries]);

  if (isLoading || !finances) {
    return (
      <div className="mb-6">
        <LoadingState message="Loading finance settings..." />
      </div>
    );
  }

  return (
    <div className="mb-6 space-y-4">
      <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
        💰 League Finances
      </h2>

      <RunningProjectionCard
        finances={finances.resolved}
        lineupSize={lineupSize}
        teamCount={teamCount}
        totalWeeks={totalWeeks}
        totalExpenses={totalExpenses}
        totalCredits={totalCredits}
        droppedTeams={droppedTeams}
      />

      <PayoutCalculatorCard
        finances={finances.resolved}
        lineupSize={lineupSize}
        teamCount={teamCount}
        totalWeeks={totalWeeks}
        totalExpenses={totalExpenses}
        totalCredits={totalCredits}
        droppedTeams={droppedTeams}
      />

      <FinanceSettingsCard leagueId={leagueId} finances={finances} />

      {seasonId && (
        <>
          <SeasonExpensesCard seasonId={seasonId} />
          <DroppedTeamsCard seasonId={seasonId} totalWeeks={totalWeeks} />
        </>
      )}

      {!seasonId && (
        <div className="p-4 border border-dashed rounded-lg text-sm text-muted-foreground text-center">
          Start a season to track expenses, credits, and dropped teams.
        </div>
      )}
    </div>
  );
}
