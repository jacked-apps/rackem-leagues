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
 * @see ./types.ts — the type definitions
 * @see ./stages/pairGeneration.ts — Stage 1
 * @see ./stages/gameOrdering.ts — Stage 2
 * @see ./stages/breakRackAssignment.ts — Stage 3
 * @see docs/league-system/modules/pairings-generator.md — the locked blueprint
 * @see docs/plans/2026-05-25-001-refactor-pairings-generator-extraction-plan.md — the v1 extraction plan
 */

import { assignBreakRack } from './stages/breakRackAssignment';
import { generatePairs } from './stages/pairGeneration';
import { orderGames } from './stages/gameOrdering';
import type { GameSlot, PairingsInput } from './types';

/**
 * Narrow precondition guard. Throws a descriptive `Error` when any of
 * the four input invariants is violated. Trusted-input policy applies
 * to everything else (e.g. array element contents are not validated;
 * the caller owns content quality).
 *
 * Invariants enforced:
 *   - `lineupSize` is a positive integer
 *   - `gameGeneration` is one of the two enum values
 *   - `homeLineup.length === lineupSize`
 *   - `awayLineup.length === lineupSize`
 */
function assertValidInput(input: PairingsInput): void {
  const { lineupSize, gameGeneration, homeLineup, awayLineup } = input;

  if (!Number.isInteger(lineupSize) || lineupSize < 1) {
    throw new Error(
      `generatePairings: lineupSize must be a positive integer, got ${String(
        lineupSize,
      )}`,
    );
  }
  if (
    gameGeneration !== 'single_round_robin' &&
    gameGeneration !== 'double_round_robin'
  ) {
    throw new Error(
      `generatePairings: gameGeneration must be 'single_round_robin' or 'double_round_robin', got ${String(
        gameGeneration,
      )}`,
    );
  }
  if (homeLineup.length !== lineupSize) {
    throw new Error(
      `generatePairings: homeLineup.length (${homeLineup.length}) must equal lineupSize (${lineupSize})`,
    );
  }
  if (awayLineup.length !== lineupSize) {
    throw new Error(
      `generatePairings: awayLineup.length (${awayLineup.length}) must equal lineupSize (${lineupSize})`,
    );
  }
}

/**
 * Produce the ordered list of games for a match-night, given the
 * locked lineups and the team-geometry rules.
 *
 * Composes three pure-function stages in sequence:
 *   1. {@link generatePairs} — bag of pairs annotated with `roundIndex`
 *   2. {@link orderGames}    — attach `gameNumber`
 *   3. {@link assignBreakRack} — attach `homeAction` / `awayAction`
 *
 * Strips the internal `roundIndex` field from the final output: the
 * outer `GameSlot` contract does NOT expose it (it's a Stage-2-to-3
 * structural anchor, not caller-facing data).
 *
 * Deterministic given the same input. No side effects.
 *
 * @param input The lineups + rules. See {@link PairingsInput}.
 * @returns The ordered slot list. See {@link GameSlot}.
 * @throws Error — when the input fails the narrow precondition (see {@link assertValidInput}).
 *
 * @example
 *   const slots = generatePairings({
 *     lineupSize: 3,
 *     gameGeneration: 'double_round_robin',
 *     homeLineup: ['home-p1', 'home-p2', 'home-p3'],
 *     awayLineup: ['away-p1', 'away-p2', 'away-p3'],
 *   });
 *   // slots.length === 18; slots[0] = { gameNumber: 1, homePlayerId: 'home-p1', ... }
 */
export function generatePairings(input: PairingsInput): GameSlot[] {
  assertValidInput(input);

  const pairs = generatePairs(input);
  const ordered = orderGames(pairs);
  const internalSlots = assignBreakRack(ordered);

  // Strip `roundIndex` by constructing the outer `GameSlot` shape
  // explicitly. Spreading would leak the internal field.
  return internalSlots.map((slot) => ({
    gameNumber: slot.gameNumber,
    homePlayerId: slot.homePlayerId,
    awayPlayerId: slot.awayPlayerId,
    homePosition: slot.homePosition,
    awayPosition: slot.awayPosition,
    homeAction: slot.homeAction,
    awayAction: slot.awayAction,
  }));
}

// Re-exports for convenience: `import { ... } from '@/systems/pairings'`.
export type { GameSlot, PairingsInput, GameGeneration } from './types';
