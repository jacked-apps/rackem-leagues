/**
 * @fileoverview RunningProjectionCard — read-mostly view of the
 * projected season finances. Computes everything live from the
 * resolved settings + the current season's team/week counts.
 *
 * Per Ed: "mid-season projection is a sanity check, not the main
 * use case." So this card shows the numbers but doesn't accept
 * input — that's the calculator's job.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import {
  computeProjectedIncome,
  computeProjectedGreenFees,
  computeAppFee,
  computeLoCut,
} from '@/utils/finances';
import type { ResolvedFinanceSettings, DroppedTeam } from '@/utils/finances';

interface RunningProjectionCardProps {
  finances: ResolvedFinanceSettings;
  lineupSize: number;
  teamCount: number;
  totalWeeks: number;
  /** Pool-funded expenses to subtract (excludes lo_funded ones). */
  totalExpenses?: number;
  /** Sponsor / outside-income credits to add. */
  totalCredits?: number;
  /** Teams that dropped mid-season — reduces formula income. */
  droppedTeams?: DroppedTeam[];
}

export function RunningProjectionCard({
  finances,
  lineupSize,
  teamCount,
  totalWeeks,
  totalExpenses = 0,
  totalCredits = 0,
  droppedTeams = [],
}: RunningProjectionCardProps) {
  // Live computations
  const income = computeProjectedIncome({
    pricePerPlayerPerNight: finances.pricePerPlayerPerNight,
    lineupSize,
    teamCount,
    totalWeeks,
    droppedTeams,
  });
  const greenFees = computeProjectedGreenFees({
    greenFeePerPlayerPerNight: finances.greenFeePerPlayerPerNight,
    lineupSize,
    teamCount,
    totalWeeks,
    droppedTeams,
  });
  const appFee = computeAppFee({ teamCount, totalWeeks });
  const preCutPool = Math.max(0, income - greenFees - appFee);
  const loCut = computeLoCut({
    kind: finances.loCutKind,
    flatPerWeek: finances.loCutFlatPerWeek,
    percent: finances.loCutPercent,
    totalWeeks,
    preCutPool,
  });
  const projectedPrizePool = Math.max(0, preCutPool - loCut - totalExpenses + totalCredits);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-green-600" />
          Projected Prize Pool
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Based on {teamCount} team{teamCount === 1 ? '' : 's'} × {lineupSize} players × {totalWeeks} weeks
          at ${finances.pricePerPlayerPerNight.toFixed(2)} per player per night.
        </p>

        <div className="space-y-2 text-sm">
          <Row label="Total income (formula)" value={income} positive />
          {droppedTeams.length > 0 && (
            <p className="text-xs text-muted-foreground italic pl-4">
              ↳ Already adjusted for {droppedTeams.length} dropped team{droppedTeams.length === 1 ? '' : 's'}
            </p>
          )}
          <Row label="− Green fees to venue" value={-greenFees} />
          <Row
            label={`− App fee (${teamCount} × ${totalWeeks} × $1 + $10)`}
            value={-appFee}
          />
          <Row label="− Your LO cut" value={-loCut} />
          {totalExpenses > 0 && (
            <Row label="− Other expenses" value={-totalExpenses} />
          )}
          {totalCredits > 0 && (
            <Row label="+ Outside income / sponsors" value={totalCredits} positive />
          )}
          <div className="border-t pt-2 mt-2">
            <Row
              label="Projected prize pool"
              value={projectedPrizePool}
              bold
              positive
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground italic">
          These are projections. Expenses, dropped teams, and sponsor income
          adjust the actual pool — set those in the Expenses card below.
        </p>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  bold = false,
  positive = false,
}: {
  label: string;
  value: number;
  bold?: boolean;
  positive?: boolean;
}) {
  const sign = value < 0 ? '−' : '';
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
  return (
    <div className={['flex justify-between', bold && 'font-semibold text-base'].filter(Boolean).join(' ')}>
      <span className={bold ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
      <span
        className={[
          bold ? 'text-foreground' : '',
          positive ? 'text-green-700 dark:text-green-400' : '',
          value < 0 ? 'text-red-700 dark:text-red-400' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {sign}
        {formatted.replace('$', '$')}
      </span>
    </div>
  );
}
