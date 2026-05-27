/**
 * @fileoverview Pairings Generator — Stage 3: Break/Rack Assignment.
 *
 * Attaches `homeAction` and `awayAction` ('breaks' | 'racks') to each
 * input record. Today's variant is **per-round alternation with a
 * last-round fairness pass for odd totalRounds**:
 *
 *   - Rounds 0..(totalRounds-2): uniform alternation by round.
 *     Even round → home breaks all games; odd round → away breaks all.
 *   - Round (totalRounds-1): when totalRounds is ODD, the last round
 *     alternates PER GAME (not per round) so the breaker-side count
 *     differs by at most 1 across the whole match. When totalRounds
 *     is EVEN, the last round follows the uniform pattern like any
 *     other round.
 *
 * Why this matters. With pure per-round alternation, an SRR with odd
 * lineup_size (and therefore odd totalRounds — 3v3, 5v5, 7v7, …)
 * gives the home side `(ceil(totalRounds/2) * gamesPerRound)` breaks
 * and the away side the rest, which is off by `gamesPerRound` (5 for
 * 5v5 SRR). The per-game alternation in the last odd round narrows
 * this to a single break difference — still slightly home-favored
 * but acceptable. DRR is always even totalRounds (lineup_size × 2),
 * so it's untouched.
 *
 * Stage 3 reads `roundIndex` (and the input array's structure to
 * derive `totalRounds` + `gamesPerRound`) from each input record. It
 * does not look at `gameNumber` or positions. The structure-derived
 * values are valid for the round-robin variant family where every
 * round has the same number of games; future Swiss/bracket variants
 * with non-uniform round sizes would supply their own Stage 3.
 *
 * **Note on field-name choice.** The canon doc's example uses
 * `breaker` / `racker` fields ('home' | 'away'); this Module uses
 * `homeAction` / `awayAction` ('breaks' | 'racks') to match the
 * existing `match_games.home_action` / `away_action` DB columns. Per
 * Ed's recipe-vs-example framing, the canon's specific field names are
 * illustrative examples of how today's code happens to do it; we
 * follow the installed DB shape.
 *
 * @see ../types.ts — OrderedPairRecord, InternalSlot
 * @see ../index.ts — composer
 */

import type { InternalSlot, OrderedPairRecord } from '../types';

/**
 * Stage 3 of the Pairings Generator pipeline.
 *
 * Attaches break/rack annotations using per-round alternation with a
 * last-round fairness pass when `totalRounds` is odd. See @fileoverview
 * for the full rule.
 *
 * Trusts its inputs — Stages 1 and 2 have produced well-formed
 * records and the composer's precondition has already validated the
 * upstream Module input.
 *
 * @param ordered Ordered pair records from Stage 2.
 * @returns The same records with `homeAction` and `awayAction` attached.
 */
export function assignBreakRack(
  ordered: OrderedPairRecord[],
): InternalSlot[] {
  if (ordered.length === 0) return [];

  // Derive totalRounds + gamesPerRound from the input structure.
  // Stage 1 emits records with roundIndex 0..(totalRounds-1), and the
  // round-robin family guarantees `gamesPerRound = lineupSize` for every
  // round, so total length / totalRounds yields the per-round count.
  const totalRounds = ordered[ordered.length - 1].roundIndex + 1;
  const gamesPerRound = Math.floor(ordered.length / totalRounds);
  const totalRoundsIsOdd = totalRounds % 2 === 1;
  const lastRoundIndex = totalRounds - 1;

  return ordered.map((record, index) => {
    const isLastRound = record.roundIndex === lastRoundIndex;
    let homeBreaks: boolean;

    if (totalRoundsIsOdd && isLastRound) {
      // Per-game alternation in the last round, starting with whichever
      // side would normally break this round under the uniform rule. For
      // even roundIndex (which the last odd-totalRounds round always is —
      // totalRounds-1 = even when totalRounds is odd), the round starts
      // with home breaking. Then alternate per game.
      const positionInLastRound =
        index - lastRoundIndex * gamesPerRound; // 0..(gamesPerRound-1)
      const lastRoundStartsWithHome = record.roundIndex % 2 === 0;
      homeBreaks = lastRoundStartsWithHome
        ? positionInLastRound % 2 === 0
        : positionInLastRound % 2 === 1;
    } else {
      // Uniform per-round alternation for all rounds except the
      // odd-totalRounds last round.
      homeBreaks = record.roundIndex % 2 === 0;
    }

    return {
      ...record,
      homeAction: homeBreaks ? 'breaks' : 'racks',
      awayAction: homeBreaks ? 'racks' : 'breaks',
    };
  });
}
