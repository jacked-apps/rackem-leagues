/**
 * @fileoverview Tests for the threshold-chart RPC wrapper (Phase 3 Unit
 * 3.1 of the modular-league-system v2 plan).
 *
 * The wrapper functions take a Supabase client; tests pass a mocked
 * client with controlled responses. Integration tests against a real
 * Supabase instance (verifying the seeded chart values match the TS
 * hot-path) are deferred to the user's manual test pass — they need
 * a running local DB and can't run in `pnpm test:run`.
 *
 * What's locked here:
 *   - getGlobalChartIdByName: returns the chart row's id on success,
 *     null on miss, null on RPC error
 *   - lookupThresholdRaw: passes args correctly to supabase.rpc,
 *     normalizes single-row vs array response, returns null on miss
 *     and on error
 *   - lookupTeamThresholds: maps result_1/2/3 → games_to_win/tie/lose
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoisted mock so the import in thresholdLookup picks up our stub.
// Use vi.hoisted so the mock object is constructed at hoist time and
// available inside the vi.mock factory (which is itself hoisted).
const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock('@/supabaseClient', () => ({
  supabase: supabaseMock,
}));

import {
  getGlobalChartIdByName,
  lookupThresholdRaw,
  lookupTeamThresholds,
  SEEDED_CHART_NAMES,
} from '../thresholdLookup';

describe('SEEDED_CHART_NAMES', () => {
  it('exposes the four seeded global chart names for callers to look up by', () => {
    // These string values are matched in
    // supabase/migrations/20260410000003_seed_threshold_charts.sql.
    // If those names ever change, this constant must update too.
    expect(SEEDED_CHART_NAMES.bca3v3Points).toBe('Rackem League 3v3 Points Chart');
    expect(SEEDED_CHART_NAMES.bca5v5Percentage).toBe('Rackem League 5v5 Percentage Chart');
    expect(SEEDED_CHART_NAMES.racePoints).toBe('Rackem League Race Points Chart');
    expect(SEEDED_CHART_NAMES.racePercentage).toBe('Rackem League Race Percentage Chart');
  });
});

describe('getGlobalChartIdByName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setupFromMock(response: { data: any; error: any }) {
    const maybeSingle = vi.fn().mockResolvedValue(response);
    const eqAfterEq = { maybeSingle };
    const eqFirst = { eq: vi.fn().mockReturnValue(eqAfterEq) };
    const select = { eq: vi.fn().mockReturnValue(eqFirst) };
    const fromReturn = { select: vi.fn().mockReturnValue(select) };
    supabaseMock.from.mockReturnValue(fromReturn);
    return { maybeSingle };
  }

  it('returns the chart id when the name resolves to a row', async () => {
    setupFromMock({ data: { id: 'chart-uuid-bca3v3' }, error: null });
    const id = await getGlobalChartIdByName(SEEDED_CHART_NAMES.bca3v3Points);
    expect(id).toBe('chart-uuid-bca3v3');
    expect(supabaseMock.from).toHaveBeenCalledWith('threshold_charts');
  });

  it('returns null when no chart matches', async () => {
    setupFromMock({ data: null, error: null });
    const id = await getGlobalChartIdByName('Nonexistent Chart');
    expect(id).toBeNull();
  });

  it('returns null and logs a warning when Supabase reports an error', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setupFromMock({ data: null, error: { message: 'connection refused' } });
    const id = await getGlobalChartIdByName(SEEDED_CHART_NAMES.bca3v3Points);
    expect(id).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('lookupThresholdRaw', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes chart_id + comparison values through to the RPC', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: { result_1: 10, result_2: 9, result_3: 8, was_swapped: false },
      error: null,
    });

    const result = await lookupThresholdRaw('chart-uuid', 0);

    expect(supabaseMock.rpc).toHaveBeenCalledWith('lookup_threshold', {
      p_chart_id: 'chart-uuid',
      p_comp_1: 0,
      p_comp_2: null,
    });
    expect(result).toEqual({
      result_1: 10,
      result_2: 9,
      result_3: 8,
      was_swapped: false,
    });
  });

  it('passes comp_2 when supplied (race chart use case)', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: { result_1: 7, result_2: null, result_3: 4, was_swapped: false },
      error: null,
    });

    await lookupThresholdRaw('chart-uuid', 5, 3);

    expect(supabaseMock.rpc).toHaveBeenCalledWith('lookup_threshold', {
      p_chart_id: 'chart-uuid',
      p_comp_1: 5,
      p_comp_2: 3,
    });
  });

  it('normalizes a one-element array response into a single object', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: [{ result_1: 12, result_2: 11, result_3: 10, was_swapped: false }],
      error: null,
    });

    const result = await lookupThresholdRaw('chart-uuid', 4);
    expect(result?.result_1).toBe(12);
    expect(result?.result_2).toBe(11);
  });

  it('returns null when the RPC reports an error', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'function lookup_threshold(uuid, numeric, numeric) does not exist' },
    });

    const result = await lookupThresholdRaw('chart-uuid', 0);
    expect(result).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('returns null when the RPC returns an empty result set', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: [],
      error: null,
    });
    const result = await lookupThresholdRaw('chart-uuid', 999);
    expect(result).toBeNull();
  });
});

describe('lookupTeamThresholds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps result_1/2/3 → games_to_win/tie/lose', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: { result_1: 10, result_2: 9, result_3: 8, was_swapped: false },
      error: null,
    });

    const result = await lookupTeamThresholds('chart-uuid', 0);
    expect(result).toEqual({
      games_to_win: 10,
      games_to_tie: 9,
      games_to_lose: 8,
    });
  });

  it('preserves null game_to_tie (odd handicap-diff rows in the BCA 3v3 chart)', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: { result_1: 11, result_2: null, result_3: 9, was_swapped: false },
      error: null,
    });

    const result = await lookupTeamThresholds('chart-uuid', 3);
    expect(result?.games_to_tie).toBeNull();
    expect(result?.games_to_win).toBe(11);
    expect(result?.games_to_lose).toBe(9);
  });

  it('returns null when the lookup returned no row (caller falls back to TS chart)', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: null });
    const result = await lookupTeamThresholds('chart-uuid', 999);
    expect(result).toBeNull();
  });
});
