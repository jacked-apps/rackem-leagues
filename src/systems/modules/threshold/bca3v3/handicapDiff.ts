/**
 * @fileoverview Threshold module: BCA 3v3 (Points) handicap differential.
 *
 * Reads from the bag:
 * - `home_handicaps` (number[]): per-player handicaps for home
 * - `away_handicaps` (number[]): per-player handicaps for away
 * - `home_team_bonus` (number): from the upstream teamBonus module
 * - `away_team_bonus` (number): always 0 for BCA 3v3
 *
 * Sums per side (with team bonus folded in) and writes:
 * - `home_handicap_diff` (number): homeTotal − awayTotal
 * - `away_handicap_diff` (number): awayTotal − homeTotal
 *
 * Downstream chart-lookup modules use these signed diffs to read
 * each team's threshold trio off the 3v3 chart.
 *
 * Never throws.
 */

import type { Module, StateBag } from '@/systems/chain-runtime/types';

function sum(values: unknown): number {
  if (!Array.isArray(values)) return 0;
  return values.reduce<number>((acc, v) => acc + (typeof v === 'number' ? v : 0), 0);
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

export const handicapDiff: Module = {
  name: 'bca3v3.handicapDiff',
  run: (bag: StateBag) => {
    const homeTotal = sum(bag.home_handicaps) + asNumber(bag.home_team_bonus);
    const awayTotal = sum(bag.away_handicaps) + asNumber(bag.away_team_bonus);
    bag.home_handicap_diff = homeTotal - awayTotal;
    bag.away_handicap_diff = awayTotal - homeTotal;
  },
};
