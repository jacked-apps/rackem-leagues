/**
 * @fileoverview LO cut calculator. Supports three modes:
 *   - flat: $N per week, regardless of pool size
 *   - percentage: N% of the pre-cut pool
 *   - both: flat + percentage
 *
 * Operates on the gross pool (after green fees + app fee, before
 * other expenses). Per the brainstorm: the LO cut is taken from
 * the prize pool, then misc expenses come out of what remains.
 */

import type { LoCutKind } from './types';

export function computeLoCut(args: {
  kind: LoCutKind;
  flatPerWeek: number;
  percent: number; // 0-100
  totalWeeks: number;
  preCutPool: number;
}): number {
  const { kind, flatPerWeek, percent, totalWeeks, preCutPool } = args;

  // Defensive: clamp percent to [0, 100] and pool to non-negative
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const safePool = Math.max(0, preCutPool);

  const flatPortion = kind === 'percentage' ? 0 : flatPerWeek * totalWeeks;
  const percentPortion = kind === 'flat' ? 0 : safePool * (clampedPercent / 100);

  return flatPortion + percentPortion;
}
