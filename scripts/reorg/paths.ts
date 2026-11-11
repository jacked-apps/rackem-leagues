/**
 * @fileoverview Find and resolve the module paths a source file names.
 *
 * Shared by the src/ reorg move script (`scripts/reorg/move.ts`) and the
 * stale-path guard (`src/__tests__/unit/importPaths.test.ts`), so both agree
 * on what counts as a path and where it points.
 * Plan: docs/plans/2026-11-05-002-refactor-src-folder-reorg-plan.md
 */

import { posix } from 'node:path';

/**
 * Patterns that carry a module path. Each has one capture group: the path.
 * - `from '...'` covers import, import type and export-from (any line count)
 * - `import '...'` is a side-effect import
 * - `import('...')` covers dynamic import, `lazy()` and `typeof import('...')`
 * - `vi.mock('...')` and friends, with an optional `<generic>` before the paren
 */
const PATTERNS = [
  /\bfrom\s+(['"])([^'"]+)\1/g,
  /^\s*import\s+(['"])([^'"]+)\1/gm,
  /\bimport\(\s*(['"])([^'"]+)\1\s*\)/g,
  /\bvi\.(?:mock|doMock|unmock|doUnmock|importActual|importMock)\s*(?:<[^>]*>)?\s*\(\s*(['"])([^'"]+)\1/g,
];

/** The extensions and index files the bundler tries, in order. */
export const SUFFIXES = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '/index.ts', '/index.tsx', '/index.js'];

/** One local path found in a file, with where its text sits. */
export interface SpecifierMatch {
  spec: string;
  /** Index of the first character of the path (inside the quotes). */
  start: number;
  /** Index just past the last character of the path. */
  end: number;
}

/** True for `./`, `../` and `@/` paths; false for packages and virtual ids. */
export function isLocal(spec: string): boolean {
  return spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('@/');
}

/**
 * Every local path in a source file, in order, with positions.
 *
 * @param source - The file's text.
 */
export function findSpecifiers(source: string): SpecifierMatch[] {
  const seen = new Map<number, SpecifierMatch>();
  for (const pattern of PATTERNS) {
    for (const m of source.matchAll(pattern)) {
      const spec = m[2];
      if (!isLocal(spec)) continue;
      const start = (m.index ?? 0) + m[0].lastIndexOf(m[1] + spec + m[1]) + 1;
      seen.set(start, { spec, start, end: start + spec.length });
    }
  }
  return [...seen.values()].sort((a, b) => a.start - b.start);
}

/** Just the path strings from {@link findSpecifiers}. */
export function extractLocalSpecifiers(source: string): string[] {
  return findSpecifiers(source).map((m) => m.spec);
}

/**
 * Where a specifier points before suffixes: `'@/a/b'` → `'src/a/b'`,
 * `'../b'` from `'src/a/x.ts'` → `'src/b'`. A `?query` is dropped.
 */
export function specifierBase(fromFile: string, spec: string): string {
  const clean = spec.split('?')[0];
  return clean.startsWith('@/')
    ? posix.join('src', clean.slice(2))
    : posix.join(posix.dirname(fromFile), clean);
}

/**
 * Resolve a specifier to a repo-relative file, or null if none exists.
 *
 * @param fromFile - Repo-relative path of the importing file (forward slashes).
 * @param spec - A relative or `@/` specifier, e.g. `'@/utils/a'` or `'../Card'`.
 * @param exists - Answers "is there a file at this repo-relative path?".
 * @returns The resolved path, e.g. `'src/utils/a.ts'`, or null.
 */
export function resolveSpecifier(fromFile: string, spec: string, exists: (p: string) => boolean): string | null {
  const base = specifierBase(fromFile, spec);
  for (const suffix of SUFFIXES) {
    if (exists(base + suffix)) return base + suffix;
  }
  return null;
}

/**
 * Every broken path across a set of files, as `'file → specifier'`.
 *
 * @param sources - Map of repo-relative path → file text.
 * @param exists - Answers "is there a file at this repo-relative path?".
 */
export function findBrokenPaths(sources: Record<string, string>, exists: (p: string) => boolean): string[] {
  const broken: string[] = [];
  for (const [file, text] of Object.entries(sources)) {
    for (const spec of extractLocalSpecifiers(text)) {
      if (resolveSpecifier(file, spec, exists) === null) broken.push(`${file} → ${spec}`);
    }
  }
  return broken;
}

/**
 * The specifier an importer should use after files move, keeping its style:
 * alias stays alias, relative stays relative, and the same suffix form
 * (no extension, explicit extension, or folder-for-index) is kept.
 *
 * @param spec - The specifier as written today.
 * @param oldFrom - Where the importing file is today.
 * @param oldTarget - The file the specifier resolves to today.
 * @param newTarget - Where that file will be.
 * @param newFrom - Where the importing file will be.
 * @returns The specifier to write.
 */
export function rewriteSpecifier(spec: string, oldFrom: string, oldTarget: string, newTarget: string, newFrom: string): string {
  const query = spec.includes('?') ? spec.slice(spec.indexOf('?')) : '';
  // The part the bundler added (".ts", "/index.tsx", or nothing) stays the same.
  const suffix = oldTarget.slice(specifierBase(oldFrom, spec).length);
  if (!newTarget.endsWith(suffix)) throw new Error(`${newTarget} lost the "${suffix}" suffix that ${spec} relies on`);
  const newBase = newTarget.slice(0, newTarget.length - suffix.length);
  if (spec.startsWith('@/')) return '@/' + newBase.replace(/^src\//, '') + query;
  let rel = posix.relative(posix.dirname(newFrom), newBase);
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel + query;
}
