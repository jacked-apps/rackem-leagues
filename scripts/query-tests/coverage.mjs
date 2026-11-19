/**
 * @fileoverview Does a real-database test actually EXERCISE a module? — the
 * second half of the query-test guard (`scripts/check-query-tests.mjs`).
 *
 * "Covered" means a file under src/__tests__/database/ imports the module AND
 * uses something it imported (calls a function, reads a select constant). A
 * bare import doesn't count: it is the cheapest way to turn the guard green
 * while testing nothing, which is the failure this whole effort is about.
 * A dynamic `import('…')` of the module counts — that runs it.
 *
 * @see docs/plans/2026-11-17-001-feat-trustworthy-tests-plan.md (U1)
 */

import { posix } from 'node:path';

const STATIC_IMPORT = /import\s+(?!type\b)([\s\S]*?)\s+from\s+['"]([^'"]+)['"]\s*;?/g;

/**
 * Resolve an import specifier, as written in `fromFile`, to a repo path with
 * no extension (`@/api/x` → `src/api/x`). Returns null for packages.
 *
 * @param {string} specifier
 * @param {string} fromFile - repo-relative path of the importing file
 * @returns {string | null}
 */
export function resolveSpecifier(specifier, fromFile) {
  let path;
  if (specifier.startsWith('@/')) path = `src/${specifier.slice(2)}`;
  else if (specifier.startsWith('.')) path = posix.join(posix.dirname(fromFile), specifier);
  else return null;
  return path.replace(/\.(ts|tsx|js|mjs)$/, '').replace(/\/index$/, '');
}

/** `src/api/queries/x.ts` → `src/api/queries/x` (also strips `/index`). */
export function moduleKey(path) {
  return path.replace(/\.(ts|tsx)$/, '').replace(/\/index$/, '');
}

/**
 * Local names bound by one import clause: `{ a, b as c }`, `X`, `X, { a }`,
 * `* as ns`. Namespace bindings come back flagged so usage checks `ns.`.
 *
 * @param {string} clause - the text between `import` and `from`
 * @returns {{ local: string, namespace: boolean }[]}
 */
export function importedBindings(clause) {
  const bindings = [];
  const namespace = clause.match(/\*\s+as\s+([\w$]+)/);
  if (namespace) bindings.push({ local: namespace[1], namespace: true });
  const named = clause.match(/\{([^}]*)\}/);
  if (named) {
    for (const part of named[1].split(',')) {
      const trimmed = part.trim();
      if (!trimmed || trimmed.startsWith('type ')) continue;
      bindings.push({ local: trimmed.split(/\s+as\s+/).pop().trim(), namespace: false });
    }
  }
  const defaultName = clause.replace(/\{[^}]*\}/, '').replace(/\*\s+as\s+[\w$]+/, '');
  const head = defaultName.split(',')[0].trim();
  if (/^[A-Za-z_$][\w$]*$/.test(head)) bindings.push({ local: head, namespace: false });
  return bindings;
}

/**
 * True when `testSource` (at `testPath`) imports the module `targetKey` and
 * uses at least one imported binding outside the import statements.
 *
 * @param {string} testSource
 * @param {string} testPath - repo-relative
 * @param {string} targetKey - from {@link moduleKey}
 * @returns {boolean}
 */
export function testExercises(testSource, testPath, targetKey) {
  for (const match of testSource.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    if (resolveSpecifier(match[1], testPath) === targetKey) return true;
  }
  const body = testSource.replace(STATIC_IMPORT, '');
  for (const match of testSource.matchAll(STATIC_IMPORT)) {
    if (resolveSpecifier(match[2], testPath) !== targetKey) continue;
    for (const { local, namespace } of importedBindings(match[1])) {
      const escaped = local.replace(/\$/g, '\\$');
      const use = namespace ? `\\b${escaped}\\s*\\.` : `\\b${escaped}\\b`;
      if (new RegExp(use).test(body)) return true;
    }
  }
  return false;
}
