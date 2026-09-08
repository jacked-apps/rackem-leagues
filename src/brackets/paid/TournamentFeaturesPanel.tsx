/**
 * @fileoverview What this tournament has bought, and what it will cost.
 *
 * Lives on the Info tab, with the rest of the tournament's own settings — a
 * feature belongs to the tournament, not to the player you happen to be adding.
 *
 * Removal is offered while a feature is still inside its free allowance. That
 * allowance is the demo: a handful of players is trivial to track by hand and
 * not worth charging for, so the first few uses are what show an organizer the
 * thing works at a size they'd never have paid for. Past it, the feature has
 * genuinely earned its keep and stays on the bill — otherwise it could be used
 * all night and dropped before starting.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { chargeBreakdown, formatPrice } from './premiumFeatures';

interface TournamentFeaturesPanelProps {
  /** `brackets.premium_features`. */
  featureKeys: readonly string[];
  /** Take one off. Returns a message to show, or null when it came off. */
  onRemove: (feature: string) => Promise<string | null>;
  disabled?: boolean;
}

export function TournamentFeaturesPanel({
  featureKeys,
  onRemove,
  disabled = false,
}: TournamentFeaturesPanelProps) {
  const [problem, setProblem] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const { lines, totalCents } = chargeBreakdown(featureKeys);

  if (lines.length === 0) return null;

  const handleRemove = async (key: string) => {
    setRemoving(key);
    setProblem(null);
    try {
      setProblem(await onRemove(key));
    } finally {
      setRemoving(null);
    }
  };

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">Premium features</h3>

      <ul className="divide-y rounded-md border">
        {lines.map((line) => (
          <li key={line.key} className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="min-w-0 text-sm">{line.label}</span>
            <span className="flex shrink-0 items-center gap-3">
              <span className="text-sm tabular-nums">{formatPrice(line.cents)}</span>
              <Button
                variant="ghost"
                size="sm"
                loadingText="none"
                isLoading={removing === line.key}
                disabled={disabled}
                onClick={() => void handleRemove(line.key)}
              >
                Remove
              </Button>
            </span>
          </li>
        ))}
      </ul>

      <p className="text-right text-sm">
        <span className="text-muted-foreground">Charged when you start: </span>
        <span className="font-semibold tabular-nums">{formatPrice(totalCents)}</span>
      </p>

      {problem && <p className="text-sm text-destructive">{problem}</p>}
    </section>
  );
}
