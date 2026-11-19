/**
 * @fileoverview The CI results summary (scripts/test-summary/summarize.mjs):
 * the counts Ed reads come from what actually ran, failures come first, and
 * a test that disappeared from the branch is named.
 *
 * @see docs/plans/2026-11-17-001-feat-trustworthy-tests-plan.md (U7)
 */

import { describe, it, expect } from 'vitest';
import { flatten, summarize } from '../../../scripts/test-summary/summarize.mjs';

type Status = 'passed' | 'failed' | 'skipped' | 'pending' | 'todo';
const file = (name: string, tests: [string, Status, string?][]) => ({
  name: `/home/runner/work/repo/repo/src/${name}`,
  status: tests.some(([, s]) => s === 'failed') ? 'failed' : 'passed',
  assertionResults: tests.map(([title, status, msg]) => ({ ancestorTitles: ['group'], title, status, failureMessages: msg ? [msg] : [] })),
});
const report = (...files: ReturnType<typeof file>[]) => ({ testResults: files });

describe('summarize', () => {
  it('counts what ran', () => {
    const tests = Array.from({ length: 10 }, (_, i): [string, Status] => [`t${i}`, 'passed']);
    expect(summarize(report(file('a.test.ts', tests)), { title: 'Unit tests' })).toContain('**10 passed, 0 failed, 0 skipped, 0 todo**');
  });

  it('lists failures before anything else, with the first line of the error', () => {
    const md = summarize(report(file('a.test.ts', [['ok', 'passed'], ['bad', 'failed', '\nAssertionError: expected 3 to be 4\n  at x']]), file('b.test.ts', [['skip', 'skipped']])), { title: 'T' });
    expect(md).toContain('**1 passed, 1 failed, 1 skipped, 0 todo**');
    expect(md).toContain('- src/a.test.ts › group › bad — AssertionError: expected 3 to be 4');
    expect(md.indexOf('### Failed')).toBeLessThan(md.indexOf('### Skipped'));
  });

  it('counts skipped and todo separately, and names them', () => {
    const md = summarize(report(file('a.test.ts', [['s', 'skipped'], ['p', 'pending'], ['t', 'todo']])), { title: 'T' });
    expect(md).toContain('0 passed, 0 failed, 2 skipped, 1 todo');
    expect(md).toContain('- todo: src/a.test.ts › group › t');
  });

  it('counts a file that failed to load as a failure, not as zero tests', () => {
    const broken = { name: 'C:\\repo\\src\\c.test.ts', status: 'failed', message: 'Cannot find module x', assertionResults: [] };
    expect(flatten(report(broken))).toEqual([{ id: 'src/c.test.ts (file failed to load)', status: 'failed', message: 'Cannot find module x' }]);
  });

  it('names a test that is on main but not on this branch', () => {
    const main = report(file('a.test.ts', [['kept', 'passed'], ['deleted', 'passed']]));
    const md = summarize(report(file('a.test.ts', [['kept', 'passed']])), { title: 'T', mainReport: main });
    expect(md).toContain('### Removed tests (on main, not on this branch)\n- src/a.test.ts › group › deleted');
  });

  it("says it couldn't compare when there's no report from main", () => {
    expect(summarize(report(file('a.test.ts', [['x', 'passed']])), { title: 'T' })).toContain("Couldn't compare");
  });
});
