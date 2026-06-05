/**
 * @fileoverview Org-level finance defaults editor. Mirrors
 * FinanceSettingsCard but operates on `org_finance_defaults` and
 * applies to every league in this org by default (each league can
 * still override individually).
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { useOrgFinanceDefaults, useUpsertOrgFinanceDefaults } from '@/api/hooks/useOrgFinanceDefaults';
import type { LoCutKind, PayoutShape } from '@/utils/finances';

interface OrgFinanceDefaultsCardProps {
  organizationId: string;
}

const HARDCODED = {
  price_per_player_per_night: 10,
  green_fee_per_player_per_night: 2,
  lo_cut_kind: 'percentage' as LoCutKind,
  lo_cut_flat_per_week: 0,
  lo_cut_percent: 10,
  payout_shape: '50_30_20' as PayoutShape,
  payout_places_paid: 3,
  payout_rounding_target: 25,
};

export function OrgFinanceDefaultsCard({ organizationId }: OrgFinanceDefaultsCardProps) {
  const { data: row, isLoading } = useOrgFinanceDefaults(organizationId);
  const upsert = useUpsertOrgFinanceDefaults();

  // Local form state, hydrated from row when it lands
  const [price, setPrice] = useState(String(HARDCODED.price_per_player_per_night));
  const [greenFee, setGreenFee] = useState(String(HARDCODED.green_fee_per_player_per_night));
  const [loCutKind, setLoCutKind] = useState<LoCutKind>(HARDCODED.lo_cut_kind);
  const [loCutFlat, setLoCutFlat] = useState(String(HARDCODED.lo_cut_flat_per_week));
  const [loCutPercent, setLoCutPercent] = useState(String(HARDCODED.lo_cut_percent));
  const [payoutShape, setPayoutShape] = useState<PayoutShape>(HARDCODED.payout_shape);
  const [payoutPlaces, setPayoutPlaces] = useState(String(HARDCODED.payout_places_paid));
  const [roundingTarget, setRoundingTarget] = useState(String(HARDCODED.payout_rounding_target));

  // Hydrate once row arrives (won't clobber LO edits since `row` is stable)
  useEffect(() => {
    if (!row) return;
    setPrice(String(row.price_per_player_per_night));
    setGreenFee(String(row.green_fee_per_player_per_night));
    setLoCutKind(row.lo_cut_kind);
    setLoCutFlat(String(row.lo_cut_flat_per_week));
    setLoCutPercent(String(row.lo_cut_percent));
    setPayoutShape(row.payout_shape);
    setPayoutPlaces(String(row.payout_places_paid));
    setRoundingTarget(String(row.payout_rounding_target));
  }, [row]);

  const handleSave = async () => {
    try {
      await upsert.mutateAsync({
        organization_id: organizationId,
        price_per_player_per_night: parseFloat(price) || 0,
        green_fee_per_player_per_night: parseFloat(greenFee) || 0,
        lo_cut_kind: loCutKind,
        lo_cut_flat_per_week: parseFloat(loCutFlat) || 0,
        lo_cut_percent: parseFloat(loCutPercent) || 0,
        payout_shape: payoutShape,
        payout_places_paid: parseInt(payoutPlaces, 10) || 3,
        payout_rounding_target: parseFloat(roundingTarget) || 0,
      });
      toast.success('Organization finance defaults saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    }
  };

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Finance Defaults
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {row ? 'Saved' : 'Not yet set (using app defaults)'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          These defaults apply to every league in this organization. Each league
          can still override individually.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="org-price">Price per player per night ($)</Label>
            <Input
              id="org-price"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="org-green">Green fee per player per night ($)</Label>
            <Input
              id="org-green"
              type="number"
              step="0.01"
              min="0"
              value={greenFee}
              onChange={(e) => setGreenFee(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="org-lo-kind">LO compensation</Label>
          <Select value={loCutKind} onValueChange={(v) => setLoCutKind(v as LoCutKind)}>
            <SelectTrigger id="org-lo-kind">
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
            <Label htmlFor="org-lo-flat">LO flat fee per week ($)</Label>
            <Input
              id="org-lo-flat"
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
            <Label htmlFor="org-lo-pct">LO percent of pool (%)</Label>
            <Input
              id="org-lo-pct"
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
            <Label htmlFor="org-shape">Default payout shape</Label>
            <Select value={payoutShape} onValueChange={(v) => setPayoutShape(v as PayoutShape)}>
              <SelectTrigger id="org-shape">
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
            <Label htmlFor="org-places">Default places paid</Label>
            <Input
              id="org-places"
              type="number"
              step="1"
              min="1"
              max="50"
              value={payoutPlaces}
              onChange={(e) => setPayoutPlaces(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="org-rounding">Round prizes to nearest ($)</Label>
            <Select value={roundingTarget} onValueChange={setRoundingTarget}>
              <SelectTrigger id="org-rounding">
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

        <div className="flex justify-end pt-2 border-t">
          <Button
            loadingText="Saving..."
            isLoading={upsert.isPending || isLoading}
            onClick={handleSave}
          >
            Save organization defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
