/**
 * @fileoverview Match Format factory + public exports.
 *
 * `getMatchFormat(pairingFormat, raceLength)` is the runtime entry point for creating
 * a Match Format Module from a league's configured axes. The resolver
 * (`buildSystemFromPreferences`) calls this when assembling the SystemModule for a league.
 *
 * Phase A of the Match Format extraction Unit (following the Team Geometry extraction
 * pattern): create the Module in isolation, no consumer changes. Phase B wires it into
 * the SystemModule interface and the 3 prepackaged systems. Phase C swaps consumers.
 * Phase D deletes any legacy field that becomes unused.
 *
 * @see ./types.ts — the type definitions
 * @see docs/league-system/modules/match-format.md — the locked blueprint
 */

import type { MatchFormat, PairingFormat } from './types';

/**
 * Create a Match Format Module from validated axis values.
 *
 * Inputs are assumed to be pre-validated at preference-write time (DB CHECK constraints
 * + application-layer validation enforce the legal combinations). The factory doesn't
 * re-validate; it just constructs the Module.
 *
 * Note on the `pairingFormat='single_rack'` + non-null `raceLength` case: race_length
 * is meaningless for single-rack pairings but the factory does not reject this
 * combination — preference write should have prevented it. If it slips through, the
 * Module carries the value as configured; downstream consumers (Pairings Generator)
 * are responsible for ignoring race_length when pairingFormat is single_rack.
 *
 * @param pairingFormat How each pairing is structured.
 * @param raceLength Race target when `pairingFormat === 'race_to_n'`; null otherwise.
 * @returns A `MatchFormat` Module with the two configured axes.
 */
export function getMatchFormat(
  pairingFormat: PairingFormat,
  raceLength: number | null,
): MatchFormat {
  return {
    pairingFormat,
    raceLength,
  };
}

/**
 * Convenience predicate: is this Match Format configured for race-to-N pairings?
 *
 * Helper for consumers that need to branch on the pairing structure. Equivalent to
 * `matchFormat.pairingFormat === 'race_to_n'` but reads more clearly at call sites.
 */
export function isRaceMode(matchFormat: MatchFormat): boolean {
  return matchFormat.pairingFormat === 'race_to_n';
}

// Re-exports for convenience: `import { ... } from '@/systems/match-format'`.
export type { MatchFormat, PairingFormat } from './types';
