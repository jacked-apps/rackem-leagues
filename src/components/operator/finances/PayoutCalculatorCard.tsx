/**
 * @fileoverview The HEADLINE payout calculator. Per Ed:
 *   "go crazy on the calculate payouts nifty slick and cool side.
 *    it could be the LO says i have $x that i want to pay out
 *    figure it out please."
 *
 * Three pool-sizing modes:
 *   - auto         — formula income minus everything (default)
 *   - manual_pool  — LO types in a target pool $ amount
 *   - target_pct   — LO picks a % of the formula pool to pay out
 *
 * All distribution settings (shape, places, rounding, LO cut) are
 * live-overridable for what-if scenarios without saving back to the
 * league settings row. The "Apply to league settings" button
 * commits the overrides (Unit 5 adds lock-in to a season snapshot).
 */

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, ChevronDown, ChevronUp } from 'lucide-react';
import {
  computePayoutPlan,
  type PayoutMode,
  type PayoutShape,
  type IndividualAward,
  type ResolvedFinanceSettings,
  type DroppedTeam,
} from '@/utils/finances';
import { TeamPayoutsTable } from './TeamPayoutsTable';
import { IndividualAwardsEditor, defaultIndividualAwards } from './IndividualAwardsEditor';

interface PayoutCalculatorCardProps {
  finances: ResolvedFinanceSettings;
  lineupSize: number;
  teamCount: number;
  totalWeeks: number;
  totalExpenses: number;
  totalCredits: number;
  droppedTeams: DroppedTeam[];
}

const SHAPE_LABELS: Record<PayoutShape, string> = {
  '50_30_20': '50 / 30 / 20 (classic)',
  '40_30_20_10': '40 / 30 / 20 / 10',
  '35_25_20_12_8': '35 / 25 / 20 / 12 / 8',
  doubling: 'Doubling (1st = 2× 2nd)',
  sliding_scale: 'Sliding scale (linear)',
  flat: 'Flat (everyone equal)',
  custom: 'Custom',
};

const ROUNDING_OPTIONS = [
  { value: 0, label: 'No rounding (exact cents)' },
  { value: 5, label: 'Nearest $5' },
  { value: 10, label: 'Nearest $10' },
  { value: 25, label: 'Nearest $25 (recommended)' },
  { value: 50, label: 'Nearest $50' },
  { value: 100, label: 'Nearest $100' },
];

