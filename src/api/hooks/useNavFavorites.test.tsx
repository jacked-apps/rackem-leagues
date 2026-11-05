/**
 * @fileoverview Tests for `useNavFavorites` — the star must flip instantly
 * (optimistic) and flip back with a toast when the save fails.
 *
 * The member record is seeded straight into the TanStack cache under the same
 * key `useCurrentMember` uses, and `useCurrentMember` is mocked to read that
 * cache, so the optimistic write is observable without a network.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

const mockUpdate = vi.fn();
const mockToastError = vi.fn();
const KEY = queryKeys.members.byUser('u1');

vi.mock('@/context/useUser', () => ({ useUser: () => ({ user: { id: 'u1' } }) }));
vi.mock('../mutations/members', () => ({
  updateNavFavorites: (...args: unknown[]) => mockUpdate(...args),
}));
vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => mockToastError(...a) } }));
// Read the member from the cache only — the test owns what's in it.
vi.mock('./useCurrentMember', () => ({
  useCurrentMember: () =>
    useQuery({ queryKey: KEY, queryFn: () => Promise.reject(new Error('no fetch')), enabled: false }),
}));

import { useNavFavorites } from './useNavFavorites';

function setup(navFavorites: string[] | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(KEY, { id: 'm1', nav_favorites: navFavorites });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useNavFavorites(), { wrapper });
}

beforeEach(() => vi.clearAllMocks());

describe('useNavFavorites', () => {
  it('treats NULL (never customised) as no favorites', () => {
    const { result } = setup(null);
    expect(result.current.favoriteIds).toEqual([]);
  });

  it('stars instantly and saves the whole list for the member', async () => {
    let resolveSave!: () => void;
    mockUpdate.mockReturnValue(new Promise<void>((r) => (resolveSave = r)));
    const { result } = setup(['stats']);

    act(() => result.current.toggleFavorite('rules'));

    // Optimistic: visible before the save resolves.
    await waitFor(() => expect(result.current.favoriteIds).toEqual(['stats', 'rules']));
    expect(mockUpdate).toHaveBeenCalledWith('m1', ['stats', 'rules']);
    resolveSave();
  });

  it('un-stars an existing favorite', async () => {
    mockUpdate.mockResolvedValue(undefined);
    const { result } = setup(['stats', 'rules']);
    act(() => result.current.toggleFavorite('stats'));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith('m1', ['rules']));
  });

  it('rolls the star back and tells the player when the save fails', async () => {
    mockUpdate.mockRejectedValue(new Error('offline'));
    const { result } = setup(['stats']);

    act(() => result.current.toggleFavorite('rules'));

    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
    expect(result.current.favoriteIds).toEqual(['stats']);
  });
});
