/**
 * @fileoverview Pairings Generator factory + public exports.
 *
 * `generatePairings(input)` is the runtime entry point: it takes the two
 * locked lineups plus the team-geometry rules and returns the ordered
 * list of games for the night (`GameSlot[]`). One call, one output, no
 * side effects.
 *
 * Architectural shape: the Module's slot accepts any algorithm that
 * satisfies `(PairingsInput) => GameSlot[]`. v1 ships exactly one
 * algorithm (round-robin) implemented as three composed stages —
 *   1. pair generation,
 *   2. game ordering,
 *   3. break/rack assignment.
 * Future variants (snake order, race-mode, Swiss, etc.) plug into the
 * same Module slot by writing a different implementation that satisfies
 * the same contract; the chassis (this file + `types.ts`) doesn't move.
 *
 * The factory body in this scaffolding commit is a stub — the composer
 * is wired in Unit 5 once the three stage files exist.
 *
 * @see ./types.ts — the type definitions
 * @see docs/league-system/modules/pairings-generator.md — the locked blueprint
 * @see docs/plans/2026-05-25-001-refactor-pairings-generator-extraction-plan.md — the v1 extraction plan
 */

import type { GameSlot, PairingsInput } from './types';

/**
 * Produce the ordered list of games for a match-night, given the
 * locked lineups and the team-geometry rules.
 *
 * **Stub:** this scaffolding commit only defines the signature. Unit 5
 * wires the precondition + composes Stages 1 → 2 → 3 into the real
 * body. Callers that hit this stub get a typed error so the missing
 * wiring is obvious during development.
 *
 * @param input The lineups + rules. See {@link PairingsInput}.
 * @returns The ordered slot list. See {@link GameSlot}.
 * @throws Error — always, until Unit 5 wires the composer.
 */
export function generatePairings(input: PairingsInput): GameSlot[] {
  void input;
  throw new Error(
    'generatePairings: not implemented yet — Unit 5 wires the composer. ' +
      'This stub exists so dependent units can compile against the contract.',
  );
}

// Re-exports for convenience: `import { ... } from '@/systems/pairings'`.
export type { GameSlot, PairingsInput, GameGeneration } from './types';
