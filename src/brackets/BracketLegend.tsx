/**
 * @fileoverview A compact key for the match-cell states, so a viewer knows what
 * the borders mean. Shown above the bracket on the organizer and public views.
 * Uses the shared MATCH_STATE_STYLE so the swatches always match the cells —
 * distinguished by pattern/fill AND color (colorblind-safe).
 */

import { cn } from '@/lib/utils';
import {
  MATCH_STATE_STYLE,
  MATCH_STATE_LABEL,
  MATCH_STATE_ORDER,
} from './matchStateStyles';

export function BracketLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {MATCH_STATE_ORDER.map((key) => (
        <span key={key} className="flex items-center gap-1.5">
          <span className={cn('inline-block h-3.5 w-3.5 rounded-sm', MATCH_STATE_STYLE[key])} />
          {MATCH_STATE_LABEL[key]}
        </span>
      ))}
    </div>
  );
}
