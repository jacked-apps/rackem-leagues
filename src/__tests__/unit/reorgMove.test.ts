/**
 * @fileoverview Proves the src/ reorg move script rewrites paths correctly
 * before it touches the real tree: style is kept (alias stays alias, relative
 * stays relative), moved files fix their own relative paths, and bad maps are
 * refused. Script: `scripts/reorg/move.ts`.
 */

import { describe, it, expect } from 'vitest';
import { rewriteSpecifier } from '../../../scripts/reorg/paths';
import { expandMoves, planRewrites } from '../../../scripts/reorg/move';

describe('rewriteSpecifier', () => {
  it('keeps an alias path as an alias', () => {
    expect(rewriteSpecifier('@/components/stats/Bar', 'src/x.ts', 'src/components/stats/Bar.tsx', 'src/stats/Bar.tsx', 'src/x.ts')).toBe('@/stats/Bar');
  });

  it('recomputes a relative path from the importer’s new home', () => {
    expect(rewriteSpecifier('../utils/a', 'src/pages/P.tsx', 'src/utils/a.ts', 'src/utils/a.ts', 'src/stats/pages/P.tsx')).toBe('../../utils/a');
    expect(rewriteSpecifier('./B', 'src/pages/A.tsx', 'src/pages/B.tsx', 'src/stats/B.tsx', 'src/pages/A.tsx')).toBe('../stats/B');
  });

  it('keeps folder-for-index and explicit-extension forms', () => {
    expect(rewriteSpecifier('@/components/wizard', 'src/x.ts', 'src/components/wizard/index.ts', 'src/wizards/shared/index.ts', 'src/x.ts')).toBe('@/wizards/shared');
    expect(rewriteSpecifier('./data.json', 'src/a/x.ts', 'src/a/data.json', 'src/b/data.json', 'src/a/x.ts')).toBe('../b/data.json');
  });

  it('keeps a ?query suffix', () => {
    expect(rewriteSpecifier('./icon.svg?raw', 'src/a/x.ts', 'src/a/icon.svg', 'src/b/icon.svg', 'src/a/x.ts')).toBe('../b/icon.svg?raw');
  });
});

describe('expandMoves', () => {
  const tracked = ['src/a/One.tsx', 'src/a/sub/Two.ts', 'src/b/Keep.ts', 'src/ab/Other.ts'];

  it('expands a folder into one move per file, without catching look-alike folders', () => {
    const moves = expandMoves([{ from: 'src/a', to: 'src/z' }], tracked);
    expect([...moves]).toEqual([
      ['src/a/One.tsx', 'src/z/One.tsx'],
      ['src/a/sub/Two.ts', 'src/z/sub/Two.ts'],
    ]);
  });

  it('refuses a move onto an existing file, a clash, or a missing source', () => {
    expect(() => expandMoves([{ from: 'src/a/One.tsx', to: 'src/b/Keep.ts' }], tracked)).toThrow(/overwrite/);
    expect(() => expandMoves([{ from: 'src/a/One.tsx', to: 'src/q/X.ts' }, { from: 'src/b/Keep.ts', to: 'src/q/X.ts' }], tracked)).toThrow(/Two files/);
    expect(() => expandMoves([{ from: 'src/nope', to: 'src/x' }], tracked)).toThrow(/Nothing tracked/);
  });
});

describe('planRewrites', () => {
  const files: Record<string, string> = {
    'src/components/stats/Bar.tsx': "import { a } from '../../utils/a';\nexport const Bar = a;",
    'src/utils/a.ts': 'export const a = 1;',
    'src/pages/Page.tsx': "import { Bar } from '@/components/stats/Bar';\nimport { a } from '../utils/a';",
    'src/pages/Page.test.tsx': "vi.mock('@/components/stats/Bar');\nimport type { T } from '../components/stats/Bar';\nconst P = lazy(() => import('./Page'));",
    'src/other/Untouched.ts': "import { a } from '@/utils/a';",
  };
  const exists = (p: string) => p in files;
  const moves = new Map([['src/components/stats/Bar.tsx', 'src/stats/Bar.tsx']]);
  const plan = planRewrites(moves, Object.keys(files), (p) => files[p], exists);

  it('fixes the moved file’s own relative imports', () => {
    expect(plan.get('src/components/stats/Bar.tsx')?.text).toContain("from '../utils/a'");
  });

  it('fixes importers in every form, including vi.mock and import type', () => {
    expect(plan.get('src/pages/Page.tsx')?.text).toBe("import { Bar } from '@/stats/Bar';\nimport { a } from '../utils/a';");
    const test = plan.get('src/pages/Page.test.tsx')?.text ?? '';
    expect(test).toContain("vi.mock('@/stats/Bar')");
    expect(test).toContain("from '../stats/Bar'");
    expect(test).toContain("import('./Page')");
    expect(plan.get('src/pages/Page.test.tsx')?.count).toBe(2);
  });

  it('leaves files that point at nothing moved alone', () => {
    expect(plan.has('src/other/Untouched.ts')).toBe(false);
    expect(plan.has('src/utils/a.ts')).toBe(false);
  });
});
