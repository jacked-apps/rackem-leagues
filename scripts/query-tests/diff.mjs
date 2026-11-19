/**
 * @fileoverview Read a `git diff -U0` into "which new-side lines changed, per
 * file" — the input the query-test guard intersects with query regions.
 *
 * A pure deletion has no new-side lines, so it marks the lines on either side
 * of the gap: deleting `.eq('status', 'done')` from a chain is a query change.
 *
 * @see docs/plans/2026-11-17-001-feat-trustworthy-tests-plan.md (U1)
 */

/**
 * @param {string} patch - output of `git diff -U0 <base> <head>`
 * @returns {Map<string, Set<number>>} repo path → changed 1-based line numbers
 * @example changedLines('+++ b/src/a.ts\n@@ -3,0 +4,2 @@\n+x\n+y').get('src/a.ts') // Set {4, 5}
 */
export function changedLines(patch) {
  const result = new Map();
  let current = null;
  for (const line of patch.split('\n')) {
    if (line.startsWith('+++ ')) {
      const path = line.slice(4).trim();
      current = path === '/dev/null' ? null : path.replace(/^b\//, '');
      if (current && !result.has(current)) result.set(current, new Set());
      continue;
    }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (!hunk || !current) continue;
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    const lines = result.get(current);
    if (count === 0) {
      lines.add(start); // the line before the gap…
      lines.add(start + 1); // …and the line after it
    } else {
      for (let n = start; n < start + count; n++) lines.add(n);
    }
  }
  return result;
}
