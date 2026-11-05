/**
 * @fileoverview Tests for how `useRaceActions.start` reports a who-breaks clash.
 *
 * Both phones tapped DIFFERENT names before realtime caught up, so the engine
 * kept the first pick and refused the second with `not_your_proposal`. The
 * second player must be told, by name, who already picked — and the race must
 * refetch so their prompt flips to the pick that stands (Confirm only).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/supabaseClient';
import { queryKeys } from '@/api/queryKeys';
import { useRaceActions } from '../useRaceActions';

vi.mock('@/supabaseClient', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

function setup(nameOf?: (side: 'home' | 'away') => string | undefined) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useRaceActions('race-1', { nameOf }), { wrapper });
  return { result, invalidate };
}

describe('useRaceActions start — who-breaks clash', () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { ok: false, reason: 'not_your_proposal', proposed_side: 'home', proposed_by_side: 'home' },
      error: null,
    } as never);
  });

  it('names the player who already picked, and refetches the race', async () => {
    const { result, invalidate } = setup((side) => (side === 'home' ? 'Ace' : 'Bee'));
    result.current.start.mutate({ firstBreakerSide: 'away' });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Ace already picked — confirm, or sort it out at the table.'
      )
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.races.detail('race-1') });
  });

  it('falls back to "the other player" when the name is not loaded', async () => {
    const { result } = setup();
    result.current.start.mutate({ firstBreakerSide: 'away' });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'The other player already picked — confirm, or sort it out at the table.'
      )
    );
  });
});
