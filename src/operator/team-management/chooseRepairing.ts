/**
 * @fileoverview Pick how to re-pair one week after an odd-league drop, keeping
 * end-of-season matchup counts as even as possible (Ed's "hybrid", 2026-11-19).
 *
 * Each week two teams are left over: X (was due to play the dropped team) and
 * Y (had the bye). The default is to pair them (only 2 teams change). But on
 * the bowling chart the same X/Y pairs come round again and again, so pairing
 * them every week left one pair meeting 8 times in a 16-week season. So we also
 * consider pulling in one other match that night, A vs B, and playing X–A and
 * Y–B (or X–B and Y–A). That changes 4 teams but can spread the repeats.
 *
 * Choice, in order:
 *   1. the lowest WORST pair count over the whole season,
 *   2. then the most even spread (smallest sum of squared pair counts),
 *   3. then the fewest teams changed (the plain X–Y swap wins ties).
 * On the real chart this lands on, or within one pair of, the fairest split
 * that's mathematically possible.
 */

/** Season-long meetings per pair, keyed by pairKey. Mutated by the caller. */
export type PairCounts = Map<string, number>;

/** Order-independent key for a pair of teams. */
export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** An unplayed real match that night that could be pulled into the re-pairing. */
export interface PullableMatch {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
}

export interface Repairing {
  /** The new pairs to play (1 for the plain swap, 2 when a match is pulled in). */
  pairs: [string, string][];
  /** The match pulled in (its old pairing is replaced), if any. */
  pulled?: PullableMatch;
}

/**
 * @param x - Team that lost its opponent (the dropped team)
 * @param y - Team that had the bye
 * @param pullable - Other unplayed real matches that week
 * @param counts - Season-long pair counts as the schedule currently stands
 * @returns The chosen re-pairing (counts are NOT updated here)
 */
export function chooseRepairing(x: string, y: string, pullable: PullableMatch[], counts: PairCounts): Repairing {
  const options: Repairing[] = [{ pairs: [[x, y]] }];
  for (const m of pullable) {
    options.push({ pairs: [[x, m.homeTeamId], [y, m.awayTeamId]], pulled: m });
    options.push({ pairs: [[x, m.awayTeamId], [y, m.homeTeamId]], pulled: m });
  }

  let best: { option: Repairing; score: number[] } | null = null;
  for (const option of options) {
    const after = new Map(counts);
    const bump = (a: string, b: string, by: number) => after.set(pairKey(a, b), (after.get(pairKey(a, b)) ?? 0) + by);
    if (option.pulled) bump(option.pulled.homeTeamId, option.pulled.awayTeamId, -1);
    for (const [a, b] of option.pairs) bump(a, b, 1);
    const values = [...after.values()];
    const score = [Math.max(...values), values.reduce((s, n) => s + n * n, 0), option.pulled ? 1 : 0];
    if (!best || isLower(score, best.score)) best = { option, score };
  }
  return best!.option;
}

/** Lexicographic "a beats b". */
function isLower(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}
