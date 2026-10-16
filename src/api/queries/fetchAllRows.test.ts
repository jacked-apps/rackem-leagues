/**
 * @fileoverview Tests for fetchAllRows — paging past PostgREST's row cap.
 *
 * The cases that matter are the termination rules. A naive "stop when the page
 * is shorter than pageSize" loop passes the happy path and still drops rows
 * whenever the server's `max_rows` is below what we asked for, which is exactly
 * the silent-truncation bug this helper exists to prevent.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAllRows } from './fetchAllRows';
import { logger } from '@/utils/logger';

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

/**
 * Build a fake pager over `total` rows where the server returns at most
 * `serverCap` rows per response, regardless of the range asked for.
 *
 * Also records every (from, to) pair so tests can assert the request pattern.
 */
function makePager(total: number, serverCap: number, withCount = false) {
  const calls: Array<{ from: number; to: number }> = [];
  const page = (from: number, to: number) => {
    calls.push({ from, to });
    const requested = to - from + 1;
    const end = Math.min(from + Math.min(requested, serverCap), total);
    const rows = [];
    for (let i = from; i < end; i++) rows.push({ id: i });
    // PostgREST reports the size of the WHOLE result set, not of this page.
    return Promise.resolve({ data: rows, error: null, count: withCount ? total : undefined });
  };
  return { page, calls };
}

describe('fetchAllRows', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a short first page in ONE request when a count is supplied', async () => {
    // The common case: every season under the cap. The exact count is what lets
    // us skip the probe request, so this is the payoff for passing it.
    const { page, calls } = makePager(42, 1000, true);

    const rows = await fetchAllRows<{ id: number }>(page, { label: 'test' });

    expect(rows).toHaveLength(42);
    expect(calls).toEqual([{ from: 0, to: 999 }]);
  });

  it('spends one probe request on a short first page when there is NO count', async () => {
    // Without a count, 42 rows from a 1000-row request is ambiguous: end of
    // data, or a server capped at 42? Only another request settles it. This is
    // the documented cost of omitting `{ count: 'exact' }`.
    const { page, calls } = makePager(42, 1000);

    const rows = await fetchAllRows<{ id: number }>(page, { label: 'test' });

    expect(rows).toHaveLength(42);
    expect(calls).toHaveLength(2);
  });

  it('uses the count to stop exactly, without a trailing empty request', async () => {
    // 1,008 rows, 1,000 cap, count known: two requests and no third.
    const { page, calls } = makePager(1008, 1000, true);

    const rows = await fetchAllRows<{ id: number }>(page, { label: 'test' });

    expect(rows).toHaveLength(1008);
    expect(calls).toEqual([
      { from: 0, to: 999 },
      { from: 1000, to: 1999 },
    ]);
  });

  it('with a count, still pages fully when the server cap is below pageSize', async () => {
    const { page } = makePager(1008, 500, true);

    const rows = await fetchAllRows<{ id: number }>(page, { label: 'test' });

    expect(rows).toHaveLength(1008);
    expect(rows.map((r) => r.id)).toEqual(Array.from({ length: 1008 }, (_, i) => i));
  });

  it('returns every row when the result exceeds the 1000-row cap', async () => {
    // The real Oct 2026 shape: 1,008 countable games against a 1,000 cap.
    const { page, calls } = makePager(1008, 1000);

    const rows = await fetchAllRows<{ id: number }>(page, { label: 'test' });

    expect(rows).toHaveLength(1008);
    // Rows must be the full contiguous set — no gaps, no duplicates.
    expect(rows.map((r) => r.id)).toEqual(Array.from({ length: 1008 }, (_, i) => i));
    expect(calls).toEqual([
      { from: 0, to: 999 },
      { from: 1000, to: 1999 },
    ]);
  });

  it('keeps paging when the server cap is BELOW the requested page size', async () => {
    // The case a "short page means done" loop gets wrong: every page is short,
    // so it would stop after 500 of 1,008 rows and understate every total.
    const { page } = makePager(1008, 500);

    const rows = await fetchAllRows<{ id: number }>(page, { label: 'test' });

    expect(rows).toHaveLength(1008);
    expect(rows.map((r) => r.id)).toEqual(Array.from({ length: 1008 }, (_, i) => i));
  });

  it('stops on an empty page when the total is an exact multiple of the cap', async () => {
    const { page, calls } = makePager(1000, 1000);

    const rows = await fetchAllRows<{ id: number }>(page, { label: 'test' });

    expect(rows).toHaveLength(1000);
    // Can't know it's done without asking once more and getting nothing.
    expect(calls).toHaveLength(2);
  });

  it('returns an empty array when there are no rows', async () => {
    const { page, calls } = makePager(0, 1000);

    const rows = await fetchAllRows<{ id: number }>(page, { label: 'test' });

    expect(rows).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it('treats null data as an empty page rather than throwing', async () => {
    const page = vi.fn().mockResolvedValue({ data: null, error: null });

    const rows = await fetchAllRows(page, { label: 'test' });

    expect(rows).toEqual([]);
  });

  it('throws with the label when a page errors', async () => {
    const page = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });

    await expect(fetchAllRows(page, { label: 'season player stats' })).rejects.toThrow(
      'Failed to fetch season player stats: boom'
    );
  });

  it('propagates an error raised on a LATER page', async () => {
    let n = 0;
    const page = vi.fn().mockImplementation(() => {
      n++;
      if (n === 1) {
        return Promise.resolve({
          data: Array.from({ length: 1000 }, (_, i) => ({ id: i })),
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: { message: 'page 2 died' } });
    });

    await expect(fetchAllRows(page, { label: 'feats games' })).rejects.toThrow(
      'Failed to fetch feats games: page 2 died'
    );
  });

  it('honours a custom pageSize', async () => {
    const { page, calls } = makePager(250, 1000);

    const rows = await fetchAllRows<{ id: number }>(page, { label: 'test', pageSize: 100 });

    expect(rows).toHaveLength(250);
    expect(calls).toEqual([
      { from: 0, to: 99 },
      { from: 100, to: 199 },
      { from: 200, to: 299 },
    ]);
  });

  it('stops at maxPages and logs an error instead of looping forever', async () => {
    // Server always returns a full page, so paging would never terminate.
    const page = vi.fn().mockImplementation((from: number, to: number) =>
      Promise.resolve({
        data: Array.from({ length: to - from + 1 }, (_, i) => ({ id: from + i })),
        error: null,
      })
    );

    const rows = await fetchAllRows(page, { label: 'runaway', pageSize: 10, maxPages: 3 });

    expect(rows).toHaveLength(30);
    expect(page).toHaveBeenCalledTimes(3);
    expect(logger.error).toHaveBeenCalledWith(
      'fetchAllRows hit its page limit; result is incomplete',
      expect.objectContaining({ label: 'runaway', rowsFetched: 30 })
    );
  });
});
