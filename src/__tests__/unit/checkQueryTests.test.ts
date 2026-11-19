/**
 * @fileoverview The query-test guard (scripts/check-query-tests.mjs): a PR
 * that changes a database query needs a real-database test that uses it.
 *
 * The case that matters most is My Stats (#277): an embed edited INSIDE a
 * multi-line select constant, with no database test — Postgres rejected the
 * query while every unit test passed. The first test below is that shape.
 *
 * @see docs/plans/2026-11-17-001-feat-trustworthy-tests-plan.md (U1)
 */

import { describe, it, expect } from 'vitest';
import { evaluate, parseWaiver } from '../../../scripts/query-tests/evaluate.mjs';
import { changedLines } from '../../../scripts/query-tests/diff.mjs';
import { queryLines } from '../../../scripts/query-tests/spans.mjs';

const HISTORY = 'src/api/queries/playerGameHistory.ts';
const historySource = [
  "import { supabase } from '@/supabaseClient';", //                       1
  'export const GAME_SELECT = `', //                                        2
  '  id, game_number,', //                                                  3
  '  lineup:match_lineups(player1_handicap)', //                            4  ← the #277 bug lived here
  '`;', //                                                                  5
  'export async function fetchGames(id: string) {', //                     6
  '  const sorted = Array.from([id]).sort();', //                           7
  "  return supabase.from('match_games')", //                               8
  '    .select(GAME_SELECT)', //                                            9
  "    .eq('player_id', sorted[0]);", //                                    10
  '}', //                                                                   11
].join('\n');

const usesFetchGames = {
  path: 'src/__tests__/database/playerGameHistory.db.test.ts',
  source: "import { fetchGames } from '@/api/queries/playerGameHistory';\nit('x', async () => { expect(await fetchGames('p')).toBeTruthy(); });",
};

/** Run the guard on one changed file with the given changed lines. */
function check(lines: number[], dbTests: { path: string; source: string }[], prBody = '') {
  return evaluate({
    changed: new Map([[HISTORY, new Set(lines)]]),
    readSource: () => historySource,
    dbTests,
    prBody,
  });
}

describe('query-test guard', () => {
  it('fails the #277 shape: embed edited inside the select constant, no db test', () => {
    const result = check([4], []);
    expect(result.ok).toBe(false);
    expect(result.uncovered).toEqual([HISTORY]);
  });

  it('fails when only a continuation line of the chain changed', () => {
    expect(check([10], []).ok).toBe(false);
  });

  it('passes when a db test calls the changed module', () => {
    expect(check([4], [usesFetchGames])).toMatchObject({ ok: true, covered: [HISTORY] });
  });

  it('fails when a db test only imports the module and never uses it', () => {
    const importOnly = { ...usesFetchGames, source: "import { fetchGames } from '@/api/queries/playerGameHistory';\nit('x', () => {});" };
    expect(check([4], [importOnly]).ok).toBe(false);
  });

  it('counts a dynamic import of the module as using it', () => {
    const dynamic = { ...usesFetchGames, source: "it('x', async () => { await import('@/api/queries/playerGameHistory'); });" };
    expect(check([4], [dynamic]).ok).toBe(true);
  });

  it('ignores a change outside any query (Array.from is not a query)', () => {
    expect(check([7], [])).toMatchObject({ ok: true, uncovered: [] });
  });

  it('passes with a waiver that gives a reason', () => {
    expect(check([4], [], 'Realtime only. [no-db-test: CI has no realtime]').ok).toBe(true);
  });

  it('fails with a waiver that gives no reason', () => {
    expect(check([4], [], '[no-db-test: ]').ok).toBe(false);
  });

  it('ignores test files and generated types', () => {
    const result = evaluate({
      changed: new Map([
        ['src/foo.test.ts', new Set([1])],
        ['src/types/database.types.ts', new Set([1])],
      ]),
      readSource: () => "supabase.from('x')",
      dbTests: [],
      prBody: '',
    });
    expect(result).toMatchObject({ ok: true, uncovered: [] });
  });
});

describe('query regions', () => {
  it('covers the chain and the select constant, not the rest of the file', () => {
    expect([...queryLines(historySource)].sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 8, 9, 10]);
  });

  it('is not confused by brackets inside strings or comments', () => {
    const src = "const q = supabase.from('t') // a ( stray paren\n  .select('a, b)')\n  .eq('x', 1);\nconst other = 2;";
    expect([...queryLines(src)]).toEqual([1, 2, 3]);
  });
});

describe('diff parsing', () => {
  it('maps added lines to new-side line numbers', () => {
    expect(changedLines('+++ b/src/a.ts\n@@ -3,0 +4,2 @@\n+x\n+y').get('src/a.ts')).toEqual(new Set([4, 5]));
  });

  it('marks both neighbours of a pure deletion', () => {
    expect(changedLines('+++ b/src/a.ts\n@@ -10 +9,0 @@\n-gone').get('src/a.ts')).toEqual(new Set([9, 10]));
  });

  it('skips deleted files', () => {
    expect(changedLines('--- a/src/a.ts\n+++ /dev/null\n@@ -1 +0,0 @@\n-x').size).toBe(0);
  });
});

describe('parseWaiver', () => {
  it('reads the reason, case-insensitively', () => {
    expect(parseWaiver('[No-DB-Test: realtime only]')).toEqual({ present: true, reason: 'realtime only' });
  });

  it('reports no waiver when absent', () => {
    expect(parseWaiver('nothing here')).toEqual({ present: false, reason: '' });
  });
});
