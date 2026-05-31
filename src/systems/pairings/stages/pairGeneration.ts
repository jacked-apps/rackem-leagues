/**
 * @fileoverview Pairings Generator — Stage 1: Pair Generation.
 *
 * Produces the bag of pairs for the match-night, each annotated with the
 * round it was generated in (`roundIndex`). The records are emitted in
 * the round-major, position-major order the rotation loop produces them
 * — this IS the eventual play order; Stage 2 just attaches `gameNumber`,
 * Stage 3 just reads `roundIndex` to assign break/rack.
 *
 * **Algorithm.** Today's only variant is the full-round-robin rotation
 * inherited from `src/utils/gameOrder.ts:generateGameOrder` lines
 * 130-156. For each round 0..(totalRounds - 1):
 *   - For each home position 1..lineupSize:
 *     - `awayPos = ((homePos - 1 + round) % lineupSize) + 1`
 *     - Emit `{ homePlayerId, awayPlayerId, homePosition, awayPosition, roundIndex }`
 * where `totalRounds = lineupSize × (gameGeneration === 'double_round_robin' ? 2 : 1)`.
 *
 * Byte-for-byte equivalent to today's `generateGameOrder`'s pair shape:
 * the original computes `awayOffset = round % playersPerTeam; awayPosition =
 * ((i + awayOffset) % playersPerTeam) + 1`, which is mathematically the
 * same as `((homePos - 1 + round) % lineupSize) + 1` because mod-N
 * addition distributes over the (homePos - 1) and round terms.
 *
 * **Outer-loop structure is pinned.** Stage 1 MUST iterate a single
 * outer loop `round in 0..(totalRounds - 1)` and tag each emitted pair
 * with that `round` value as `roundIndex`. Do NOT factor as "generate
 * SRR pairs (rounds 0..N-1) then duplicate them with the same
 * roundIndex" — that breaks Stage 3's per-round alternation for even
 * lineup sizes (4v4 DRR: pair (P1, P1) at round 0 and at round N must
 * have DIFFERENT roundIndex values so Stage 3's `roundIndex % 2 === 0`
 * flips the breaker between the two passes).
 *
 * @see ../types.ts — PairRecord, PairingsInput
 * @see ../index.ts — composer
 */

import type { PairRecord, PairingsInput } from '../types';

/**
 * Stage 1 of the Pairings Generator pipeline.
 *
 * Takes the full input (lineups + rules) and emits the bag of pairs for
 * the night, each tagged with the round it belongs to. Output order IS
 * the natural play order produced by the rotation loop; Stage 2 attaches
 * `gameNumber` on top.
 *
 * Trusts its inputs — the composer's precondition has already validated
 * `lineupSize`, `gameGeneration`, and the array lengths. This function
 * does no validation of its own.
 *
 * @param input The full Module input (validated by the composer).
 * @returns The bag of `PairRecord`s in round-major, position-major order.
 */
export function generatePairs(input: PairingsInput): PairRecord[] {
  const { lineupSize, gameGeneration, homeLineup, awayLineup } = input;
  const totalRounds =
    lineupSize * (gameGeneration === 'double_round_robin' ? 2 : 1);

  const pairs: PairRecord[] = [];

  for (let round = 0; round < totalRounds; round += 1) {
    for (let homePos = 1; homePos <= lineupSize; homePos += 1) {
      const awayPos = ((homePos - 1 + round) % lineupSize) + 1;
      pairs.push({
        homePlayerId: homeLineup[homePos - 1],
        awayPlayerId: awayLineup[awayPos - 1],
        homePosition: homePos,
        awayPosition: awayPos,
        roundIndex: round,
      });
    }
  }

  return pairs;
}
