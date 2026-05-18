/**
 * @fileoverview FinanceSettingsCard — editable form for the league's
 * finance settings. Inherits from org defaults; any field the LO
 * touches becomes a league-level override.
 *
 * Save button writes only the touched fields (others stay NULL =
 * inherit). "Reset to org defaults" deletes the league override row
 * entirely so the league re-inherits everything fresh.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useUpsertLeagueFinanceSettings, useDeleteLeagueFinanceSettings } from '@/api/hooks/useLeagueFinanceMutations';
import type { LeagueFinancesQueryResult } from '@/api/queries/leagueFinances';
import type { LoCutKind, PayoutShape } from '@/utils/finances';

interface FinanceSettingsCardProps {
  leagueId: string;
  finances: LeagueFinancesQueryResult;
}

export function FinanceSettingsCard({ leagueId, finances }: FinanceSettingsCardProps) {
  const upsert = useUpsertLeagueFinanceSettings();
  const remove = useDeleteLeagueFinanceSettings();

  // Local form state, pre-filled from the resolved values
  const [price, setPrice] = useState(String(finances.resolved.pricePerPlayerPerNight));
  const [greenFee, setGreenFee] = useState(String(finances.resolved.greenFeePerPlayerPerNight));
  const [loCutKind, setLoCutKind] = useState<LoCutKind>(finances.resolved.loCutKind);
  const [loCutFlat, setLoCutFlat] = useState(String(finances.resolved.loCutFlatPerWeek));
  const [loCutPercent, setLoCutPercent] = useState(String(finances.resolved.loCutPercent));
  const [payoutShape, setPayoutShape] = useState<PayoutShape>(finances.resolved.payoutShape);
  const [payoutPlaces, setPayoutPlaces] = useState(String(finances.resolved.payoutPlacesPaid));
  const [roundingTarget, setRoundingTarget] = useState(String(finances.resolved.payoutRoundingTarget));

  const isOverriding = !!finances.leagueOverride;

  const handleSave = async () => {
    try {
      await upsert.mutateAsync({
        league_id: leagueId,
        price_per_player_per_night: parseFloat(price) || 0,
        green_fee_per_player_per_night: parseFloat(greenFee) || 0,
        lo_cut_kind: loCutKind,
        lo_cut_flat_per_week: parseFloat(loCutFlat) || 0,
        lo_cut_percent: parseFloat(loCutPercent) || 0,
        payout_shape: payoutShape,
        payout_places_paid: parseInt(payoutPlaces, 10) || 3,
        payout_rounding_target: parseFloat(roundingTarget) || 0,
      });
      toast.success('Finance settings saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    }
  };

  const handleReset = async () => {
    try {
      await remove.mutateAsync({ leagueId });
      toast.success('Reverted to organization defaults');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reset');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-blue-600" />
            Finance Settings
          </span>
          {isOverriding ? (
            <span className="text-xs font-normal bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              League override active
            </span>
          ) : (
            <span className="text-xs font-normal bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
              Using org defaults
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="price">Price per player per night ($)</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="green">Green fee per player per night ($)</Label>
            <Input
              id="green"
              type="number"
              step="0.01"
              min="0"
              value={greenFee}
              onChange={(e) => setGreenFee(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="lo-cut-kind">LO compensation</Label>
          <Select value={loCutKind} onValueChange={(v) => setLoCutKind(v as LoCutKind)}>
            <SelectTrigger id="lo-cut-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">% of prize pool</SelectItem>
              <SelectItem value="flat">Flat $ per week</SelectItem>
              <SelectItem value="both">Both (flat + %)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(loCutKind === 'flat' || loCutKind === 'both') && (
          <div className="space-y-1">
            <Label htmlFor="lo-flat">LO flat fee per week ($)</Label>
            <Input
              id="lo-flat"
              type="number"
              step="0.01"
              min="0"
              value={loCutFlat}
              onChange={(e) => setLoCutFlat(e.target.value)}
            />
          </div>
        )}
        {(loCutKind === 'percentage' || loCutKind === 'both') && (
          <div className="space-y-1">
            <Label htmlFor="lo-pct">LO percent of pool (%)</Label>
            <Input
              id="lo-pct"
              type="number"
              step="0.5"
              min="0"
              max="100"
              value={loCutPercent}
              onChange={(e) => setLoCutPercent(e.target.value)}
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
          <div className="space-y-1">
            <Label htmlFor="shape">Payout shape</Label>
            <Select value={payoutShape} onValueChange={(v) => setPayoutShape(v as PayoutShape)}>
              <SelectTrigger id="shape">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50_30_20">50 / 30 / 20 (top 3)</SelectItem>
                <SelectItem value="40_30_20_10">40 / 30 / 20 / 10 (top 4)</SelectItem>
                <SelectItem value="35_25_20_12_8">35 / 25 / 20 / 12 / 8 (top 5)</SelectItem>
                <SelectItem value="doubling">Doubling (1st = 2× 2nd)</SelectItem>
                <SelectItem value="sliding_scale">Sliding scale (everyone)</SelectItem>
                <SelectItem value="flat">Flat (even split)</SelectItem>
                <SelectItem value="custom">Custom percentages</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="places">Places paid</Label>
            <Input
              id="places"
              type="number"
              step="1"
              min="1"
              max="50"
              value={payoutPlaces}
              onChange={(e) => setPayoutPlaces(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rounding">Round prizes to nearest ($)</Label>
            <Select value={roundingTarget} onValueChange={(v) => setRoundingTarget(v)}>
              <SelectTrigger id="rounding">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">No rounding (exact)</SelectItem>
                <SelectItem value="1">$1</SelectItem>
                <SelectItem value="5">$5</SelectItem>
                <SelectItem value="10">$10</SelectItem>
                <SelectItem value="25">$25</SelectItem>
                <SelectItem value="50">$50</SelectItem>
                <SelectItem value="100">$100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t">
          <Button
            variant="ghost"
            loadingText="Resetting..."
            isLoading={remove.isPending}
            onClick={handleReset}
            disabled={!isOverriding}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to org defaults
          </Button>
          <Button
            loadingText="Saving..."
            isLoading={upsert.isPending}
            onClick={handleSave}
          >
            Save settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
