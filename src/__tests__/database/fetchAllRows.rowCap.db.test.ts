// @vitest-environment jsdom
/**
 * @fileoverview Proves PostgREST's row cap is real, silent, and that
 * fetchAllRows defeats it — against an actual PostgREST, not a mock.
 *
 * This is the test that would have caught the Oct 2026 production bug. Every
 * unit test passed, typecheck passed, the build passed, and Top Shooters still
 * understated every player in the league, because nothing in the suite asked
 * Postgres for more than a thousand rows. The truncation has no error and no
 * warning attached to it: the array is simply shorter than the table, and the
 * `forEach` that tallies it is perfectly happy.
 *
 * So the first test here deliberately asserts the BUG — an unpaged select over
 * 1,001 rows comes back short with `error === null`. If a future Postgres or
 * PostgREST ever stopped truncating, that test fails and tells us the hazard is
 * gone, which is worth knowing. The second asserts the fix.
 *
 * `app_logs` is the fixture table on purpose: it has no required foreign keys,
 * so 1,001 rows cost one `generate_series` insert instead of standing up an
 * org → league → season → week → teams → match chain. The mechanism under test
 * is PostgREST's response cap, which does not care which table it is capping.
 *
 * Writes go through raw SQL (`executeSql`) and only the reads go through
 * supabase-js, so this never hits the happy-dom insert limitation.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServiceClient, closePostgresPool, executeSql } from '@/test/dbTestUtils';
import { fetchAllRows } from '@/api/queries/fetchAllRows';

/** One more than PostgREST's default cap, so a single request must come up short. */
const TOTAL_ROWS = 1001;

/** Tags our fixture rows so we never read or delete anyone else's logs. */
const MARKER = 'fetchAllRows-rowcap-fixture';

const supabase = createServiceClient();

beforeAll(async () => {
  // Clean up first in case a previous aborted run left rows behind.
  await executeSql(`DELETE FROM public.app_logs WHERE message = $1`, [MARKER]);
  await executeSql(
    `INSERT INTO public.app_logs (level, message, context)
     SELECT 'info', $1, jsonb_build_object('n', n)
       FROM generate_series(1, $2) AS n`,
    [MARKER, TOTAL_ROWS]
  );
});

afterAll(async () => {
  await executeSql(`DELETE FROM public.app_logs WHERE message = $1`, [MARKER]);
  await closePostgresPool();
});

describe('PostgREST row cap', () => {
  it('silently truncates an unpaged select — no error, just fewer rows', async () => {
    const { data, error } = await supabase
      .from('app_logs')
      .select('id')
      .eq('message', MARKER);

    // The whole danger in one assertion: the request SUCCEEDED.
    expect(error).toBeNull();
    expect(data).not.toBeNull();

    // And it is short. Asserted as "fewer than we inserted" rather than
    // "exactly 1000" so the test holds whatever `max_rows` is configured to.
    expect(data!.length).toBeLessThan(TOTAL_ROWS);

    // Leave the observed cap in the output; it is the number that decides when
    // a season's stats start going wrong.
    console.log(
      `PostgREST returned ${data!.length} of ${TOTAL_ROWS} rows for an unpaged select`
    );
  });

  it('fetchAllRows returns every row past the cap', async () => {
    const rows = await fetchAllRows<{ id: string }>(
      (from, to) =>
        supabase
          .from('app_logs')
          .select('id', { count: 'exact' })
          .eq('message', MARKER)
          .order('id')
          .range(from, to),
      { label: 'row cap fixture' }
    );

    expect(rows).toHaveLength(TOTAL_ROWS);

    // No page overlapped another — duplicates would inflate stats rather than
    // deflate them, which is the failure mode of paging without ORDER BY.
    expect(new Set(rows.map((r) => r.id)).size).toBe(TOTAL_ROWS);
  });

  it('fetchAllRows still returns every row without an exact count', async () => {
    // The fallback path: callers that omit `{ count: 'exact' }` must still get
    // everything, just at the cost of one extra probe request.
    const rows = await fetchAllRows<{ id: string }>(
      (from, to) =>
        supabase.from('app_logs').select('id').eq('message', MARKER).order('id').range(from, to),
      { label: 'row cap fixture, no count' }
    );

    expect(rows).toHaveLength(TOTAL_ROWS);
    expect(new Set(rows.map((r) => r.id)).size).toBe(TOTAL_ROWS);
  });

  it('pages correctly when the page size is far below the cap', async () => {
    // Exercises many sequential pages, where an off-by-one in the range maths
    // would duplicate or skip a row at every boundary.
    const rows = await fetchAllRows<{ id: string }>(
      (from, to) =>
        supabase
          .from('app_logs')
          .select('id', { count: 'exact' })
          .eq('message', MARKER)
          .order('id')
          .range(from, to),
      { label: 'row cap fixture, small pages', pageSize: 100 }
    );

    expect(rows).toHaveLength(TOTAL_ROWS);
    expect(new Set(rows.map((r) => r.id)).size).toBe(TOTAL_ROWS);
  });
});
