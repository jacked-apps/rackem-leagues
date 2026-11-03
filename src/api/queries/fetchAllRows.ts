/**
 * @fileoverview Paginated fetch for queries that must return EVERY matching row.
 *
 * PostgREST caps the number of rows it will return in one response (Supabase's
 * default is 1000; our local `supabase/config.toml` pins `max_rows = 1000`).
 * Past that cap the response is **silently truncated** — no error, no warning,
 * just a shorter array than the table holds. Any code that then tallies the
 * array produces plausible, wrong numbers.
 *
 * That is not hypothetical. In Oct 2026 a season crossed the cap (1,008
 * countable games) and Top Shooters, Team Stats and Feats all began
 * under-reporting, for every player, with nothing in the UI or the logs to say
 * so. It surfaced only because a hand-verified data fix appeared to do nothing:
 * an unordered query returns heap order, an `UPDATE` writes a new row version
 * at the *end* of the heap, so correcting six games pushed exactly those six
 * past the cap and out of the stats.
 *
 * Two rules follow, and this helper only enforces the first:
 *
 *  1. **Page until the server stops giving rows** — what {@link fetchAllRows}
 *     does. It never assumes our requested page size is the server's limit, so
 *     it stays correct if `max_rows` is lowered.
 *  2. **Order by something unique** — the caller's job. `.range()` without
 *     `ORDER BY` is not stable paging: Postgres may return rows in any order
 *     between requests, so pages can overlap or skip. Every caller passes
 *     `.order('id')` (or another unique column). A `LIMIT`/`OFFSET` walk over an
 *     unordered query is a different bug wearing the same clothes.
 *
 * Prefer aggregating in the database when a page only needs totals — shipping
 * ~1,000 rows to a browser to count them in a `forEach` is work nobody needs.
 * This helper is for the cases that genuinely need the rows.
 *
 * @example
 * const games = await fetchAllRows<GameRow>(
 *   (from, to) =>
 *     supabase
 *       .from('match_games')
 *       .select('home_player_id, away_player_id, winner_player_id')
 *       .eq('is_tiebreaker', false)
 *       .order('id')          // REQUIRED: stable paging
 *       .range(from, to),
 *   { label: 'season player stats games' }
 * );
 */

import { logger } from '@/utils/logger';

/**
 * The shape every supabase-js query resolves to, narrowed to what paging needs.
 */
export interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
  /**
   * Total matching rows, present when the caller passed
   * `.select(cols, { count: 'exact' })`. PostgREST reports it in Content-Range
   * as the size of the whole result set, not of this page.
   *
   * Supplying it is worth the trouble: it is the only way to know a short first
   * page means "that's all the rows" rather than "the server capped me". Without
   * it, paging has to spend one extra round trip proving there is nothing left.
   */
  count?: number | null;
}

/** Options for {@link fetchAllRows}. */
export interface FetchAllRowsOptions {
  /**
   * Human-readable description of what is being fetched, used in the thrown
   * error and in the runaway-guard warning. e.g. 'season player stats games'.
   */
  label: string;
  /**
   * Rows to request per page. Defaults to 1000, matching PostgREST's cap. The
   * server may return fewer; that is handled, not assumed to mean "done".
   */
  pageSize?: number;
  /**
   * Safety valve so a paging bug can't loop forever. At the default page size
   * this allows 500,000 rows — far beyond any season — and is a bug signal
   * rather than a real limit, so hitting it logs an error.
   */
  maxPages?: number;
}

/**
 * Fetch every row a query matches, paging past PostgREST's response-row cap.
 *
 * Calls `page(from, to)` repeatedly with advancing zero-based inclusive bounds
 * and concatenates the results.
 *
 * Termination, which is the whole subtlety: we do NOT stop merely because a
 * page came back shorter than `pageSize`, because the server's `max_rows` may
 * be below what we asked for — in that case every page is "short" and stopping
 * early would silently drop the tail, reintroducing the bug this exists to
 * prevent. Instead we track the largest page the server has actually returned
 * (its real capacity) and stop when a page comes back smaller than that, or
 * empty.
 *
 * @param page - Builds and runs one page of the query. Must apply a unique
 *               `.order(...)`, or paging is not stable; see the file header.
 * @param options - See {@link FetchAllRowsOptions}.
 * @returns Every matching row, in the caller's chosen order.
 * @throws Error if any page errors, with `label` for context.
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  options: FetchAllRowsOptions
): Promise<T[]> {
  const { label, pageSize = 1000, maxPages = 500 } = options;

  const all: T[] = [];
  // The biggest page the server has handed back so far — its effective
  // max_rows, learned rather than assumed.
  let capacity = 0;

  for (let requests = 0; requests < maxPages; requests++) {
    const from = all.length;
    const { data, error, count } = await page(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed to fetch ${label}: ${error.message}`);
    }

    const rows = data ?? [];
    all.push(...rows);

    // Nothing left.
    if (rows.length === 0) return all;

    // Preferred exit: the caller asked for an exact count, so we know precisely
    // when we have everything and never spend a probe request.
    if (typeof count === 'number' && all.length >= count) return all;

    capacity = Math.max(capacity, rows.length);

    // Fallback exit for callers without a count. A page smaller than the
    // server's demonstrated capacity means the result set ended — NOT that the
    // server throttled us, which is why we compare against the largest page
    // actually returned rather than against `pageSize`. Getting this wrong is
    // how a lowered `max_rows` would silently truncate again.
    //
    // Note the cost of having no count: a first page shorter than `pageSize` is
    // ambiguous (end of data, or a server cap equal to that length?), so it
    // takes one more request returning zero rows to settle it.
    if (typeof count !== 'number' && rows.length < capacity) return all;
  }

  // Falling out of the loop means maxPages was exhausted while rows were still
  // arriving. Return what we have — a short answer beats no answer on a stats
  // page — but say so loudly, because the totals are now understated.
  logger.error('fetchAllRows hit its page limit; result is incomplete', {
    label,
    pageSize,
    maxPages,
    rowsFetched: all.length,
  });
  return all;
}
