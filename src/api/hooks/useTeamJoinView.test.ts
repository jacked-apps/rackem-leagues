/**
 * @fileoverview Tests for `useTeamJoinView`.
 *
 * Exercises only the hook's wiring — the enabled gate (no token → no fetch)
 * and that it surfaces the query function's result. The RPC itself is proven
 * end-to-end in src/__tests__/database/get-team-join-view.test.ts, so the
 * underlying query is mocked at the module boundary here.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockGetTeamJoinView = vi.fn();

vi.mock('../queries/teamJoin', () => ({
  getTeamJoinView: (token: string) => mockGetTeamJoinView(token),
}));

import { useTeamJoinView } from './useTeamJoinView';
import type { TeamJoinView } from '../queries/teamJoin';

const VIEW: TeamJoinView = {
  found: true,
  team_id: 'team-1',
  team_name: 'The Break Room',
  league_name: 'Tuesday Eight-ball - 3v3 Points League',
  roster_size: 5,
  spots: [{ member_id: 'm1', display_name: 'P1', is_open: true }],
  viewer_request_status: null,
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useTeamJoinView', () => {
  it('does not fetch when no token is provided', () => {
    const { result } = renderHook(() => useTeamJoinView(undefined), { wrapper });
    expect(mockGetTeamJoinView).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches and returns the view for a token', async () => {
    mockGetTeamJoinView.mockResolvedValue(VIEW);
    const { result } = renderHook(() => useTeamJoinView('tok-123'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetTeamJoinView).toHaveBeenCalledWith('tok-123');
    expect(result.current.data).toEqual(VIEW);
  });
});
