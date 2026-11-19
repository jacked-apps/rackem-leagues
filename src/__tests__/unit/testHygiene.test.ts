/**
 * @fileoverview Test hygiene guard. Fails CI on the three ways a suite can
 * look green while protecting nothing:
 *
 *   - a skip / todo with no written reason (`// skip-reason: …` above it),
 *     and any `.only` at all;
 *   - a test file no vitest project runs (it would never run);
 *   - a test body that returns part-way through (it passes on missing data
 *     having skipped its assertions — fail with `requireSeed` instead).
 *
 * The self-tests prove each check catches what it should; the last block runs
 * the checks on the real repo. Rules: "Testing Conventions" in CLAUDE.md.
 *
 * @see docs/plans/2026-11-17-001-feat-trustworthy-tests-plan.md (U6)
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import vitestConfig from '../../../vitest.config';
import { findEarlyReturns, findSkips, projectsFor, skipProblems, type ProjectGlobs } from './testHygiene.helpers';

const lines = (...l: string[]) => l.join('\n');
const problemKinds = (src: string) => skipProblems(findSkips(src)).map((p) => `${p.line}:${p.kind}`);

describe('skip guard', () => {
  it('flags a skip, todo or x-test with no reason, at its line', () => {
    expect(problemKinds(lines('it.skip("a", () => {});', 'describe.todo("b");', 'xit("c", () => {});'))).toEqual([
      '1:it.skip', '2:describe.todo', '3:xit',
    ]);
  });

  it('accepts a reason on the line above or on the same line', () => {
    const src = lines('// skip-reason: needs the 2027 seed', 'it.skip("a", () => {});', 'it.todo("b"); // skip-reason: written next sprint');
    expect(problemKinds(src)).toEqual([]);
    expect(findSkips(src).map((f) => f.reason)).toEqual(['needs the 2027 seed', 'written next sprint']);
  });

  it('flags .only even with a reason — it silently skips the rest of the file', () => {
    expect(problemKinds(lines('// skip-reason: debugging', 'it.only("a", () => {});'))).toEqual(['2:it.only']);
  });

  it('flags conditional and run-time skips', () => {
    const src = lines('(flag ? it : it.skip)("a", () => {});', 'it.skipIf(ci)("b", () => {});', 'it("c", (ctx) => { ctx.skip(); });');
    expect(problemKinds(src)).toEqual(['1:it.skip', '2:it.skipIf', '3:ctx.skip()']);
  });

  it('ignores the word "skip" in strings and comments', () => {
    expect(findSkips(lines('// it.skip is banned', 'it("does not it.skip", () => { const s = "describe.only"; });'))).toEqual([]);
  });
});

describe('early-return guard', () => {
  const returns = (body: string) => findEarlyReturns(`it('t', async () => {\n${body}\n});`);

  it('flags a return before the assertions (the old "seed missing, skipping" pattern)', () => {
    expect(returns(lines('if (!id) { console.warn("skipping"); return; }', 'expect(id).toBe(1);'))).toEqual([2]);
  });

  it('flags a return AFTER a first assertion — the rest still gets skipped', () => {
    expect(returns(lines('expect(error).toBeNull();', 'if (!data) return;', 'expect(data.x).toBe(1);'))).toEqual([3]);
  });

  it('allows returns in nested callbacks, `return expect(…)`, and a final return', () => {
    expect(returns(lines('rows.forEach((r) => { if (!r) return; expect(r).toBeTruthy(); });', 'if (x) return expect(x).resolves.toBe(1);', 'return done();'))).toEqual([]);
  });
});

describe('orphan guard', () => {
  const projects: ProjectGlobs[] = [
    { name: 'unit', include: ['src/**/*.{test,spec}.{ts,tsx}'], exclude: ['node_modules', 'src/__tests__/database/**'] },
    { name: 'db', include: ['src/__tests__/database/**/*.{test,spec}.ts'], exclude: [] },
  ];

  it('routes each file to exactly one project', () => {
    expect(projectsFor('src/utils/a.test.ts', projects)).toEqual(['unit']);
    expect(projectsFor('src/__tests__/database/b.db.test.ts', projects)).toEqual(['db']);
  });

  it('finds the orphan: a .tsx db test the db project does not include', () => {
    expect(projectsFor('src/__tests__/database/c.test.tsx', projects)).toEqual([]);
  });

  it('honours bare-folder excludes anywhere in the path', () => {
    expect(projectsFor('src/node_modules/x/a.test.ts', projects)).toEqual([]);
  });
});

describe('the real repo', () => {
  const testFiles = (readdirSync('src', { recursive: true }) as string[])
    .map((f) => `src/${f.split('\\').join('/')}`)
    .filter((f) => /\.(test|spec)\.tsx?$/.test(f));
  const projects = (vitestConfig.test?.projects ?? []) as { test: ProjectGlobs }[];
  const globs = projects.map((p) => ({ name: p.test.name, include: p.test.include ?? [], exclude: p.test.exclude ?? [] }));

  it('finds the test files and both vitest projects', () => {
    expect(testFiles.length).toBeGreaterThan(300);
    expect(globs.map((g) => g.name)).toEqual(['unit', 'db']);
  });

  it('every skip/todo has a written reason, and nothing uses .only', () => {
    const problems = testFiles.flatMap((f) => skipProblems(findSkips(readFileSync(f, 'utf8'), f)).map((p) => `${f}:${p.line} ${p.kind}`));
    expect(problems, 'add `// skip-reason: <why>` above each skip (and remove any .only)').toEqual([]);
  });

  it('every test file is run by exactly one vitest project', () => {
    const wrong = testFiles.map((f) => [f, projectsFor(f, globs)] as const).filter(([, p]) => p.length !== 1);
    expect(wrong.map(([f, p]) => `${f} → ${p.join(', ') || 'no project (never runs)'}`)).toEqual([]);
  });

  it('no test body returns part-way through', () => {
    const found = testFiles.flatMap((f) => findEarlyReturns(readFileSync(f, 'utf8'), f).map((l) => `${f}:${l}`));
    expect(found, 'a test that returns early passes without asserting — use requireSeed() from @/test/dbTestUtils').toEqual([]);
  });
});
