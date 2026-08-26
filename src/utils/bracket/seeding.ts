/**
 * @fileoverview Seed placement + byes for the bracket engine.
 *
 * Standard tournament seeding: the field is padded up to the next power of two,
 * the top seeds receive byes (fewer than a full power-of-two field), and seeds
 * are placed so the strongest can't meet until late rounds (1 vs the final only
 * in the final). Pure + deterministic — no reliance on the league playoff
 * helper (which is power-of-two-only and has no bye concept).
 */

/** Smallest power of two >= n (min 1). */
export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Standard recursive seed slot ordering for a power-of-two bracket.
 *
 * Returns an array of length `size` giving the seed number (1..size) at each
 * bracket position, top to bottom. Adjacent pairs (0,1), (2,3), … are the
 * round-1 matchups. The construction guarantees higher seeds are spread across
 * the bracket so seed 1 and seed 2 can only meet in the final.
 *
 * e.g. size 8 → [1, 8, 4, 5, 2, 7, 3, 6] → matchups 1v8, 4v5, 2v7, 3v6.
 *
 * @param size a power of two (use {@link nextPow2} on the real field first)
 */
export function seedSlots(size: number): number[] {
  if (size < 1) return [];
  let slots = [1];
  while (slots.length < size) {
    const roundSize = slots.length * 2;
    const sum = roundSize + 1; // paired seeds always sum to (currentSize*2 + 1)
    const next: number[] = [];
    for (const seed of slots) {
      next.push(seed);
      next.push(sum - seed);
    }
    slots = next;
  }
  return slots;
}

/**
 * Resolve the round-1 matchups for `participantCount` real players.
 *
 * Pads to the next power of two, lays out the standard slots, and returns the
 * home/away seed for each round-1 match. A seed greater than `participantCount`
 * is a BYE (returned as null) — because byes attach to the highest seed numbers
 * and the slot ordering pairs seed `s` with `size+1-s`, byes land on the top
 * seeds automatically.
 *
 * @returns one entry per round-1 match: `{ home, away }` seed numbers, null = bye
 */
export function roundOnePairs(
  participantCount: number
): Array<{ home: number | null; away: number | null }> {
  const size = nextPow2(participantCount);
  const slots = seedSlots(size);
  const pairs: Array<{ home: number | null; away: number | null }> = [];
  for (let i = 0; i < size; i += 2) {
    const home = slots[i] <= participantCount ? slots[i] : null;
    const away = slots[i + 1] <= participantCount ? slots[i + 1] : null;
    pairs.push({ home, away });
  }
  return pairs;
}
