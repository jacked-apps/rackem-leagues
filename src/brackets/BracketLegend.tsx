/**
 * @fileoverview A compact color key for the match-cell border states, so a
 * viewer knows what the colors mean. Shown above the bracket on the organizer
 * and public views. Mirrors the border colors in MatchCell.
 */

import { cn } from '@/lib/utils';

const ITEMS: Array<{ label: string; cls: string }> = [
  { label: 'Waiting', cls: 'border-dashed border-muted-foreground/40' },
  { label: 'On deck', cls: 'border-amber-500' },
  { label: 'Playing', cls: 'border-primary' },
  { label: 'Done', cls: 'border-emerald-500' },
];

export function BracketLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {ITEMS.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className={cn('inline-block h-3 w-3 rounded-sm border-2', i.cls)} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
