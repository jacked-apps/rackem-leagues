/**
 * @fileoverview Every local path a test file names must point at a real file.
 *
 * The build (`tsconfig.app.json`) skips test files, so a stale path in a test
 * is invisible to it. Most stale imports still fail when vitest loads the
 * file, but some fail silently:
 * - a `vi.mock('...')` of a moved file quietly stops mocking
 * - `import type` and `typeof import('...')` are erased before running
 *
 * This test reads every file the build skips and checks each relative or
 * `@/` path. The self-tests prove the checks catch what they should; the last
 * block runs them on the real tree. Added for the src/ reorg
 * (docs/plans/2026-11-05-002-refactor-src-folder-reorg-plan.md) and kept
 * after it.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractLocalSpecifiers, findBrokenPaths, listBuildSkippedFiles, resolveSpecifier } from './importPaths.helpers';

const ROOT = process.cwd();

describe('extractLocalSpecifiers', () => {
  it('finds static, type-only, re-export and side-effect imports', () => {
    const src = [
      "import { a } from '@/utils/a';",
      "import type { B } from '../types/b';",
      "export { c } from './c';",
      "import './setup';",
      "import {\n  d,\n  e,\n} from '@/multi/line';",
    ].join('\n');
    expect(extractLocalSpecifiers(src)).toEqual(['@/utils/a', '../types/b', './c', './setup', '@/multi/line']);
  });

  it('finds vi.* strings, dynamic imports and typeof import', () => {
    const src = [
      "vi.mock('@/api/client');",
      'vi.mock("../hooks/useThing", () => ({}));',
      "const real = await vi.importActual<typeof import('@/utils/real')>('@/utils/real');",
      "vi.doMock('./later');",
      "const m = await import('../lazy/Page');",
    ].join('\n');
    expect(extractLocalSpecifiers(src).sort()).toEqual(
      ['@/api/client', '../hooks/useThing', '@/utils/real', '@/utils/real', './later', '../lazy/Page'].sort(),
    );
  });

  it('skips bare package names and virtual ids', () => {
    const src = "import React from 'react';\nvi.mock('sonner');\nvi.mock('virtual:pwa-register/react');";
    expect(extractLocalSpecifiers(src)).toEqual([]);
  });
});

describe('resolveSpecifier', () => {
  const files = new Set([
    'src/utils/a.ts',
    'src/components/Card.tsx',
    'src/components/shared/index.ts',
    'src/data/table.json',
  ]);
  const exists = (p: string) => files.has(p);

  it('resolves @/ and relative paths with the bundler extensions', () => {
    expect(resolveSpecifier('src/x/y.test.ts', '@/utils/a', exists)).toBe('src/utils/a.ts');
    expect(resolveSpecifier('src/components/__tests__/Card.test.tsx', '../Card', exists)).toBe('src/components/Card.tsx');
    expect(resolveSpecifier('src/x.test.ts', '@/data/table.json', exists)).toBe('src/data/table.json');
  });

  it('resolves a folder to its index file', () => {
    expect(resolveSpecifier('src/a.test.ts', '@/components/shared', exists)).toBe('src/components/shared/index.ts');
  });

  it('returns null for a path that does not exist', () => {
    expect(resolveSpecifier('src/a.test.ts', '@/does/not/exist', exists)).toBeNull();
  });
});

describe('findBrokenPaths', () => {
  it('names the file and the specifier of each broken path', () => {
    const exists = (p: string) => p === 'src/real.ts';
    const sources = { 'src/a.test.ts': "vi.mock('@/real');\nvi.mock('@/does/not/exist');\nimport type { X } from '../nope';" };
    expect(findBrokenPaths(sources, exists)).toEqual([
      'src/a.test.ts → @/does/not/exist',
      'src/a.test.ts → ../nope',
    ]);
  });
});

describe('real tree', () => {
  it('lists the files the build skips', () => {
    const files = listBuildSkippedFiles(ROOT);
    expect(files).toContain('src/__tests__/unit/importPaths.test.ts');
    expect(files).toContain('src/test/setup.ts');
    expect(files.some((f) => f.endsWith('.test.tsx') && !f.startsWith('src/__tests__/'))).toBe(true);
  });

  it('every local path in those files points at a real file', () => {
    // These files are skipped: their self-tests hold made-up paths on purpose.
    const fixtures = new Set(['src/__tests__/unit/importPaths.test.ts', 'src/__tests__/unit/reorgMove.test.ts']);
    const files = listBuildSkippedFiles(ROOT).filter((f) => !fixtures.has(f));
    const broken = findBrokenPaths(
      Object.fromEntries(files.map((f) => [f, readSource(f)])),
      (p) => existsSync(join(ROOT, p)),
    );
    expect(broken).toEqual([]);
  });
});

function readSource(relPath: string): string {
  return readFileSync(join(ROOT, relPath), 'utf8');
}
