/**
 * @fileoverview Pairings Generator — Stage 2: Game Ordering.
 *
 * Attaches `gameNumber` (1-indexed, sequential, no gaps) to each input
 * record, carrying through all the fields Stage 1 produced
 * (player_ids, positions, `roundIndex`).
 *
 * **Stage 2 in v1 is a thin gameNumber annotation pass.** Today's
 * rotation algorithm (Stage 1) produces play order naturally as it
 * iterates rounds and positions — the input array IS already in play
 * order; Stage 2 just labels the entries 1..N. The three-stage Module
 * structure is real (each stage has its own pure function + typed
 * contract), but the v1 Stage 2 implementation is intentionally thin.
 *
 * A future variant (snake order, captain-first, standings-driven,
 * seeded-random, …) would put real sorting logic in this stage:
 * re-sort the input array per the variant's rule, then attach
 * `gameNumber` to the re-sorted result. The slot is reserved; v1's
 * occupant just doesn't need to re-sort.
 *
 * @see ../types.ts — PairRecord, OrderedPairRecord
 * @see ../index.ts — composer
 */

import type { OrderedPairRecord, PairRecord } from '../types';

/**
 * Stage 2 of the Pairings Generator pipeline.
 *
 * Attaches `gameNumber = index + 1` to each input record. Input order
 * is preserved exactly; output cardinality equals input cardinality.
 *
 * Trusts its inputs — Stage 1 has already produced well-formed
 * PairRecords and the composer's precondition has already validated
 * the upstream Module input.
 *
 * @param pairs The bag of pair records from Stage 1.
 * @returns The same records with `gameNumber` attached (1..N, contiguous).
 */
export function orderGames(pairs: PairRecord[]): OrderedPairRecord[] {
  return pairs.map((pair, index) => ({
    ...pair,
    gameNumber: index + 1,
  }));
}
