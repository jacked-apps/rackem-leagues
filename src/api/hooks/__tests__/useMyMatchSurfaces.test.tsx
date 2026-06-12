/**
 * @fileoverview Tests for useMyMatchSurfaces (Unit 2 of the My Match plan).
 *
 * The bulk of the value is in the PURE resolvers (classifyTier,
 * compareWithinTier, resolveMyMatchNavState, buildMyMatchDrawerItems) — the
 * four-tier ladder, the multi-live tiebreak, and the drawer labeling — so those
 * are tested directly without React. A small set of hook tests then proves the
 * wiring: the no-member posture (no query, no channel), live resolution end to
 * end, the no-teams short-circuit, and error fallback.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { formatLocalDate, parseLocalDate } from '@/utils/formatters';

// --- Mocks -----------------------------------------------------------------

const { queriesMock } = vi.hoisted(() => ({
  queriesMock: {
    getMemberTeamIds: vi.fn(),
    getMyMatchMatches: vi.fn(),
  },
}));
vi.mock('@/api/queries/matches', () => ({
  getMemberTeamIds: queriesMock.getMemberTeamIds,
  getMyMatchMatches: queriesMock.getMyMatchMatches,
}));

const { supabaseMock, channelMock } = vi.hoisted(() => {
  const channelMock: any = { on: vi.fn(), subscribe: vi.fn() };
  channelMock.on.mockReturnValue(channelMock);
  channelMock.subscribe.mockReturnValue(channelMock);
  return {
    channelMock,
    supabaseMock: { channel: vi.fn(() => channelMock), removeChannel: vi.fn() },
  };
});
vi.mock('@/supabaseClient', () => ({ supabase: supabaseMock }));

import {
  classifyTier,
  compareWithinTier,
  resolveMyMatchNavState,
  buildMyMatchDrawerItems,
  useMyMatchSurfaces,
  type MyMatchRow,
} from '../useMyMatchSurfaces';

// --- Fixtures --------------------------------------------------------------

function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}
const TODAY = formatLocalDate(new Date());
const YESTERDAY = isoOffset(-1);
const TOMORROW = isoOffset(1);

function row(o: Partial<MyMatchRow> & { id: string }): MyMatchRow {
  return {
    status: 'in_progress',
    started_at: null,
    scheduled_date: TODAY,
    home_team_id: 't1',
    away_team_id: 't2',
    home_games_won: 0,
    away_games_won: 0,
    home_team: { id: 't1', team_name: 'Sharks', captain_id: null, status: 'active' },
    away_team: { id: 't2', team_name: 'Cues', captain_id: null, status: 'active' },
    ...o,
  } as unknown as MyMatchRow;
}

// --- Pure resolvers --------------------------------------------------------

describe('classifyTier', () => {
  it('classifies an in_progress match as Tier 1', () => {
    expect(classifyTier(row({ id: 'm', status: 'in_progress' }), TODAY)).toBe(1);
  });
  it("classifies today's scheduled match as Tier 2", () => {
    expect(classifyTier(row({ id: 'm', status: 'scheduled', scheduled_date: TODAY }), TODAY)).toBe(2);
  });
  it('classifies a past-due scheduled match as Tier 3', () => {
    expect(classifyTier(row({ id: 'm', status: 'scheduled', scheduled_date: YESTERDAY }), TODAY)).toBe(3);
  });
  it('does not classify a future-scheduled match', () => {
    expect(classifyTier(row({ id: 'm', status: 'scheduled', scheduled_date: TOMORROW }), TODAY)).toBeNull();
  });
  it('does not classify a terminal status (defensive)', () => {
    expect(classifyTier(row({ id: 'm', status: 'completed' as any }), TODAY)).toBeNull();
  });
});

describe('compareWithinTier (Tier 1 tiebreak)', () => {
  it('orders oldest started_at first, nulls last', () => {
    const older = row({ id: 'a', started_at: '2026-06-12T19:00:00Z' });
    const newer = row({ id: 'b', started_at: '2026-06-12T20:00:00Z' });
    const noStart = row({ id: 'c', started_at: null });
    const sorted = [noStart, newer, older].sort((x, y) => compareWithinTier(1, x, y));
    expect(sorted.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });
  it('breaks an equal start by furthest-along (games won desc), then id', () => {
    const t = '2026-06-12T19:00:00Z';
    const fewer = row({ id: 'a', started_at: t, home_games_won: 1, away_games_won: 1 });
    const more = row({ id: 'b', started_at: t, home_games_won: 3, away_games_won: 2 });
    const sorted = [fewer, more].sort((x, y) => compareWithinTier(1, x, y));
    expect(sorted.map((m) => m.id)).toEqual(['b', 'a']);
  });
});

describe('resolveMyMatchNavState', () => {
  it('returns Tier 4 (no destination, no dot) for an empty set', () => {
    expect(resolveMyMatchNavState([], TODAY)).toEqual({
      tier: 4,
      destinationMatchId: null,
      showLiveDot: false,
    });
  });

  it('resolves a single live match to Tier 1 with the dot', () => {
    const state = resolveMyMatchNavState([row({ id: 'm1', status: 'in_progress' })], TODAY);
    expect(state).toEqual({ tier: 1, destinationMatchId: 'm1', showLiveDot: true });
  });

  it("resolves today's scheduled match to Tier 2, no dot", () => {
    const state = resolveMyMatchNavState(
      [row({ id: 'm2', status: 'scheduled', scheduled_date: TODAY })],
      TODAY,
    );
    expect(state).toEqual({ tier: 2, destinationMatchId: 'm2', showLiveDot: false });
  });

  it('resolves a past-due makeup to Tier 3, no dot', () => {
    const state = resolveMyMatchNavState(
      [row({ id: 'm3', status: 'scheduled', scheduled_date: YESTERDAY })],
      TODAY,
    );
    expect(state).toEqual({ tier: 3, destinationMatchId: 'm3', showLiveDot: false });
  });

  it('prefers live over today (Tier 1 wins) when both exist', () => {
    const state = resolveMyMatchNavState(
      [
        row({ id: 'today', status: 'scheduled', scheduled_date: TODAY }),
        row({ id: 'live', status: 'in_progress' }),
      ],
      TODAY,
    );
    expect(state.tier).toBe(1);
    expect(state.destinationMatchId).toBe('live');
  });

  it('prefers today over makeup when there is no live match', () => {
    const state = resolveMyMatchNavState(
      [
        row({ id: 'makeup', status: 'scheduled', scheduled_date: YESTERDAY }),
        row({ id: 'today', status: 'scheduled', scheduled_date: TODAY }),
      ],
      TODAY,
    );
    expect(state.tier).toBe(2);
    expect(state.destinationMatchId).toBe('today');
  });

  it('auto-picks the oldest-started of two live matches', () => {
    const state = resolveMyMatchNavState(
      [
        row({ id: 'newer', status: 'in_progress', started_at: '2026-06-12T20:00:00Z' }),
        row({ id: 'older', status: 'in_progress', started_at: '2026-06-12T19:00:00Z' }),
      ],
      TODAY,
    );
    expect(state.destinationMatchId).toBe('older');
  });
});

describe('buildMyMatchDrawerItems', () => {
  it('returns [] for an empty set', () => {
    expect(buildMyMatchDrawerItems([], ['t1'], TODAY)).toEqual([]);
  });

  it('orders rows live → today → makeup', () => {
    const items = buildMyMatchDrawerItems(
      [
        row({ id: 'makeup', status: 'scheduled', scheduled_date: YESTERDAY }),
        row({ id: 'today', status: 'scheduled', scheduled_date: TODAY }),
        row({ id: 'live', status: 'in_progress' }),
      ],
      ['t1'],
      TODAY,
    );
    expect(items.map((i) => i.matchId)).toEqual(['live', 'today', 'makeup']);
    expect(items.map((i) => i.label)).toEqual(['Live', 'Today', expect.stringMatching(/^Makeup \(/)]);
  });

  it('tags each item with its drawer chip group (live | makeup)', () => {
    const items = buildMyMatchDrawerItems(
      [
        row({ id: 'live', status: 'in_progress' }),
        row({ id: 'today', status: 'scheduled', scheduled_date: TODAY }),
        row({ id: 'makeup', status: 'scheduled', scheduled_date: YESTERDAY }),
      ],
      ['t1'],
      TODAY,
    );
    const groupById = Object.fromEntries(items.map((i) => [i.matchId, i.group]));
    // in_progress and today both live under the "Live" chip; past-due is "Makeup".
    expect(groupById).toEqual({ live: 'live', today: 'live', makeup: 'makeup' });
  });

  it('labels "my team vs opponent" when the member is on the home team', () => {
    const [item] = buildMyMatchDrawerItems([row({ id: 'm', status: 'in_progress' })], ['t1'], TODAY);
    expect(item.teamName).toBe('Sharks');
    expect(item.opponentName).toBe('Cues');
    expect(item.destinationPath).toBe('/match/m/lineup');
  });

  it('flips perspective when the member is on the away team', () => {
    const [item] = buildMyMatchDrawerItems([row({ id: 'm', status: 'in_progress' })], ['t2'], TODAY);
    expect(item.teamName).toBe('Cues');
    expect(item.opponentName).toBe('Sharks');
  });

  it('formats the makeup label with the original scheduled date', () => {
    const [item] = buildMyMatchDrawerItems(
      [row({ id: 'm', status: 'scheduled', scheduled_date: YESTERDAY })],
      ['t1'],
      TODAY,
    );
    const expected = parseLocalDate(YESTERDAY).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
    expect(item.label).toBe(`Makeup (${expected})`);
  });
});

// --- Hook wiring -----------------------------------------------------------

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

describe('useMyMatchSurfaces (wiring)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queriesMock.getMemberTeamIds.mockResolvedValue(['t1']);
    queriesMock.getMyMatchMatches.mockResolvedValue([]);
  });

  it('returns the no-match posture and opens no realtime channel when memberId is null', () => {
    const { result } = renderHook(() => useMyMatchSurfaces(null), { wrapper });
    expect(result.current).toMatchObject({
      tier: 4,
      destinationMatchId: null,
      showLiveDot: false,
      isHydrating: false,
      isError: false,
    });
    expect(queriesMock.getMemberTeamIds).not.toHaveBeenCalled();
    expect(supabaseMock.channel).not.toHaveBeenCalled();
  });

  it('resolves a live match to Tier 1 and subscribes to a per-member channel', async () => {
    queriesMock.getMyMatchMatches.mockResolvedValue([row({ id: 'm1', status: 'in_progress' })]);
    const { result } = renderHook(() => useMyMatchSurfaces('member-1'), { wrapper });

    await waitFor(() => expect(result.current.tier).toBe(1));
    expect(result.current.destinationMatchId).toBe('m1');
    expect(result.current.showLiveDot).toBe(true);
    expect(result.current.drawerItems).toHaveLength(1);
    expect(queriesMock.getMyMatchMatches).toHaveBeenCalledWith('member-1', ['t1']);
    expect(supabaseMock.channel).toHaveBeenCalledWith('my_match_member-1');
  });

  it('short-circuits to Tier 4 without querying matches when the member has no teams', async () => {
    queriesMock.getMemberTeamIds.mockResolvedValue([]);
    const { result } = renderHook(() => useMyMatchSurfaces('member-1'), { wrapper });

    await waitFor(() => expect(result.current.isHydrating).toBe(false));
    expect(result.current.tier).toBe(4);
    expect(queriesMock.getMyMatchMatches).not.toHaveBeenCalled();
  });

  it('falls back to the Tier-4 posture with isError when the query fails', async () => {
    queriesMock.getMemberTeamIds.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useMyMatchSurfaces('member-1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.tier).toBe(4);
    expect(result.current.destinationMatchId).toBeNull();
  });
});
