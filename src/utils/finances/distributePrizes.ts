/**
 * @fileoverview Prize-distribution shape engine.
 *
 * Given a pool and a shape, produces a per-place dollar allocation.
 * Supports the presets the brainstorm settled on (50/30/20, etc.),
 * plus doubling, sliding scale, flat, and custom.
 *
 * Rounding semantics (when `roundingTarget > 0`):
 *   - Each prize is rounded to the nearest multiple of `roundingTarget`
 *   - The total rounded payout may differ from the input pool by
 *     small fractions of the target; the leftover goes to 1st place
 *     (rounding remainder convention from the research pass)
 *
 * Custom shape requires `customPercentages` summing to 100. The
 * engine clamps to the shape's place count even if the caller
 * passes a mismatched `placesPaid`.
 */

import type { PayoutShape, PrizeAllocation } from './types';

/** Built-in percentage presets. Each array sums to 100. */
const PRESET_PERCENTAGES: Record<Exclude<PayoutShape, 'doubling' | 'sliding_scale' | 'flat' | 'custom'>, number[]> = {
  '50_30_20': [50, 30, 20],
  '40_30_20_10': [40, 30, 20, 10],
  '35_25_20_12_8': [35, 25, 20, 12, 8],
};

/**
 * Return the per-place percentages for a given shape + place count.
 * Pure function; doesn't touch dollar amounts.
 */
export function percentagesForShape(
  shape: PayoutShape,
  placesPaid: number,
  customPercentages: number[] | null = null,
): number[] {
  if (shape === 'custom') {
    if (!customPercentages || customPercentages.length === 0) {
      // Defensive fallback — treat as flat if custom is empty
      return Array(placesPaid).fill(100 / placesPaid);
    }
    return customPercentages.slice(0, placesPaid);
  }

  if (shape === 'doubling') {
    // 1st = 2× 2nd = 4× 3rd = … Doubling shape that sums to 100.
    // Each place's weight = 2^(places - place). Normalize to 100.
    const weights = Array.from({ length: placesPaid }, (_, i) =>
      Math.pow(2, placesPaid - 1 - i),
    );
    const total = weights.reduce((a, b) => a + b, 0);
    return weights.map((w) => (w / total) * 100);
  }

  if (shape === 'sliding_scale') {
    // Linear slide: 1st highest, last gets a token amount. Westside
    // 8-Ball model. Each rank loses equal $; sums to 100. Easiest
    // implementation: arithmetic series with last term = first / 4.
    // Weights: N, N-0.75/(places-1), ... down to N/4.
    if (placesPaid === 1) return [100];
    const first = 1;
    const last = 0.25;
    const step = (first - last) / (placesPaid - 1);
    const weights = Array.from({ length: placesPaid }, (_, i) => first - step * i);
    const total = weights.reduce((a, b) => a + b, 0);
    return weights.map((w) => (w / total) * 100);
  }

  if (shape === 'flat') {
    // Every paid place gets the same.
    return Array(placesPaid).fill(100 / placesPaid);
  }

  // Preset shape — read from table. If the caller asked for more
  // places than the preset has, pad with zero.
  const preset = PRESET_PERCENTAGES[shape];
  if (placesPaid <= preset.length) return preset.slice(0, placesPaid);
  return [...preset, ...Array(placesPaid - preset.length).fill(0)];
}

/**
 * Apply a percentage shape to a pool to get per-place dollar
 * allocations. Optionally rounds each prize to the nearest
 * `roundingTarget`; the remainder (positive or negative) gets
 * added to 1st place.
 */
export function distributePrizes(args: {
  pool: number;
  shape: PayoutShape;
  placesPaid: number;
  roundingTarget?: number; // 0 or undefined = no rounding
  customPercentages?: number[] | null;
}): PrizeAllocation[] {
  const { pool, shape, placesPaid } = args;
  const roundingTarget = args.roundingTarget ?? 0;
  const customPercentages = args.customPercentages ?? null;

  if (pool <= 0 || placesPaid <= 0) return [];

  const pcts = percentagesForShape(shape, placesPaid, customPercentages);

  // Exact dollar amounts per place (no rounding yet).
  const exactAmounts = pcts.map((pct) => pool * (pct / 100));

  if (roundingTarget <= 0) {
    return exactAmounts.map((amount, i) => ({
      place: i + 1,
      amount: round2(amount),
    }));
  }

  // Round each prize to the nearest multiple of roundingTarget.
  // Whatever's left over (positive or negative) goes to 1st place
  // so the totals match the pool exactly.
  const rounded = exactAmounts.map((amount) =>
    Math.round(amount / roundingTarget) * roundingTarget,
  );
  const roundedSum = rounded.reduce((a, b) => a + b, 0);
  const remainder = pool - roundedSum;
  if (rounded.length > 0) {
    rounded[0] = round2(rounded[0] + remainder);
  }

  return rounded.map((amount, i) => ({ place: i + 1, amount }));
}

/** Round to 2 decimal places — avoids floating-point ugliness in $.cc. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
