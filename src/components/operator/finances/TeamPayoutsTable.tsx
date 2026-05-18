/**
 * @fileoverview Renders the per-place team payout allocations as a
 * clean table. Pure display — receives an already-computed
 * `PrizeAllocation[]` and shows it.
 */

import { Trophy } from 'lucide-react';
import type { PrizeAllocation } from '@/utils/finances';

interface TeamPayoutsTableProps {
  allocations: PrizeAllocation[];
  totalPool: number;
}

const PLACE_LABELS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
const PLACE_COLORS = ['text-yellow-600', 'text-slate-400', 'text-amber-700'];

export function TeamPayoutsTable({ allocations, totalPool }: TeamPayoutsTableProps) {
  if (allocations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic text-center py-4">
        Nothing to distribute — pool is $0.
      </p>
    );
  }

  const sum = allocations.reduce((acc, a) => acc + a.amount, 0);

  return (
    <div className="space-y-1">
      {allocations.map((alloc, idx) => {
        const label = PLACE_LABELS[alloc.place - 1] ?? `${alloc.place}th`;
        const color = PLACE_COLORS[idx] ?? 'text-muted-foreground';
        const pctOfPool = totalPool > 0 ? (alloc.amount / totalPool) * 100 : 0;
        return (
          <div
            key={alloc.place}
            className="flex items-center justify-between gap-3 py-2 px-3 rounded bg-muted/30"
          >
            <div className="flex items-center gap-2">
              <Trophy className={`h-4 w-4 ${color}`} />
              <span className="font-medium">{label}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {pctOfPool.toFixed(1)}%
              </span>
              <span className="font-semibold text-lg">
                ${alloc.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        );
      })}
      <div className="flex justify-between pt-2 mt-2 border-t text-sm">
        <span className="text-muted-foreground">Total distributed</span>
        <span className="font-semibold">
          ${sum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}
