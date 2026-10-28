/**
 * @fileoverview What each tiebreak dropdown may offer — Unit 3 of
 * docs/plans/2026-10-28-001-feat-tiebreaker-record-plan.md.
 *
 * Ed's rule: the SAME players who played the match play the tiebreaker; only
 * the order changes. The lineup page reuses its normal dropdowns — they just
 * get their list from the match lineup instead of the team roster.
 *
 * The one difference from normal mode is double duty: a resolved double duty
 * is the same member id in two slots, and that person plays twice in the
 * tiebreaker too. So "remove a player once picked" must COUNT — a player in
 * the match lineup twice stays available until picked twice. Never dedupe the
 * picks themselves.
 */

/**
 * The player id in each slot of a lineup row, in slot order (empty slots
 * dropped). Duplicates are kept on purpose — they are double duty.
 *
 * @param lineup - A match lineup row (or null while loading)
 * @param size - Number of slots in this match (lineup size)
 */
export function lineupSlotIds(
  lineup: Partial<Record<`player${1 | 2 | 3 | 4 | 5}_id`, string | null>> | null | undefined,
  size: number,
): string[] {
  if (!lineup) return [];
  const ids: string[] = [];
  for (let slot = 1; slot <= size; slot++) {
    const id = lineup[`player${slot}_id` as `player${1 | 2 | 3 | 4 | 5}_id`];
    if (id) ids.push(id);
  }
  return ids;
}

/**
 * Options for one tiebreak dropdown.
 *
 * @param matchLineupIds - Slot ids of this side's MATCH lineup (see lineupSlotIds)
 * @param tiebreakIds - Current tiebreak pick per position, index 0 = position 1 ('' = empty)
 * @param position - The dropdown being built (1-based)
 * @returns `available`: each match-lineup player once, in lineup order (what the
 *   dropdown lists). `disabled`: players already picked as many times as they
 *   appear in the match lineup, counting only the OTHER positions.
 *
 * @example
 * // John plays double duty: picked once in position 1, still offered in 2.
 * tiebreakChoices(['john', 'sara', 'john'], ['john', '', ''], 2)
 * // → { available: ['john', 'sara'], disabled: [] }
 */
export function tiebreakChoices(
  matchLineupIds: string[],
  tiebreakIds: string[],
  position: number,
): { available: string[]; disabled: string[] } {
  const allowed = new Map<string, number>();
  for (const id of matchLineupIds) allowed.set(id, (allowed.get(id) ?? 0) + 1);

  const usedElsewhere = new Map<string, number>();
  tiebreakIds.forEach((id, index) => {
    if (id && index !== position - 1) usedElsewhere.set(id, (usedElsewhere.get(id) ?? 0) + 1);
  });

  const available = [...allowed.keys()];
  const disabled = available.filter((id) => (usedElsewhere.get(id) ?? 0) >= allowed.get(id)!);
  return { available, disabled };
}
