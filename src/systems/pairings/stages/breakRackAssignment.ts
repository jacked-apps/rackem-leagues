/**
 * @fileoverview Pairings Generator — Stage 3: Break/Rack Assignment.
 *
 * Attaches `homeAction` and `awayAction` ('breaks' | 'racks') to each
 * input record, based on the `roundIndex` Stage 1 set and Stage 2
 * preserved. Today's only variant is **per-round alternation**:
 *   - Even-numbered rounds (0, 2, 4, …) → home breaks, away racks.
 *   - Odd-numbered rounds (1, 3, 5, …)  → home racks, away breaks.
 *
 * Stage 3 reads ONLY `roundIndex` from each input record — does not
 * look at `gameNumber` or positions. This is the decoupling that makes
 * Stage 3 an independent dial: a future "strict per-game alternation"
 * variant would read `gameNumber % 2` instead; swap this function,
 * leave Stages 1 and 2 untouched.
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
 * Attaches break/rack annotations to each ordered pair using the
 * per-round-alternation rule: home breaks on even rounds, away breaks
 * on odd rounds. Output preserves all input fields plus the two new
 * action fields; the composer strips `roundIndex` afterward.
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
  return ordered.map((record) => {
    const homeBreaks = record.roundIndex % 2 === 0;
    return {
      ...record,
      homeAction: homeBreaks ? 'breaks' : 'racks',
      awayAction: homeBreaks ? 'racks' : 'breaks',
    };
  });
}
