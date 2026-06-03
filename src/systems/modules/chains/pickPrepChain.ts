/**
 * @fileoverview The single named place that chooses a prep-time chain
 * for a system. Per CLAUDE.md principle 5, this is the workshop's
 * decision — until the workshop UI exists, the dispatch lives here.
 *
 * Consumers (useMatchPreparation, buildSystemFromPreferences) call
 * this helper with simple pref values; the file itself contains the
 * only switch on `handicap_type` / `mechanism` strings.
 */

import type { Module } from '@/systems/chain-runtime/types';
import { bca3v3Chain } from '@/systems/bca3v3';
import { bca5v5Chain } from '@/systems/bca5v5';
import { fargoPointsChain, fargoGamesChain } from '@/systems/fargo5v5';

/**
 * Return the ordered list of modules the runtime should run for the
 * given preferences. Returns an empty chain for systems we don't have
 * threshold modules for (handicap_type='none', 'skill_level', etc.) —
 * the runtime handles an empty chain gracefully.
 */
export function pickPrepChain(
  handicapType: string | null | undefined,
  mechanism: string | null | undefined,
): Module[] {
  if (handicapType === 'points') return [...bca3v3Chain];
  if (handicapType === 'percentage') return [...bca5v5Chain];
  if (handicapType === 'fargo') {
    return mechanism === 'start_points'
      ? [...fargoPointsChain]
      : [...fargoGamesChain];
  }
  return [];
}