export function PayoutCalculatorCard({
  finances,
  lineupSize,
  teamCount,
  totalWeeks,
  totalExpenses,
  totalCredits,
  droppedTeams,
}: PayoutCalculatorCardProps) {
  // Live (un-persisted) overrides — what-if scenarios
  const [mode, setMode] = useState<PayoutMode>('auto');
  const [manualPool, setManualPool] = useState('');
  const [targetPct, setTargetPct] = useState('100');
  const [shape, setShape] = useState<PayoutShape>(finances.payoutShape);
  const [placesPaid, setPlacesPaid] = useState(finances.payoutPlacesPaid);
  const [roundingTarget, setRoundingTarget] = useState(finances.payoutRoundingTarget);
  const [individualAwards, setIndividualAwards] = useState<IndividualAward[]>(
    defaultIndividualAwards(),
  );
  const [showAdvanced, setShowAdvanced] = useState(false);

  const plan = useMemo(
    () =>
      computePayoutPlan({
        pricePerPlayerPerNight: finances.pricePerPlayerPerNight,
        greenFeePerPlayerPerNight: finances.greenFeePerPlayerPerNight,
        lineupSize,
        teamCount,
        totalWeeks,
        droppedTeams,
        loCutKind: finances.loCutKind,
        loCutFlatPerWeek: finances.loCutFlatPerWeek,
        loCutPercent: finances.loCutPercent,
        totalExpenses,
        totalCredits,
        mode,
        manualPool: parseFloat(manualPool) || 0,
        targetPayoutPercent: parseFloat(targetPct) || 0,
        payoutShape: shape,
        payoutPlacesPaid: placesPaid,
        payoutRoundingTarget: roundingTarget,
        customPayoutPercentages: null,
        individualAwards,
      }),
    [
      finances,
      lineupSize,
      teamCount,
      totalWeeks,
      droppedTeams,
      totalExpenses,
      totalCredits,
      mode,
      manualPool,
      targetPct,
      shape,
      placesPaid,
      roundingTarget,
      individualAwards,
    ],
  );

  return (
    <Card className="border-blue-200 dark:border-blue-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calculator className="h-5 w-5 text-blue-600" />
          Payout Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode toggle */}
        <div className="space-y-1">
          <Label>How should we size the prize pool?</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as PayoutMode)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto (from formula) — ${plan.prePoolDistributable.toFixed(2)}</SelectItem>
              <SelectItem value="manual_pool">Manual — I'll type the pool $ amount</SelectItem>
              <SelectItem value="target_pct">% of formula pool — pay out X%</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Per-mode input */}
        {mode === 'manual_pool' && (
          <div className="space-y-1">
            <Label htmlFor="manual-pool">Pool amount ($)</Label>
            <Input
              id="manual-pool"
              type="number"
              step="0.01"
              min="0"
              value={manualPool}
              onChange={(e) => setManualPool(e.target.value)}
              placeholder="e.g. 5000.00"
            />
          </div>
        )}
        {mode === 'target_pct' && (
          <div className="space-y-1">
            <Label htmlFor="target-pct">Target payout (% of formula pool)</Label>
            <Input
              id="target-pct"
              type="number"
              step="1"
              min="0"
              max="100"
              value={targetPct}
              onChange={(e) => setTargetPct(e.target.value)}
            />
          </div>
        )}

        {/* Distribution settings (always visible) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1 md:col-span-2">
            <Label>Payout shape</Label>
            <Select value={shape} onValueChange={(v) => setShape(v as PayoutShape)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SHAPE_LABELS) as PayoutShape[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {SHAPE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="places-paid">Places paid</Label>
            <Input
              id="places-paid"
              type="number"
              step="1"
              min="1"
              max="10"
              value={placesPaid}
              onChange={(e) => setPlacesPaid(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
          </div>
        </div>

        {/* Advanced */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            loadingText="none"
            onClick={() => setShowAdvanced((v) => !v)}
            className="gap-1 -ml-2"
          >
            {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showAdvanced ? 'Hide' : 'Show'} rounding
          </Button>
          {showAdvanced && (
            <div className="mt-2 space-y-1">
              <Label>Round each prize to:</Label>
              <Select
                value={String(roundingTarget)}
                onValueChange={(v) => setRoundingTarget(parseInt(v, 10))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROUNDING_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Pool breakdown summary */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pool before individual awards</span>
            <span className="font-medium">${plan.prePoolDistributable.toFixed(2)}</span>
          </div>
          {plan.totalIndividualAwardsFromPool > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">− Individual awards (from pool)</span>
              <span className="font-medium text-red-700 dark:text-red-400">
                −${plan.totalIndividualAwardsFromPool.toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex justify-between border-t pt-1 mt-1">
            <span className="font-semibold">Team prize pool</span>
            <span className="font-bold text-lg text-green-700 dark:text-green-400">
              ${plan.teamPool.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Team payouts table */}
        <div className="space-y-2">
          <Label>Team payouts</Label>
          <TeamPayoutsTable allocations={plan.prizeAllocations} totalPool={plan.teamPool} />
        </div>

        {/* Individual awards */}
        <div className="space-y-2">
          <Label>Individual awards</Label>
          <p className="text-xs text-muted-foreground">
            Pool-funded awards reduce the team pool. LO-funded awards come out of your pocket.
          </p>
          <IndividualAwardsEditor awards={individualAwards} onChange={setIndividualAwards} />
        </div>

        {/* Lock-in placeholder for Unit 5 */}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground italic text-center">
            Unit 5 will add "lock in payouts" — saves this exact plan as the official end-of-season payout.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
