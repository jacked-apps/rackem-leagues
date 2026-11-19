/**
 * @fileoverview Which changed files the query-test guard looks at: app
 * TypeScript under src/, not tests, test helpers or generated types. (Which
 * LINES are query code is spans.mjs.) Plain JS so CI runs it with bare node.
 *
 * @see docs/plans/2026-11-17-001-feat-trustworthy-tests-plan.md (U1)
 */

/**
 * True for app source files the guard should look at: TypeScript under src/,
 * excluding tests, test helpers and generated types.
 *
 * @param {string} path - repo-relative, forward slashes
 * @returns {boolean}
 */
export function isAppSource(path) {
  if (!path.startsWith('src/') || !/\.(ts|tsx)$/.test(path)) return false;
  if (/\.(test|spec)\.(ts|tsx)$/.test(path) || path.endsWith('.d.ts')) return false;
  if (path.includes('/__tests__/') || path.startsWith('src/test/')) return false;
  return path !== 'src/types/database.types.ts';
}
