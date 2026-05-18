/**
 * @fileoverview Top-level "Finances" section for the league page.
 *
 * Composes the settings card + running projection card. Mounted on
 * `LeagueDetail.tsx` between the league overview and the teams
 * section. Eventually wires to the payout calculator (Unit 4) +
 * expenses list (Unit 3) as those land.
 */

import { useState } from 'react';
import { useLeagueFinances } from '@/api/hooks/useLeagueFinances';
import { useResolvedLeaguePrefs } from '@/api/hooks/useResolvedLeaguePrefs';
import { LoadingState } from '@/components/shared';
import { FinanceSettingsCard } from './FinanceSettingsCard';
import { RunningProjectionCard } from './RunningProjectionCard';

interface LeagueFinancesSectionProps {
  leagueId: string;
  /** Number of active teams in the current/upcoming season. */
  teamCount: number;
  /** Total regular-season weeks for the current/upcoming season. */
  totalWeeks: number;
}

export function LeagueFinancesSection({
  leagueId,
  teamCount,
  totalWeeks,
}: LeagueFinancesSectionProps) {
  const { data: finances, isLoading } = useLeagueFinances(leagueId);
  const { data: prefs } = useResolvedLeaguePrefs(leagueId);
  // Placeholder hook for future calculator route navigation
  const [showCalculator, setShowCalculator] = useState(false);

  const lineupSize = prefs?.lineup_size ?? 5;

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
        onOpenCalculator={() => setShowCalculator(true)}
      />

      <FinanceSettingsCard leagueId={leagueId} finances={finances} />

      {/* Calculator + expense list mount here in Units 3 + 4 */}
      {showCalculator && (
        <div className="p-4 border border-dashed rounded-lg text-sm text-muted-foreground text-center">
          Payout calculator coming in Unit 4. (Click handler placeholder.)
        </div>
      )}
    </div>
  );
}
