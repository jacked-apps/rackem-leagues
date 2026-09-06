/**
 * @fileoverview Shared visual styling for the four match states, encoded with
 * BOTH color AND pattern/fill so the states are distinguishable without relying
 * on color alone (colorblind-safe). Consumed by MatchCell (the cell border) and
 * BracketLegend (the key) so the two never drift.
 *
 *   waiting → dashed grey outline   (a feeder match isn't done)
 *   onDeck  → dotted amber outline  (ready, not started)
 *   playing → solid blue outline    (organizer marked it being played)
 *   done    → solid green + fill     (finished/decided)
 */

import type { MatchStatus } from '@/types/bracket';

export type MatchStateKey = 'waiting' | 'onDeck' | 'playing' | 'done';

/** Border + fill classes per state. Include `border-2` so callers just apply. */
export const MATCH_STATE_STYLE: Record<MatchStateKey, string> = {
  waiting: 'border-2 border-dashed border-muted-foreground/50',
  onDeck: 'border-2 border-dotted border-amber-500',
  playing: 'border-2 border-solid border-primary',
  done: 'border-2 border-solid border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40',
};

/** Human label per state, for the legend. */
export const MATCH_STATE_LABEL: Record<MatchStateKey, string> = {
  waiting: 'Waiting',
  onDeck: 'On deck',
  playing: 'Playing',
  done: 'Done',
};

/** Ordered for the legend. */
export const MATCH_STATE_ORDER: MatchStateKey[] = ['waiting', 'onDeck', 'playing', 'done'];

/** Which visual state a match is in (status + the in-progress flag). */
export function matchStateKey(match: {
  status: MatchStatus;
  inProgress: boolean;
}): MatchStateKey {
  if (match.status === 'complete') return 'done';
  if (match.status === 'ready') return match.inProgress ? 'playing' : 'onDeck';
  return 'waiting';
}
