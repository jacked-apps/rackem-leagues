/**
 * @fileoverview The plain-language mutation report
 * (scripts/mutation-summary/summarize.mjs): a reader who has never heard of
 * Stryker can tell what was caught, what was missed and where, and what was
 * accepted and why.
 *
 * @see docs/plans/2026-11-17-001-feat-trustworthy-tests-plan.md (U8)
 */

import { describe, it, expect } from 'vitest';
import { summarize } from '../../../scripts/mutation-summary/summarize.mjs';

const SOURCE = ['export function par(tie, win) {', '  return tie ?? win;', '}', 'export const ok = (a, b) => a >= b;'].join('\n');
const at = (line: number, start: number, end: number) => ({ start: { line, column: start }, end: { line, column: end } });

type Mutant = { status: string; mutatorName?: string; replacement?: string; location?: ReturnType<typeof at>; coveredBy?: string[]; killedBy?: string[]; statusReason?: string };
const mutant = (m: Mutant) => ({ id: String(Math.random()), mutatorName: 'EqualityOperator', replacement: 'a > b', location: at(4, 29, 35), ...m });
const report = (mutants: Mutant[], tests: [string, string][] = []) => ({
  files: { 'src/utils/par.ts': { source: SOURCE, mutants: mutants.map(mutant) } },
  testFiles: { 'src/par.test.ts': { tests: tests.map(([id, name]) => ({ id, name })) } },
});

describe('mutation summary', () => {
  it('says "caught all" when every mistake was caught (a timeout counts as caught)', () => {
    expect(summarize(report([{ status: 'Killed' }, { status: 'Killed' }, { status: 'Timeout' }]))).toContain(
      '**Of 3 deliberate mistakes, the tests caught all 3.**');
  });

  it('lists each missed mistake with file:line and the change in words', () => {
    const md = summarize(report([{ status: 'Killed' }, { status: 'Survived' },
      { status: 'NoCoverage', mutatorName: 'LogicalOperator', replacement: 'tie && win', location: at(2, 10, 20) }]));
    expect(md).toContain('caught 1 (33%). Missed 2.');
    expect(md).toContain('- src/utils/par.ts:4 — `a >= b` → `a > b` (changed a comparison (e.g. >= to >))');
    expect(md).toContain('- src/utils/par.ts:2 — `tie ?? win` → `tie && win` (swapped and/or (&& ||, ??)) — **no test runs this line at all**');
  });

  it('shows accepted mistakes separately, with the code and the written reason — never as caught', () => {
    const md = summarize(report([{ status: 'Killed' }, { status: 'Ignored', statusReason: 'only changes a log message' }]));
    expect(md).toContain('the tests caught all 1.');
    expect(md).toContain('### Accepted on purpose (1)\n- src/utils/par.ts:4 — `a >= b` → `a > b` (changed a comparison (e.g. >= to >)) — reason: only changes a log message');
  });

  it('leaves out mutants that would not even run (compile/runtime errors)', () => {
    expect(summarize(report([{ status: 'Killed' }, { status: 'CompileError' }]))).toContain('caught all 1.');
  });

  it('names a test that ran on mistakes but caught none', () => {
    const md = summarize(report(
      [{ status: 'Killed', coveredBy: ['t1', 't2'], killedBy: ['t1'] }, { status: 'Survived', coveredBy: ['t2'] }],
      [['t1', 'par › picks the tie target'], ['t2', 'par › renders without crashing']],
    ));
    expect(md).toContain('### Tests that ran on mistakes but caught none\n- par › renders without crashing');
    expect(md).not.toContain('- par › picks the tie target');
  });
});
